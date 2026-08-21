import { assertValidListingTransition } from './listing-state-machine';

describe('listing state machine (§15)', () => {
  it('allows the happy path DRAFT -> ACTIVE -> RESERVED -> SOLD -> COLLECTED', () => {
    expect(() => assertValidListingTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() =>
      assertValidListingTransition('ACTIVE', 'RESERVED'),
    ).not.toThrow();
    expect(() =>
      assertValidListingTransition('RESERVED', 'SOLD'),
    ).not.toThrow();
    expect(() =>
      assertValidListingTransition('SOLD', 'COLLECTED'),
    ).not.toThrow();
  });

  it('allows cancellation from every non-terminal state', () => {
    for (const from of [
      'DRAFT',
      'ACTIVE',
      'OFFER_RECEIVED',
      'NEGOTIATION',
      'RESERVED',
    ] as const) {
      expect(() =>
        assertValidListingTransition(from, 'CANCELLED'),
      ).not.toThrow();
    }
  });

  it('rejects skipping straight from DRAFT to SOLD', () => {
    expect(() => assertValidListingTransition('DRAFT', 'SOLD')).toThrow();
  });

  it('rejects skipping straight from CREATED-equivalent ACTIVE to COLLECTED', () => {
    expect(() => assertValidListingTransition('ACTIVE', 'COLLECTED')).toThrow();
  });

  it('rejects any transition out of a terminal state', () => {
    expect(() => assertValidListingTransition('CANCELLED', 'ACTIVE')).toThrow();
    expect(() => assertValidListingTransition('EXPIRED', 'ACTIVE')).toThrow();
  });

  it('rejects re-activating a SOLD listing', () => {
    expect(() => assertValidListingTransition('SOLD', 'ACTIVE')).toThrow();
  });
});
