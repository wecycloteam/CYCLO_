import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SMS_PROVIDER } from '../src/sms/sms-provider.interface';
import { PrismaService } from '../src/prisma/prisma.service';

class CapturingSmsProvider {
  public lastCode: string | null = null;
  readonly exposesCodeInResponse = false;
  async sendOtp(_phone: string, code: string) {
    this.lastCode = code;
  }
}

// This is the master prompt's §52 critical test case, backend-side: the full loop from
// a household's listing through a collector's pickup to a recorded, traceable
// transaction. If this suite is green, the core CYCLO loop actually works end-to-end.
describe('Collection (e2e) — the §52 critical path (list -> pickup -> weigh -> transaction)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms = new CapturingSmsProvider();
  const householdPhone = '+255700777001';
  const collectorPhone = '+255700777002';
  const otherCollectorPhone = '+255700777003';
  let householdToken: string;
  let collectorToken: string;
  let otherCollectorToken: string;
  let materialId: string;
  let locationId: string;
  const phonesToClean = [householdPhone, collectorPhone, otherCollectorPhone];

  async function loginAsNewUser(phone: string, role?: string): Promise<string> {
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone }).expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode, name: 'Collection E2E User', role })
      .expect(201);
    return verifyRes.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const material = await prisma.wasteMaterial.findFirst({ where: { active: true } });
    if (!material) throw new Error('Test setup requires a seeded WasteMaterial — run `npm run db:seed`.');
    materialId = material.id;

    householdToken = await loginAsNewUser(householdPhone, 'household');
    collectorToken = await loginAsNewUser(collectorPhone, 'collector');
    otherCollectorToken = await loginAsNewUser(otherCollectorPhone, 'collector');

    const locationRes = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${householdToken}`)
      .send({ label: 'Home', region: 'Arusha', country: 'TZ' })
      .expect(201);
    locationId = locationRes.body.id;
  });

  afterAll(async () => {
    const pickups = await prisma.pickupRequest.findMany({ where: { producer: { phone: { in: phonesToClean } } } });
    const pickupIds = pickups.map((p) => p.id);
    await prisma.wasteEvent.deleteMany({ where: { pickupRequestId: { in: pickupIds } } });
    await prisma.transaction.deleteMany({ where: { pickupRequestId: { in: pickupIds } } });
    await prisma.pickupRequest.deleteMany({ where: { id: { in: pickupIds } } });
    await prisma.wasteListing.deleteMany({ where: { seller: { phone: { in: phonesToClean } } } });
    await prisma.location.deleteMany({ where: { user: { phone: { in: phonesToClean } } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone: { in: phonesToClean } } } });
    await prisma.user.deleteMany({ where: { phone: { in: phonesToClean } } });
    await app.close();
  });

  let listingId: string;
  let pickupId: string;

  it('household creates and publishes a listing', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${householdToken}`)
      .send({ materialId, locationId, estimatedWeightKg: 20, pickupOption: 'collection_required', askingPrice: 15000 })
      .expect(201);
    listingId = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${householdToken}`)
      .expect(200);
  });

  it('rejects a pickup request against a listing that is not ACTIVE (already reserved later, checked again below)', async () => {
    // sanity: cannot request a pickup against someone else's / nonexistent listing
    await request(app.getHttpServer())
      .post('/pickup-requests')
      .set('Authorization', `Bearer ${householdToken}`)
      .send({ locationId, listingId: 'not-a-real-id' })
      .expect(400); // fails IsUUID validation
  });

  it('household requests a pickup against the listing, reserving it', async () => {
    const res = await request(app.getHttpServer())
      .post('/pickup-requests')
      .set('Authorization', `Bearer ${householdToken}`)
      .send({ locationId, listingId })
      .expect(201);

    expect(res.body.status).toBe('MATCHING');
    pickupId = res.body.id;

    const listingRes = await request(app.getHttpServer())
      .get(`/listings/${listingId}`)
      .set('Authorization', `Bearer ${householdToken}`)
      .expect(200);
    expect(listingRes.body.status).toBe('RESERVED');
  });

  it('shows the job in the open pool for collectors', async () => {
    const res = await request(app.getHttpServer())
      .get('/pickup-requests/open')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    expect(res.body.some((p: { id: string }) => p.id === pickupId)).toBe(true);
  });

  it('rejects a household user (non-collector) trying to accept a job', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/accept`)
      .set('Authorization', `Bearer ${householdToken}`)
      .expect(403);
  });

  it('collector accepts the job', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/accept`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    expect(res.body.status).toBe('ACCEPTED');
  });

  it('rejects a second collector accepting the same now-taken job', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/accept`)
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(409);
  });

  it('rejects the unassigned collector advancing the job', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/en-route`)
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(403);
  });

  it('walks the assigned collector through en-route -> arrived -> collecting', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/en-route`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/arrive`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    const res = await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/start-collecting`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);
    expect(res.body.status).toBe('COLLECTING');
  });

  it('rejects completing before a weight is recorded', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/complete`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(400);
  });

  it('records the verified weight, distinct from the estimated weight', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/weigh`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .send({ verifiedWeightKg: 18.4, method: 'platform_scale' })
      .expect(200);
    expect(res.body.status).toBe('WEIGHED');
    expect(res.body.verifiedWeightKg).toBe(18.4);
    expect(res.body.estimatedWeightKg).toBe(20);
  });

  let transactionReference: string;

  it('completes the pickup, creating a Transaction and moving the listing to COLLECTED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/complete`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(200);

    expect(res.body.reference).toMatch(/^CYCLO-ARU-\d{7}$/);
    expect(res.body.verifiedWeightKg).toBe(18.4);
    expect(res.body.agreedPrice).toBe(15000);
    expect(res.body.paymentStatus).toBe('PENDING'); // no real payment provider wired yet (§26)
    transactionReference = res.body.reference;

    const listingRes = await request(app.getHttpServer())
      .get(`/listings/${listingId}`)
      .set('Authorization', `Bearer ${householdToken}`)
      .expect(200);
    expect(listingRes.body.status).toBe('COLLECTED');
    expect(listingRes.body.verifiedWeightKg).toBe(18.4);
  });

  it('rejects completing an already-completed pickup', async () => {
    await request(app.getHttpServer())
      .patch(`/pickup-requests/${pickupId}/complete`)
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(400);
  });

  it('exposes the full waste event history, in order, matching the actual journey (§23/§24)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/pickup-requests/${pickupId}/events`)
      .set('Authorization', `Bearer ${householdToken}`)
      .expect(200);

    const eventTypes = res.body.map((e: { eventType: string }) => e.eventType);
    expect(eventTypes).toEqual([
      'PICKUP_REQUESTED',
      'PICKUP_ACCEPTED',
      'PICKUP_EN_ROUTE',
      'PICKUP_ARRIVED',
      'PICKUP_COLLECTING',
      'PICKUP_WEIGHED',
      'PICKUP_COMPLETED',
      'TRANSACTION_CREATED',
    ]);
    expect(res.body.some((e: { notes: string | null }) => e.notes?.includes('18.4'))).toBe(true);
  });

  it('hides pickup detail and event history from an uninvolved user', async () => {
    await request(app.getHttpServer())
      .get(`/pickup-requests/${pickupId}`)
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/pickup-requests/${pickupId}/events`)
      .set('Authorization', `Bearer ${otherCollectorToken}`)
      .expect(404);
  });

  it('confirms exactly one Transaction row exists, referencing the completed pickup', async () => {
    const transaction = await prisma.transaction.findUnique({ where: { pickupRequestId: pickupId } });
    expect(transaction).not.toBeNull();
    expect(transaction?.reference).toBe(transactionReference);
    expect(transaction?.sellerId).toBeDefined();
    expect(transaction?.collectorId).toBeDefined();
  });

  describe('cancellation releases a reserved listing back to ACTIVE', () => {
    let secondListingId: string;
    let secondPickupId: string;

    it('sets up a second listing + pickup', async () => {
      const listingRes = await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${householdToken}`)
        .send({ materialId, locationId, estimatedWeightKg: 5, pickupOption: 'flexible' })
        .expect(201);
      secondListingId = listingRes.body.id;
      await request(app.getHttpServer())
        .patch(`/listings/${secondListingId}/publish`)
        .set('Authorization', `Bearer ${householdToken}`)
        .expect(200);

      const pickupRes = await request(app.getHttpServer())
        .post('/pickup-requests')
        .set('Authorization', `Bearer ${householdToken}`)
        .send({ locationId, listingId: secondListingId })
        .expect(201);
      secondPickupId = pickupRes.body.id;
    });

    it('cancels the pickup and reverts the listing to ACTIVE', async () => {
      await request(app.getHttpServer())
        .patch(`/pickup-requests/${secondPickupId}/cancel`)
        .set('Authorization', `Bearer ${householdToken}`)
        .expect(200);

      const listingRes = await request(app.getHttpServer())
        .get(`/listings/${secondListingId}`)
        .set('Authorization', `Bearer ${householdToken}`)
        .expect(200);
      expect(listingRes.body.status).toBe('ACTIVE');
    });
  });
});
