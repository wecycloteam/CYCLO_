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

// Covers the CREATE LISTING / VIEW LISTING segment of the §75 vertical slice — the next
// step after auth+profile. Pickup/collector/transaction/waste-event follow in later slices.
describe('Marketplace (e2e) — listings (§14/§15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms = new CapturingSmsProvider();
  const sellerPhone = '+255700555001';
  const otherPhone = '+255700555002';
  let sellerToken: string;
  let otherToken: string;
  let materialId: string;
  let locationId: string;

  async function loginAsNewUser(phone: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone })
      .expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode, name: 'Marketplace E2E User' })
      .expect(201);
    return verifyRes.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const material = await prisma.wasteMaterial.findFirst({
      where: { active: true },
    });
    if (!material)
      throw new Error(
        'Test setup requires a seeded WasteMaterial — run `npm run db:seed`.',
      );
    materialId = material.id;

    sellerToken = await loginAsNewUser(sellerPhone);
    otherToken = await loginAsNewUser(otherPhone);

    const locationRes = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ label: 'Home', region: 'Arusha', country: 'TZ' })
      .expect(201);
    locationId = locationRes.body.id;
  });

  afterAll(async () => {
    await prisma.wasteListing.deleteMany({
      where: { seller: { phone: { in: [sellerPhone, otherPhone] } } },
    });
    await prisma.location.deleteMany({
      where: { user: { phone: { in: [sellerPhone, otherPhone] } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { phone: { in: [sellerPhone, otherPhone] } } },
    });
    await prisma.user.deleteMany({
      where: { phone: { in: [sellerPhone, otherPhone] } },
    });
    await app.close();
  });

  it('rejects creating a listing with a location owned by someone else', async () => {
    const otherLocationRes = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ label: "Other's place" })
      .expect(201);

    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        materialId,
        locationId: otherLocationRes.body.id,
        estimatedWeightKg: 5,
        pickupOption: 'flexible',
      })
      .expect(403);
  });

  let listingId: string;

  it('creates a listing as DRAFT', async () => {
    const res = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        materialId,
        locationId,
        estimatedWeightKg: 12.5,
        condition: 'clean, sorted',
        pickupOption: 'collection_required',
        description: 'PET bottles from a household',
      })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    listingId = res.body.id;
  });

  it('does not show a DRAFT listing on the public browse endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/listings')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(
      res.body.find((l: { id: string }) => l.id === listingId),
    ).toBeUndefined();
  });

  it('hides a DRAFT listing detail from a non-owner', async () => {
    await request(app.getHttpServer())
      .get(`/listings/${listingId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('rejects a non-owner publishing the listing', async () => {
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('publishes the listing (DRAFT -> ACTIVE)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('rejects publishing an already-ACTIVE listing', async () => {
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(400);
  });

  it('does not show a freshly-published (not yet admin-approved) listing on browse or to a non-owner', async () => {
    const browseRes = await request(app.getHttpServer())
      .get('/listings')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(browseRes.body.some((l: { id: string }) => l.id === listingId)).toBe(
      false,
    );

    await request(app.getHttpServer())
      .get(`/listings/${listingId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('shows the listing on browse and to a non-owner once admin-approved', async () => {
    // Admin moderation itself is covered by admin.e2e-spec.ts — here we only need the
    // resulting state, so it's set directly rather than standing up an admin session.
    await prisma.wasteListing.update({
      where: { id: listingId },
      data: { moderationStatus: 'APPROVED' },
    });

    const browseRes = await request(app.getHttpServer())
      .get('/listings')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(browseRes.body.some((l: { id: string }) => l.id === listingId)).toBe(
      true,
    );

    const detailRes = await request(app.getHttpServer())
      .get(`/listings/${listingId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(detailRes.body.id).toBe(listingId);
    expect(detailRes.body.material).toBeDefined();
    expect(detailRes.body.location).toBeDefined();
  });

  it('cancels the listing', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/listings/${listingId}/cancel`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('rejects any further transition out of the now-CANCELLED listing', async () => {
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(400);
  });
});
