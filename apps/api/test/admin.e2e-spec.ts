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

// Covers the admin foundation: bootstrap-only promotion (never self-registration),
// dashboard counts, the user/org verification queue, and listing moderation gating the
// public marketplace (§14/§15 of the moderation spec).
describe('Admin (e2e) — moderation and access control', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms = new CapturingSmsProvider();
  const adminPhone = '+255700999001';
  const collectorPhone = '+255700999002';
  const sellerPhone = '+255700999003';
  const orgOwnerPhone = '+255700999004';
  let adminToken: string;
  let collectorToken: string;
  let sellerToken: string;
  let collectorUserId: string;
  let orgOwnerUserId: string;
  let materialId: string;
  // Kept under 5 live OTP requests total (beforeAll does admin signup+repromote-relogin,
  // collector, seller = 4) to stay under the OTP endpoint's 5-per-60s throttle (§42) —
  // the org owner is seeded directly via Prisma since no token is needed for it.
  const phonesToClean = [
    adminPhone,
    collectorPhone,
    sellerPhone,
    orgOwnerPhone,
  ];

  async function loginAsNewUser(
    phone: string,
    role: string,
  ): Promise<{ token: string; userId: string }> {
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone })
      .expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode, name: 'Admin E2E User', role })
      .expect(201);
    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`)
      .expect(200);
    return { token: verifyRes.body.accessToken, userId: meRes.body.id };
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

    const { token: adminSignupToken, userId: adminUserId } =
      await loginAsNewUser(adminPhone, 'household');
    // Mirrors prisma/promote-admin.ts — the only real way to get an admin account is a
    // direct DB promotion of an already-signed-up user, never self-registration.
    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'admin' },
    });
    // Re-issue a token so its embedded role claim reflects the promotion.
    const relogin = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone: adminPhone })
      .expect(201);
    void relogin;
    const reVerify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: adminPhone, code: sms.lastCode })
      .expect(201);
    adminToken = reVerify.body.accessToken;
    void adminSignupToken;

    const collector = await loginAsNewUser(collectorPhone, 'collector');
    collectorToken = collector.token;
    collectorUserId = collector.userId;

    const seller = await loginAsNewUser(sellerPhone, 'household');
    sellerToken = seller.token;

    // Seeded directly — no token needed for this one, and every extra OTP round trip
    // eats into the endpoint's 5-per-60s throttle (§42).
    const orgOwner = await prisma.user.create({
      data: { phone: orgOwnerPhone, name: 'Org Owner', role: 'business' },
    });
    orgOwnerUserId = orgOwner.id;

    await prisma.organization.create({
      data: {
        type: 'business',
        name: 'Test Recycling Co',
        ownerUserId: orgOwnerUserId,
        verificationStatus: 'pending',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: await adminIds() } },
    });
    await prisma.organization.deleteMany({
      where: { ownerUserId: orgOwnerUserId },
    });
    await prisma.wasteListing.deleteMany({
      where: { seller: { phone: { in: phonesToClean } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { phone: { in: phonesToClean } } },
    });
    await prisma.user.deleteMany({ where: { phone: { in: phonesToClean } } });
    await app.close();
  });

  async function adminIds() {
    const admins = await prisma.user.findMany({
      where: { phone: adminPhone },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }

  it('rejects a non-admin from every admin route', async () => {
    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/users/pending')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/listings/pending')
      .set('Authorization', `Bearer ${collectorToken}`)
      .expect(403);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/admin/dashboard').expect(401);
  });

  it('returns dashboard counts to an admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(5);
    expect(res.body.collectorsByVerificationStatus).toBeDefined();
    expect(res.body.organizationsByVerificationStatus).toBeDefined();
  });

  it('lists the pending collector and organization', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/users/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      res.body.pendingCollectors.some(
        (c: { userId: string }) => c.userId === collectorUserId,
      ),
    ).toBe(true);
    expect(
      res.body.pendingOrganizations.some(
        (o: { ownerUserId: string }) => o.ownerUserId === orgOwnerUserId,
      ),
    ).toBe(true);
  });

  it('verifies the collector and writes an audit log entry', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/collectors/${collectorUserId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.verificationStatus).toBe('verified');

    const activity = await request(app.getHttpServer())
      .get('/admin/activity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      activity.body.some(
        (a: { action: string; targetId: string }) =>
          a.action === 'COLLECTOR_VERIFIED' && a.targetId === collectorUserId,
      ),
    ).toBe(true);
  });

  it('rejects verifying a collector profile that does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/admin/collectors/00000000-0000-0000-0000-000000000000/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  let listingId: string;

  it('sets up a published-but-unapproved listing from the seller', async () => {
    const locationRes = await request(app.getHttpServer())
      .post('/locations')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ label: 'Home' })
      .expect(201);

    const listingRes = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        materialId,
        locationId: locationRes.body.id,
        estimatedWeightKg: 8,
        pickupOption: 'flexible',
      })
      .expect(201);
    listingId = listingRes.body.id;

    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
  });

  it('shows the pending listing in the admin queue with seller identity', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/listings/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const found = res.body.find((l: { id: string }) => l.id === listingId);
    expect(found).toBeDefined();
    expect(found.seller.phone).toBe(sellerPhone);
    expect(found.seller.role).toBe('household');
  });

  it('rejects the listing with a reason, cancelling it', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/listings/${listingId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Description too vague' })
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.moderationStatus).toBe('REJECTED');
    expect(res.body.moderationReason).toBe('Description too vague');
  });

  it('rejects re-reviewing an already-reviewed listing', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/listings/${listingId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
