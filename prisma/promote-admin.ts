// Dev-only admin bootstrap. Run: npm run admin:promote -- +255700000000
//
// Deliberately NOT an HTTP endpoint and NOT reachable through self-registration —
// VerifyOtpDto already blocks 'admin'/'authority' at signup (see auth.service.ts).
// The only way to get an admin account is: sign up normally through the app (any
// self-registerable role), then a developer with direct database access runs this
// script to promote that existing account. This matches the master prompt's rule that
// admin credentials/secrets never live in frontend code or an API surface (§37/§30).
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: npm run admin:promote -- +255700000000');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.error(`No user found with phone ${phone}. Sign up through the app first, then re-run this.`);
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`${user.name} (${phone}) is already an admin.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  console.log(`${user.name} (${phone}) promoted from '${user.role}' to 'admin'.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
