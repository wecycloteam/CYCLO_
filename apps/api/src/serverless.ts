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

  // serverless-http reconstructs the request from the Lambda event by pre-populating
  // req.body with the raw bytes as a Buffer *and* ending the underlying stream — so any
  // stream-reading body-parser (express.json(), Nest's own default) finds an
  // already-drained stream and silently leaves req.body as that raw Buffer instead of
  // parsing it. That Buffer, handed to class-validator as if it were the DTO, gets
  // iterated index-by-index ("property 0 should not exist", "property 1 should not
  // exist", ...) instead of validated — every JSON POST was broken in production this
  // way. Parsing the Buffer directly, instead of asking a stream-based parser to re-read
  // an already-consumed stream, is what actually needs to happen here.
  expressApp.use((req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8');
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    }
    next();
  });

  // Public, identical-for-everyone GET responses are cached on Netlify's CDN so repeat
  // visitors skip the function (and the cross-region database round trips) entirely.
  // Browsers always revalidate; the CDN serves for 60s, then refreshes in the background.
  const CDN_CACHEABLE = new Set(['/listings', '/waste-prices', '/waste-materials', '/public-stats/landing']);
  expressApp.use((req, res, next) => {
    if (req.method === 'GET' && CDN_CACHEABLE.has(req.path)) {
      res.setHeader('Netlify-CDN-Cache-Control', 'public, durable, s-maxage=60, stale-while-revalidate=600');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
    next();
  });

  const app = await createApp(new ExpressAdapter(expressApp), { bodyParser: false });
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
