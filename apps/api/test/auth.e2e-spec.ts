import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SMS_PROVIDER } from '../src/sms/sms-provider.interface';
import { PrismaService } from '../src/prisma/prisma.service';

// Captures OTP codes instead of sending anything, so the test can read the
// real code the same way a client would ("received an SMS"), not by reaching
// into the database.
class CapturingSmsProvider {
  public lastCode: string | null = null;
  async sendOtp(_phone: string, code: string) {
    this.lastCode = code;
  }
}

describe('Auth (e2e) — the phone+OTP loop backing Phase 1 (auth, roles, profile)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms = new CapturingSmsProvider();
  const phone = '+255700111222';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // Leave the dev database as it was found.
    await prisma.user.deleteMany({ where: { phone } });
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    await app.close();
  });

  it('rejects a malformed phone number', async () => {
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone: 'not-a-phone' })
      .expect(400);
  });

  it('rejects verification when no code was requested', async () => {
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(400);
  });

  it('completes the request → verify → authenticated profile loop', async () => {
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone }).expect(201);

    expect(sms.lastCode).toMatch(/^\d{6}$/);

    // Wrong code is rejected without consuming the real one.
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: '111111' })
      .expect(400);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode, name: 'E2E Test User' })
      .expect(201);

    expect(verifyRes.body.accessToken).toEqual(expect.any(String));
    expect(verifyRes.body.refreshToken).toEqual(expect.any(String));

    // The same code cannot be replayed.
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode })
      .expect(400);

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body).toMatchObject({ phone, name: 'E2E Test User', role: 'household' });
    expect(meRes.body.passwordHash).toBeUndefined();

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: verifyRes.body.refreshToken })
      .expect(201);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));

    // The rotated-out refresh token can no longer be used.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: verifyRes.body.refreshToken })
      .expect(401);
  });

  it('rejects /users/me without a token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
