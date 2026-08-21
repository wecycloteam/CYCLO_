import { BadRequestException } from '@nestjs/common';
import { canTransitionPickup, PickupStatus } from '@cyclo/shared-types';

// The single gate every status write on PickupRequest must pass through (§20 — explicit
// state machine; e.g. CREATED -> COMPLETED is rejected regardless of what the client sends).
export function assertValidPickupTransition(from: PickupStatus, to: PickupStatus): void {
  if (!canTransitionPickup(from, to)) {
    throw new BadRequestException(`Cannot move a pickup request from ${from} to ${to}.`);
  }
}
