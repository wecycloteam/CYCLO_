// §23 — human-readable reference like CYCLO-DAR-0001842. Region/format is configurable
// per §67 (never hardcode Tanzania/Arusha) — region comes from the pickup location's
// `region` field, not a literal. Sequence is currently derived from a same-region
// transaction count at call time; under concurrent writes two requests could in principle
// read the same count before either commits (SQLite's default transaction isolation makes
// this a narrow window, not eliminated) — acceptable for MVP dev-scale, flagged here as a
// known limitation a dedicated per-region sequence table should replace before production
// concurrency matters.
const REFERENCE_PAD_LENGTH = 7;
const DEFAULT_REGION_CODE = 'GEN';

export function regionCode(region: string | null | undefined): string {
  if (!region || region.trim().length === 0) return DEFAULT_REGION_CODE;
  return region.trim().slice(0, 3).toUpperCase();
}

export function buildTransactionReference(region: string | null | undefined, sequence: number): string {
  const code = regionCode(region);
  const padded = String(sequence).padStart(REFERENCE_PAD_LENGTH, '0');
  return `CYCLO-${code}-${padded}`;
}
