// Pings the API every 5 minutes so a warm instance (Nest booted, database connection open)
// is usually ready — otherwise the first visitor after an idle spell pays a multi-second
// cold start. The changing query string bypasses the CDN cache so the API function runs.
export default async () => {
  const base = process.env.URL ?? 'https://cycloo.netlify.app';
  try {
    await fetch(`${base}/api/listings?warm=${Date.now()}`);
  } catch {
    // A missed ping is harmless; the next one runs in 5 minutes.
  }
  return new Response('ok');
};

export const config = { schedule: '*/5 * * * *' };
