import type {
  Author, EventPost, FeedItem, FeedQuery, OfferPost, Post, RequestPost,
} from './types.js';
import { haversineKm } from './geo.js';

/**
 * Phase 1 data. Replaced in phase 2 by the BFF talking to Postgres.
 *
 * Deliberately mixed: a feed of only community posts looks dead, while the
 * same feed carrying the pub's trivia night, two lawn-care offers and a
 * cat-sitting request looks alive. That mix is what carries the cold start.
 */

/** Placeholder centre — swap for your own neighbourhood. */
export const HOME = { lat: 30.2672, lng: -97.7431, label: 'Bouldin Creek' };

/** Offset in km, converted to rough lat/lng deltas. */
const near = (northKm: number, eastKm: number) => ({
  lat: HOME.lat + northKm / 111,
  lng: HOME.lng + eastKm / (111 * Math.cos((HOME.lat * Math.PI) / 180)),
});

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/* ── authors ────────────────────────────────────────────────────────────── */

const person = (id: string, displayName: string, idVerified = false): Author => ({
  id, displayName, kind: 'individual', verified: false, idVerified,
});

const venue = (id: string, displayName: string, verified = true): Author => ({
  id, displayName, kind: 'business', verified, idVerified: false,
});

const A = {
  maya: person('u1', 'Maya R.'),
  devin: person('u2', 'Devin O.'),
  priya: person('u3', 'Priya S.', true),
  tomas: person('u4', 'Tomás L.', true),
  jen: person('u5', 'Jen W.'),
  carl: person('u6', 'Carl B.', true),
  rosa: person('u7', 'Rosa M.', true),
  ig: person('u8', 'Ignacio F.'),
  pub: venue('b1', 'The Draughtsman'),
  market: venue('b2', 'Bouldin Farmers Market'),
  cafe: venue('b3', 'Little Bird Coffee'),
  studio: venue('b4', 'Second Street Studio', false),
};

/* ── events ─────────────────────────────────────────────────────────────── */

const events: EventPost[] = [
  {
    id: 'e1', kind: 'event', status: 'published',
    title: 'Pickup basketball at Zilker',
    description: 'Casual run, all levels. We usually get 8–10 people. Bring a light and a dark shirt.',
    ...near(0.6, 0.4), neighbourhood: 'Zilker',
    author: A.devin, createdAt: daysFromNow(-2),
    startsAt: hoursFromNow(5), category: 'sport', rsvpCount: 7,
  },
  {
    id: 'e2', kind: 'event', status: 'published',
    title: 'Tuesday quiz night',
    description: 'Six rounds, teams up to six. £2 a head, winner takes the pot. Kitchen open till 9.',
    ...near(-0.3, 0.8), neighbourhood: 'Bouldin Creek', venueName: 'The Draughtsman',
    author: A.pub, createdAt: daysFromNow(-30),
    startsAt: hoursFromNow(27), category: 'community', rsvpCount: 24,
    rrule: 'FREQ=WEEKLY;BYDAY=TU',
  },
  {
    id: 'e3', kind: 'event', status: 'published',
    title: 'Saturday farmers market',
    description: 'Thirty stalls — produce, bread, cheese, coffee. Dog friendly, cash and card.',
    ...near(1.1, -0.5), neighbourhood: 'Bouldin Creek', venueName: 'Bouldin Farmers Market',
    author: A.market, createdAt: daysFromNow(-60),
    startsAt: daysFromNow(3), category: 'market', rsvpCount: 89,
    rrule: 'FREQ=WEEKLY;BYDAY=SA',
  },
  {
    id: 'e4', kind: 'event', status: 'published',
    title: 'Garage sale — moving out',
    description: 'Furniture, kitchen stuff, a lot of books, one very good armchair. Early birds welcome.',
    ...near(-0.8, -0.2), neighbourhood: 'Bouldin Creek',
    author: A.jen, createdAt: daysFromNow(-1),
    startsAt: daysFromNow(2), category: 'community', rsvpCount: 3,
  },
  {
    id: 'e5', kind: 'event', status: 'published',
    title: 'Open mic — sign up from 7',
    description: 'Eight slots, ten minutes each. Piano and two mics provided. No cover.',
    ...near(0.2, 1.4), neighbourhood: 'South Lamar', venueName: 'Little Bird Coffee',
    author: A.cafe, createdAt: daysFromNow(-14),
    startsAt: hoursFromNow(52), category: 'music', rsvpCount: 12,
    rrule: 'FREQ=WEEKLY;BYDAY=TH',
  },
  {
    id: 'e6', kind: 'event', status: 'published',
    title: 'Sunday morning run club',
    description: '5k loop along the river at a conversational pace. Coffee after, no one gets dropped.',
    ...near(1.6, 0.9), neighbourhood: 'Barton Springs',
    author: A.maya, createdAt: daysFromNow(-9),
    startsAt: daysFromNow(4), category: 'sport', rsvpCount: 15,
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
  },
  {
    id: 'e7', kind: 'event', status: 'published',
    title: 'Beginners pottery — two places left',
    description: 'Three hours on the wheel, clay and firing included. Aprons provided, wear old clothes.',
    ...near(-1.4, 1.1), neighbourhood: 'South Lamar', venueName: 'Second Street Studio',
    author: A.studio, createdAt: daysFromNow(-6),
    startsAt: daysFromNow(5), category: 'class', rsvpCount: 6,
    price: 45, ticketUrl: 'https://example.com/pottery',
  },
];

