import { assertValidPickupTransition } from './pickup-state-machine';

describe('pickup state machine (§20)', () => {
  it('allows the full happy path', () => {
    const path: Array<[string, string]> = [
      ['CREATED', 'MATCHING'],
      ['MATCHING', 'ACCEPTED'],
      ['ACCEPTED', 'EN_ROUTE'],
      ['EN_ROUTE', 'ARRIVED'],
      ['ARRIVED', 'COLLECTING'],
      ['COLLECTING', 'WEIGHED'],
      ['WEIGHED', 'COMPLETED'],
    ];
    for (const [from, to] of path) {
      expect(() =>
        assertValidPickupTransition(from as never, to as never),
      ).not.toThrow();
    }
  });

  it('rejects skipping straight from CREATED to COMPLETED', () => {
    expect(() => assertValidPickupTransition('CREATED', 'COMPLETED')).toThrow();
  });

  it('rejects skipping verification (COLLECTING -> COMPLETED)', () => {
    expect(() => assertValidPickupTransition('COLLECTING', 'COMPLETED')).toThrow();
  });

  it('rejects any transition out of a terminal state', () => {
    expect(() => assertValidPickupTransition('CANCELLED', 'MATCHING')).toThrow();
    expect(() => assertValidPickupTransition('COMPLETED', 'MATCHING')).toThrow();
  });

  it('allows cancellation from every state prior to WEIGHED', () => {
    for (const from of ['CREATED', 'MATCHING', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'COLLECTING'] as const) {
      expect(() => assertValidPickupTransition(from, 'CANCELLED')).not.toThrow();
    }
  });

  it('rejects cancelling after WEIGHED', () => {
    expect(() => assertValidPickupTransition('WEIGHED', 'CANCELLED')).toThrow();
  });
});
