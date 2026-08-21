import { BadRequestException } from '@nestjs/common';
import { canTransitionListing, ListingStatus } from '@cyclo/shared-types';

// The single gate every status write on WasteListing must pass through (§15 — explicit
// state machine, invalid transitions rejected server-side regardless of what the client
// sends). MarketplaceService must never assign `.status` directly outside this function.
export function assertValidListingTransition(
  from: ListingStatus,
  to: ListingStatus,
): void {
  if (!canTransitionListing(from, to)) {
    throw new BadRequestException(
      `Cannot move a listing from ${from} to ${to}.`,
    );
  }
}