/* ── requests ───────────────────────────────────────────────────────────── */

const requests: RequestPost[] = [
  {
    id: 'r1', kind: 'request', status: 'published',
    title: 'Feed my cat while we\'re away',
    description: 'One indoor cat, very easy. Dry food twice a day and a litter change. Keys with the neighbour.',
    ...near(0.4, -0.6), neighbourhood: 'Bouldin Creek',
    author: A.priya, createdAt: daysFromNow(-1),
    serviceType: 'petcare',
    neededFrom: daysFromNow(6), neededTo: daysFromNow(13),
    budget: 120, claimState: 'open', requiresHomeAccess: true,
  },
  {
    id: 'r2', kind: 'request', status: 'published',
    title: 'Dog walk, weekday lunchtimes',
    description: 'Friendly lab, needs 30 minutes around midday while I\'m back in the office. Ongoing if it works out.',
    ...near(-0.5, 0.3), neighbourhood: 'Bouldin Creek',
    author: A.tomas, createdAt: hoursFromNow(-6),
    serviceType: 'petcare',
    neededFrom: daysFromNow(2), neededTo: daysFromNow(30),
    budget: 20, claimState: 'open', requiresHomeAccess: true,
  },
  {
    id: 'r3', kind: 'request', status: 'published',
    title: 'Help shifting a sofa on Saturday',
    description: 'Second floor, no lift. Two people, half an hour of work. I have the van.',
    ...near(0.9, 0.2), neighbourhood: 'Zilker',
    author: A.jen, createdAt: hoursFromNow(-20),
    serviceType: 'handyman',
    neededFrom: daysFromNow(3), neededTo: daysFromNow(3),
    budget: 60, claimState: 'claimed', claimedBy: 'u6', requiresHomeAccess: false,
  },
  {
    id: 'r4', kind: 'request', status: 'published',
    title: 'Lawn needs cutting — one off',
    description: 'Small front and back, hasn\'t been done in a month. Happy to pay for the clippings to go too.',
    ...near(-1.1, -0.9), neighbourhood: 'South Lamar',
    author: A.maya, createdAt: daysFromNow(-3),
    serviceType: 'handyman',
    neededFrom: daysFromNow(1), neededTo: daysFromNow(7),
    budget: 70, claimState: 'open', requiresHomeAccess: false,
  },
];

