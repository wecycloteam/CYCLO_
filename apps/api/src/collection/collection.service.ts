import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, PickupStatus } from '@cyclo/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { WasteMaterialsService } from '../waste-materials/waste-materials.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { assertValidListingTransition } from '../marketplace/domain/listing-state-machine';
import { assertValidPickupTransition } from './domain/pickup-state-machine';
import { buildTransactionReference } from './domain/transaction-reference';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { RecordWeightDto } from './dto/record-weight.dto';

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly materials: WasteMaterialsService,
    private readonly marketplace: MarketplaceService,
  ) {}

  async create(producerId: string, dto: CreatePickupRequestDto) {
    await this.locations.assertOwnedBy(dto.locationId, producerId);

    let materialId: string;
    let estimatedWeightKg: number;

    if (dto.listingId) {
      const listing = await this.marketplace.getActiveOwnedListing(producerId, dto.listingId);
      materialId = listing.materialId;
      estimatedWeightKg = dto.estimatedWeightKg ?? listing.estimatedWeightKg;
    } else {
      if (!dto.materialId || !dto.estimatedWeightKg) {
        throw new BadRequestException('materialId and estimatedWeightKg are required when no listingId is given.');
      }
      await this.materials.assertExists(dto.materialId);
      materialId = dto.materialId;
      estimatedWeightKg = dto.estimatedWeightKg;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.listingId) {
        assertValidListingTransition('ACTIVE', 'RESERVED');
        const reserved = await tx.wasteListing.updateMany({
          where: { id: dto.listingId, status: 'ACTIVE' },
          data: { status: 'RESERVED' },
        });
        if (reserved.count === 0) {
          throw new ConflictException('This listing is no longer available for pickup.');
        }
      }

      const pickup = await tx.pickupRequest.create({
        data: {
          producerId,
          locationId: dto.locationId,
          materialId,
          listingId: dto.listingId,
          estimatedWeightKg,
          preferredTime: dto.preferredTime ? new Date(dto.preferredTime) : null,
          notes: dto.notes,
          status: 'MATCHING',
        },
      });

      await tx.wasteEvent.create({
        data: {
          pickupRequestId: pickup.id,
          eventType: 'PICKUP_REQUESTED',
          actorId: producerId,
          previousState: 'CREATED',
          newState: 'MATCHING',
        },
      });

      return pickup;
    });
  }

  // The open job pool — collectors browse requests nobody has accepted yet.
  listOpen() {
    return this.prisma.pickupRequest.findMany({
      where: { status: 'MATCHING' },
      include: { material: true, location: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  listMine(producerId: string) {
    return this.prisma.pickupRequest.findMany({
      where: { producerId },
      include: { material: true, location: true, transaction: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAssigned(collectorId: string) {
    return this.prisma.pickupRequest.findMany({
      where: { assignedCollectorId: collectorId },
      include: { material: true, location: true, transaction: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(requesterId: string, id: string) {
    const pickup = await this.prisma.pickupRequest.findUnique({
      where: { id },
      include: { material: true, location: true, transaction: true },
    });
    if (!pickup) throw new NotFoundException('Pickup request not found.');
    if (pickup.producerId !== requesterId && pickup.assignedCollectorId !== requesterId) {
      throw new NotFoundException('Pickup request not found.');
    }
    return pickup;
  }

  async listEvents(requesterId: string, id: string) {
    await this.findOne(requesterId, id);
    return this.prisma.wasteEvent.findMany({
      where: { pickupRequestId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Race-safe self-service accept: the transition's validity is enforced structurally by
  // the where-clause (only a MATCHING row can be claimed), not a separate pre-check —
  // checking status first and updating second would leave a window where two collectors
  // both read MATCHING and both "pass" before either write lands.
  async accept(collectorId: string, id: string) {
    await this.getRaw(id); // 404s on a nonexistent id before we touch anything else

    const result = await this.prisma.pickupRequest.updateMany({
      where: { id, status: 'MATCHING' },
      data: { status: 'ACCEPTED', assignedCollectorId: collectorId },
    });
    if (result.count === 0) {
      throw new ConflictException('This job is no longer available to accept.');
    }

    await this.prisma.wasteEvent.create({
      data: {
        pickupRequestId: id,
        eventType: 'PICKUP_ACCEPTED',
        actorId: collectorId,
        previousState: 'MATCHING',
        newState: 'ACCEPTED',
      },
    });
    return this.getRaw(id);
  }

  enRoute(collectorId: string, id: string) {
    return this.advanceAsCollector(collectorId, id, 'EN_ROUTE', 'PICKUP_EN_ROUTE');
  }

  arrive(collectorId: string, id: string) {
    return this.advanceAsCollector(collectorId, id, 'ARRIVED', 'PICKUP_ARRIVED');
  }

  startCollecting(collectorId: string, id: string) {
    return this.advanceAsCollector(collectorId, id, 'COLLECTING', 'PICKUP_COLLECTING');
  }

  async recordWeight(collectorId: string, id: string, dto: RecordWeightDto) {
    const pickup = await this.getAssignedTo(collectorId, id);
    assertValidPickupTransition(pickup.status as PickupStatus, 'WEIGHED');

    const updated = await this.prisma.pickupRequest.update({
      where: { id },
      data: {
        status: 'WEIGHED',
        verifiedWeightKg: dto.verifiedWeightKg,
        weightRecordedByUserId: collectorId,
        weightRecordedAt: new Date(),
        weightMethod: dto.method,
      },
    });

    await this.prisma.wasteEvent.create({
      data: {
        pickupRequestId: id,
        eventType: 'PICKUP_WEIGHED',
        actorId: collectorId,
        previousState: pickup.status,
        newState: 'WEIGHED',
        notes: `verifiedWeightKg=${dto.verifiedWeightKg}${dto.method ? ` method=${dto.method}` : ''}`,
      },
    });

    return updated;
  }

  // §23–§25 — completion is where the Transaction is created and the waste's journey
  // becomes traceable; everything here runs in one transaction so a crash mid-way never
  // leaves a WEIGHED pickup with no Transaction or a listing stuck in RESERVED.
  async complete(collectorId: string, id: string) {
    const pickup = await this.getAssignedTo(collectorId, id);
    assertValidPickupTransition(pickup.status as PickupStatus, 'COMPLETED');
    if (pickup.verifiedWeightKg == null) {
      throw new BadRequestException('Cannot complete a pickup with no verified weight recorded.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pickupRequest.update({ where: { id }, data: { status: 'COMPLETED' } });
      await tx.wasteEvent.create({
        data: {
          pickupRequestId: id,
          eventType: 'PICKUP_COMPLETED',
          actorId: collectorId,
          previousState: 'WEIGHED',
          newState: 'COMPLETED',
        },
      });

      let agreedPrice: number | null = null;
      if (pickup.listingId) {
        const listing = await tx.wasteListing.findUnique({ where: { id: pickup.listingId } });
        if (!listing) throw new NotFoundException('Linked listing not found.');
        agreedPrice = listing.askingPrice;

        assertValidListingTransition(listing.status as ListingStatus, 'SOLD');
        await tx.wasteListing.update({
          where: { id: pickup.listingId },
          data: { status: 'SOLD', verifiedWeightKg: pickup.verifiedWeightKg },
        });
        assertValidListingTransition('SOLD', 'COLLECTED');
        await tx.wasteListing.update({ where: { id: pickup.listingId }, data: { status: 'COLLECTED' } });
      }

      // §17 — no pricing engine yet; a manual asking price passes through as-is, with a
      // zero platform fee until a real fee schedule exists. Never fabricated as a "market"
      // price. §26 — paymentStatus stays PENDING; no real payment provider is wired yet.
      const location = await tx.location.findUnique({ where: { id: pickup.locationId } });
      const sequence = (await tx.transaction.count()) + 1;
      const reference = buildTransactionReference(location?.region, sequence);

      const transaction = await tx.transaction.create({
        data: {
          reference,
          pickupRequestId: id,
          sellerId: pickup.producerId,
          collectorId,
          materialId: pickup.materialId,
          verifiedWeightKg: pickup.verifiedWeightKg!,
          agreedPrice,
          platformFee: 0,
          grossAmount: agreedPrice,
          netAmount: agreedPrice,
          paymentStatus: 'PENDING',
        },
      });

      await tx.wasteEvent.create({
        data: {
          pickupRequestId: id,
          transactionId: transaction.id,
          eventType: 'TRANSACTION_CREATED',
          actorId: collectorId,
          newState: 'PENDING',
        },
      });

      return transaction;
    });
  }

  async cancel(requesterId: string, id: string) {
    const pickup = await this.findOne(requesterId, id);
    assertValidPickupTransition(pickup.status as PickupStatus, 'CANCELLED');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pickupRequest.update({ where: { id }, data: { status: 'CANCELLED' } });

      if (pickup.listingId) {
        const listing = await tx.wasteListing.findUnique({ where: { id: pickup.listingId } });
        if (listing?.status === 'RESERVED') {
          assertValidListingTransition('RESERVED', 'ACTIVE');
          await tx.wasteListing.update({ where: { id: pickup.listingId }, data: { status: 'ACTIVE' } });
        }
      }

      await tx.wasteEvent.create({
        data: {
          pickupRequestId: id,
          eventType: 'PICKUP_CANCELLED',
          actorId: requesterId,
          previousState: pickup.status,
          newState: 'CANCELLED',
        },
      });

      return updated;
    });
  }

  private async advanceAsCollector(collectorId: string, id: string, to: PickupStatus, eventType: string) {
    const pickup = await this.getAssignedTo(collectorId, id);
    assertValidPickupTransition(pickup.status as PickupStatus, to);

    const updated = await this.prisma.pickupRequest.update({ where: { id }, data: { status: to } });
    await this.prisma.wasteEvent.create({
      data: {
        pickupRequestId: id,
        eventType,
        actorId: collectorId,
        previousState: pickup.status,
        newState: to,
      },
    });
    return updated;
  }

  private async getRaw(id: string) {
    const pickup = await this.prisma.pickupRequest.findUnique({ where: { id } });
    if (!pickup) throw new NotFoundException('Pickup request not found.');
    return pickup;
  }

  private async getAssignedTo(collectorId: string, id: string) {
    const pickup = await this.getRaw(id);
    if (pickup.assignedCollectorId !== collectorId) {
      throw new ForbiddenException('You are not the collector assigned to this pickup.');
    }
    return pickup;
  }
}
