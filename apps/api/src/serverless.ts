import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessHttp from 'serverless-http';
import express from 'express';
import { createApp } from './create-app';

// Entry point for running the Nest API as a single Netlify Function instead of a
// long-running server. Netlify reuses warm Lambda containers between invocations, so the
// Nest app is bootstrapped once and cached on the module scope rather than per request.
let cachedHandler: ReturnType<typeof serverlessHttp> | undefined;

async function bootstrapHandler() {
  const expressApp = express();
  const app = await createApp(new ExpressAdapter(expressApp));
  await app.init();

  // Netlify invokes this function at /.netlify/functions/api/*, but every existing
  // controller route (e.g. /auth/otp/request) is unprefixed — basePath strips that
  // function-path prefix so Express sees the same paths it would locally, no controller
  // or route changes needed. The matching netlify.toml redirect maps public /api/* traffic
  // to this function path.
  return serverlessHttp(expressApp, { basePath: '/.netlify/functions/api' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handler(event: any, context: any) {
  if (!cachedHandler) {
    cachedHandler = await bootstrapHandler();
  }
  return cachedHandler(event, context);
}