/* ── offers ─────────────────────────────────────────────────────────────── */

const offers: OfferPost[] = [
  {
    id: 'o1', kind: 'offer', status: 'published',
    title: 'Lawn and yard work, weekends',
    description: 'I do this around my main job. Mowing, edging, leaf clearing. I bring my own kit.',
    ...near(0.7, -1.2), neighbourhood: 'Bouldin Creek',
    author: A.carl, createdAt: daysFromNow(-45),
    trades: ['lawn', 'gutters'], rate: 45, rateUnit: 'visit',
    availability: 'Saturdays and Sunday mornings',
  },
  {
    id: 'o2', kind: 'offer', status: 'published',
    title: 'House cleaning — regular or one off',
    description: 'Fifteen years doing this. References from four families on this street.',
    ...near(-0.2, -1.5), neighbourhood: 'Bouldin Creek',
    author: A.rosa, createdAt: daysFromNow(-90),
    trades: ['cleaning'], rate: 35, rateUnit: 'hour',
    availability: 'Weekday daytimes',
  },
  {
    id: 'o3', kind: 'offer', status: 'published',
    title: 'Licensed electrician — evenings and weekends',
    description: 'Outlets, fixtures, panel work, EV chargers. Permits pulled where required.',
    ...near(1.3, 0.6), neighbourhood: 'Zilker',
    author: A.ig, createdAt: daysFromNow(-20),
    trades: ['electrical'], rate: 95, rateUnit: 'hour',
    availability: 'After 5pm, all day Saturday',
    licence: { number: 'TECL-38217', state: 'TX', verified: true, verifiedAt: daysFromNow(-18) },
  },
  {
    id: 'o4', kind: 'offer', status: 'draft',
    title: 'Plumbing — small jobs',
    description: 'Taps, traps, running toilets. Awaiting licence verification before this goes live.',
    ...near(-1.6, 0.4), neighbourhood: 'South Lamar',
    author: A.devin, createdAt: hoursFromNow(-3),
    trades: ['plumbing'], rate: 80, rateUnit: 'hour',
    availability: 'Evenings',
    licence: { number: 'RMP-00000', state: 'TX', verified: false },
  },
  {
    id: 'o5', kind: 'offer', status: 'published',
    title: 'General handyman — shelves, doors, flat pack',
    description: 'Small repairs under $500. No electrical or plumbing — I\'ll tell you who to call for those.',
    ...near(0.1, 1.8), neighbourhood: 'South Lamar',
    author: A.carl, createdAt: daysFromNow(-30),
    trades: ['handyman', 'painting'], rate: 55, rateUnit: 'hour',
    availability: 'Most evenings, weekends by arrangement',
  },
];

export const ALL_POSTS: Post[] = [...events, ...requests, ...offers];

/**
 * Stand-in for `events_nearby(lat, lng, radius, from)`.
 * Same contract as the RPC it will become: radius filter, then sort.
 */
export function nearby(q: FeedQuery, posts: Post[] = ALL_POSTS): FeedItem[] {
  const kinds = q.kinds;
  return posts
    .filter((p) => p.status === 'published')
    .filter((p) => !kinds?.length || kinds.includes(p.kind))
    .map((post) => ({
      post,
      distanceKm: haversineKm(q.lat, q.lng, post.lat, post.lng),
    }))
    .filter((i) => i.distanceKm <= q.radiusKm)
    .sort((a, b) => sortKey(a) - sortKey(b));
}

/** Soonest first for time-bound posts; offers are standing, so rank by distance. */
function sortKey(item: FeedItem): number {
  const p = item.post;
  if (p.kind === 'event') return new Date(p.startsAt).getTime();
  if (p.kind === 'request') return new Date(p.neededFrom).getTime();
  return Date.now() + item.distanceKm * 86_400_000;
}
