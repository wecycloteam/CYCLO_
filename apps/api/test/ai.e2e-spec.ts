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

// A 1x1 transparent PNG, small enough to exercise the real validation path (§44) without
// needing an actual photo — the mock classifier never looks at the pixels anyway (§11).
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('AI (e2e) — waste scanning (§11-§13, mock classifier)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms = new CapturingSmsProvider();
  const phone = '+255700444001';
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone }).expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: sms.lastCode, name: 'AI E2E User', role: 'household' })
      .expect(201);
    token = verifyRes.body.accessToken;
  });

  afterAll(async () => {
    await prisma.aiScan.deleteMany({ where: { user: { phone } } });
    await prisma.refreshToken.deleteMany({ where: { user: { phone } } });
    await prisma.user.deleteMany({ where: { phone } });
    await app.close();
  });

  it('rejects a scan request without an image', async () => {
    await request(app.getHttpServer()).post('/ai/scan').set('Authorization', `Bearer ${token}`).send({}).expect(400);
  });

  it('rejects a non-image-data-url payload', async () => {
    await request(app.getHttpServer())
      .post('/ai/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ imageBase64: 'not-an-image' })
      .expect(400);
  });

  let scanId: string;
  let suggestedMaterialId: string;

  it('classifies an image and honestly marks the result as mock', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ imageBase64: TINY_PNG_DATA_URL })
      .expect(201);

    expect(res.body.scanId).toEqual(expect.any(String));
    expect(res.body.result.mock).toBe(true);
    expect(res.body.result.confidence).toBeGreaterThan(0);
    expect(res.body.result.confidence).toBeLessThanOrEqual(1);
    expect(res.body.suggestedMaterialId).toEqual(expect.any(String));

    scanId = res.body.scanId;
    suggestedMaterialId = res.body.suggestedMaterialId;
  });

  it('rejects confirming a scan that is not yours', async () => {
    const otherPhone = '+255700444002';
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: otherPhone }).expect(201);
    const otherRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: otherPhone, code: sms.lastCode, name: 'Other', role: 'household' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/ai/scans/${scanId}/confirm`)
      .set('Authorization', `Bearer ${otherRes.body.accessToken}`)
      .send({ finalMaterialId: suggestedMaterialId })
      .expect(403);

    await prisma.refreshToken.deleteMany({ where: { user: { phone: otherPhone } } });
    await prisma.user.deleteMany({ where: { phone: otherPhone } });
  });

  it('confirms the scan with the suggested material, marking the AI result as accepted', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/ai/scans/${scanId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ finalMaterialId: suggestedMaterialId })
      .expect(200);

    expect(res.body.finalMaterialId).toBe(suggestedMaterialId);
    expect(res.body.acceptedResult).toBe(true);
  });

  it('records a scan history entry with the confirmed material', async () => {
    const res = await request(app.getHttpServer()).get('/ai/scans').set('Authorization', `Bearer ${token}`).expect(200);
    const entry = res.body.find((s: { id: string }) => s.id === scanId);
    expect(entry).toBeDefined();
    expect(entry.finalMaterial.id).toBe(suggestedMaterialId);
  });

  it('records acceptedResult=false when the user overrides the AI suggestion with a different material', async () => {
    const scanRes = await request(app.getHttpServer())
      .post('/ai/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ imageBase64: TINY_PNG_DATA_URL })
      .expect(201);

    const otherMaterial = await prisma.wasteMaterial.findFirst({
      where: { active: true, id: { not: scanRes.body.suggestedMaterialId } },
    });
    if (!otherMaterial) throw new Error('Test requires at least 2 seeded WasteMaterials.');

    const confirmRes = await request(app.getHttpServer())
      .patch(`/ai/scans/${scanRes.body.scanId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ finalMaterialId: otherMaterial.id })
      .expect(200);

    expect(confirmRes.body.acceptedResult).toBe(false);
  });
});
