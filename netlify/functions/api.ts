// Thin wrapper Netlify actually loads. It requires the *compiled* Nest output
// (apps/api/dist/serverless.js, built by `nest build` before this function is bundled)
// rather than the TypeScript source — esbuild (Netlify's function bundler) doesn't run a
// full type-checking pass, so it can't emit the design-time decorator metadata Nest's
// dependency injection relies on. tsc already did that correctly at build time; this file
// just re-exports the result.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handler } = require('../../apps/api/dist/serverless');

export { handler };
