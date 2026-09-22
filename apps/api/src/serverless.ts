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

  // The netlify.toml `/api/* -> /.netlify/functions/api/:splat` rule is a rewrite (status
  // 200), and Netlify's rewrites preserve the *original* request path in the Lambda
  // event — event.path is still "/api/whatever", never the rewritten
  // "/.netlify/functions/api/whatever" the `to:` target implies. Every controller route
  // (e.g. /auth/otp/request) is unprefixed, so basePath must strip "/api" — the prefix
  // real traffic (NEXT_PUBLIC_API_URL=/api in the web build) actually arrives with — not
  // the function's own invocation path, which no real request path ever carries.
  return serverlessHttp(expressApp, { basePath: '/api' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handler(event: any, context: any) {
  if (!cachedHandler) {
    cachedHandler = await bootstrapHandler();
  }
  return cachedHandler(event, context);
}
