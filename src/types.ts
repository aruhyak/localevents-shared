/**
 * The four kinds of post, as designed in architecture.html.
 *
 * These are NOT four categories on one form — they differ in time shape,
 * how people respond, and whether money moves. A single `posts` table with
 * a `kind` discriminator keeps the feed to one indexed geo query.
 */

export type PostKind = 'event' | 'request' | 'offer';

export type AuthorKind = 'individual' | 'business';

export interface Author {
  id: string;
  displayName: string;
  avatarUrl?: string;
  kind: AuthorKind;
  /** Business verified badge — set by admin only, never client-settable. */
  verified: boolean;
  /** Government ID checked via Stripe Identity / Persona. Documents are never stored. */
  idVerified: boolean;
}

export interface BasePost {
  id: string;
  kind: PostKind;
  title: string;
  description: string;
  lat: number;
  lng: number;
  neighbourhood: string;
  imageUrl?: string;
  author: Author;
  createdAt: string;
  status: 'published' | 'draft' | 'flagged' | 'closed';
}

/* ── events ─────────────────────────────────────────────────────────────── */

export type EventCategory =
  | 'music' | 'sport' | 'market' | 'food' | 'community' | 'kids' | 'class';

export interface EventPost extends BasePost {
  kind: 'event';
  /** A single occurrence. Recurring events expand into many of these. */
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  category: EventCategory;
  /** iCal RRULE — business events repeat, community ones rarely do. */
  rrule?: string;
  ticketUrl?: string;
  price?: number;
  rsvpCount: number;
}

/* ── requests ───────────────────────────────────────────────────────────── */

export type ServiceType = 'petcare' | 'handyman' | 'other';

export type ClaimState = 'open' | 'claimed' | 'done';

export interface RequestPost extends BasePost {
  kind: 'request';
  serviceType: ServiceType;
  /** A date RANGE, not a start time — this is what separates it from an event. */
  neededFrom: string;
  neededTo: string;
  budget?: number;
  /** Exactly one person claims a request. Not an RSVP. */
  claimState: ClaimState;
  claimedBy?: string;
  /**
   * Someone entering your home while you're away is a different risk from
   * turning up to a pickup game. This flag gates ID verification.
   */
  requiresHomeAccess: boolean;
}

/* ── offers ─────────────────────────────────────────────────────────────── */

export type Trade =
  | 'lawn' | 'cleaning' | 'gutters' | 'hauling' | 'painting' | 'handyman'
  | 'electrical' | 'plumbing' | 'hvac' | 'gas';

/**
 * Electrical, plumbing, HVAC and gas require a trade licence in nearly every
 * US state, regardless of job size — there is no small-job exemption.
 * Listings in these trades are GATED, not merely warned about (see SB 378).
 */
export const LICENCE_REQUIRED_TRADES: readonly Trade[] = [
  'electrical', 'plumbing', 'hvac', 'gas',
] as const;

export function requiresLicence(trades: readonly Trade[]): boolean {
  return trades.some((t) => LICENCE_REQUIRED_TRADES.includes(t));
}

export interface Licence {
  number: string;
  /** Two-letter state code — licences are issued per state. */
  state: string;
  verified: boolean;
  verifiedAt?: string;
}

export interface OfferPost extends BasePost {
  kind: 'offer';
  trades: Trade[];
  rate?: number;
  rateUnit?: 'hour' | 'job' | 'visit';
  /** Free text for now: "weekends", "evenings after 5". */
  availability: string;
  /** Required when any trade is licence-gated. Absent otherwise. */
  licence?: Licence;
}

export type Post = EventPost | RequestPost | OfferPost;

/* ── feed ───────────────────────────────────────────────────────────────── */

export interface FeedItem {
  post: Post;
  /** Kilometres from the viewer, computed by the nearby query. */
  distanceKm: number;
}

export interface FeedQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  kinds?: PostKind[];
  from?: string;
}

/* ── type guards ────────────────────────────────────────────────────────── */

export const isEvent = (p: Post): p is EventPost => p.kind === 'event';
export const isRequest = (p: Post): p is RequestPost => p.kind === 'request';
export const isOffer = (p: Post): p is OfferPost => p.kind === 'offer';

/**
 * A listing is publishable only if every licence-gated trade it claims has a
 * verified licence. Enforced again in the BFF — this is the client-side mirror.
 */
export function offerIsPublishable(offer: OfferPost): boolean {
  if (!requiresLicence(offer.trades)) return true;
  return offer.licence?.verified === true;
}
