// Accepts either the full E.164 form (+255712345678) or the local form a Tanzanian user
// would actually type (0712345678) and always normalizes to E.164 — the single format
// stored in the database and shown back in the UI. Any other shape is left untouched so
// the DTO's own @Matches(E164) validator still rejects it with a clear message, rather
// than this function silently producing garbage.
export function normalizeTanzanianPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^0\d{9}$/.test(trimmed)) {
    return `+255${trimmed.slice(1)}`;
  }
  if (/^255\d{9}$/.test(trimmed)) {
    return `+${trimmed}`;
  }
  return trimmed;
}
