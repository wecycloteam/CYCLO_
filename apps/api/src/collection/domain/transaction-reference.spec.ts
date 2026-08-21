import { buildTransactionReference, regionCode } from './transaction-reference';

describe('transaction reference (§23)', () => {
  it('derives a 3-letter region code and zero-pads the sequence', () => {
    expect(buildTransactionReference('Arusha', 1842)).toBe('CYCLO-ARU-0001842');
  });

  it('falls back to GEN when no region is set', () => {
    expect(regionCode(null)).toBe('GEN');
    expect(regionCode(undefined)).toBe('GEN');
    expect(regionCode('')).toBe('GEN');
    expect(buildTransactionReference(undefined, 1)).toBe('CYCLO-GEN-0000001');
  });

  it('uppercases and truncates a longer region name', () => {
    expect(regionCode('dar es salaam')).toBe('DAR');
  });
});
