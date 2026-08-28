import type {
  Author, EventPost, FeedItem, FeedQuery, OfferPost, Post, RequestPost,
} from './types.js';
import { lifecycle } from './types.js';
import { haversineKm } from './geo.js';

/**
 * Phase 1 data. Replaced in phase 2 by the BFF talking to Postgres.
 *
 * Set in and around Downingtown, PA — the trial neighbourhood. Deliberately
 * mixed: a feed of only community posts looks dead, while the same feed
 * carrying the brewery's quiz night, two lawn-care offers and a cat-sitting
 * request looks alive. That mix is what carries the cold start.
 */

export const HOME = { lat: 40.0161, lng: -75.7183, label: 'Downingtown' };

/** Offset in km from HOME, converted to rough lat/lng deltas. */
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
  brew: venue('b1', 'Victory Brewing Co.'),
  market: venue('b2', 'Downingtown Farmers Market'),
  cafe: venue('b3', 'Bright Side Coffee'),
  studio: venue('b4', 'Brandywine Pottery', false),
};

/* ── events ─────────────────────────────────────────────────────────────── */

const events: EventPost[] = [
  {
    id: 'e1', kind: 'event', status: 'published',
    title: 'Pickup basketball at Kerr Park',
    description: 'Casual run, all levels. We usually get 8–10 people. Bring a light and a dark shirt.',
    ...near(0.5, 0.3), neighbourhood: 'Downingtown',
    author: A.devin, createdAt: daysFromNow(-2),
    startsAt: hoursFromNow(5), category: 'sport', rsvpCount: 7,
  },
  {
    id: 'e2', kind: 'event', status: 'published',
    title: 'Tuesday quiz night',
    description: 'Six rounds, teams up to six. $2 a head, winner takes the pot. Kitchen open till 9.',
    ...near(-0.4, 0.6), neighbourhood: 'Downingtown', venueName: 'Victory Brewing Co.',
    author: A.brew, createdAt: daysFromNow(-30),
    startsAt: hoursFromNow(27), category: 'community', rsvpCount: 24,
    rrule: 'FREQ=WEEKLY;BYDAY=TU',
  },
  {
    id: 'e3', kind: 'event', status: 'published',
    title: 'Saturday farmers market',
    description: 'Thirty stalls — produce, bread, cheese, coffee. Dog friendly, cash and card.',
    ...near(0.9, -0.5), neighbourhood: 'Downingtown', venueName: 'Kerr Park',
    author: A.market, createdAt: daysFromNow(-60),
    startsAt: daysFromNow(3), category: 'market', rsvpCount: 89,
    rrule: 'FREQ=WEEKLY;BYDAY=SA',
  },
  {
    id: 'e4', kind: 'event', status: 'published',
    title: 'Garage sale — moving out',
    description: 'Furniture, kitchen stuff, a lot of books, one very good armchair. Early birds welcome.',
    ...near(-1.1, -0.4), neighbourhood: 'Thorndale',
    author: A.jen, createdAt: daysFromNow(-1),
    startsAt: daysFromNow(2), category: 'community', rsvpCount: 3,
  },
  {
    id: 'e5', kind: 'event', status: 'published',
    title: 'Open mic — sign up from 7',
    description: 'Eight slots, ten minutes each. Piano and two mics provided. No cover.',
    ...near(1.4, 3.2), neighbourhood: 'Exton', venueName: 'Bright Side Coffee',
    author: A.cafe, createdAt: daysFromNow(-14),
    startsAt: hoursFromNow(52), category: 'music', rsvpCount: 12,
    rrule: 'FREQ=WEEKLY;BYDAY=TH',
  },
  {
    id: 'e6', kind: 'event', status: 'published',
    title: 'Sunday morning run — Struble Trail',
    description: '5k out and back along the creek at a conversational pace. Coffee after, no one gets dropped.',
    ...near(1.8, 0.4), neighbourhood: 'Downingtown',
    author: A.maya, createdAt: daysFromNow(-9),
    startsAt: daysFromNow(4), category: 'sport', rsvpCount: 15,
    rrule: 'FREQ=WEEKLY;BYDAY=SU',
  },
  {
    id: 'e7', kind: 'event', status: 'published',
    title: 'Beginners pottery — two places left',
    description: 'Three hours on the wheel, clay and firing included. Aprons provided, wear old clothes.',
    ...near(-2.2, 4.8), neighbourhood: 'West Chester', venueName: 'Brandywine Pottery',
    author: A.studio, createdAt: daysFromNow(-6),
    startsAt: daysFromNow(5), category: 'class', rsvpCount: 6,
    price: 45, ticketUrl: 'https://example.com/pottery',
  },
  {
    id: 'e8', kind: 'event', status: 'published',
    title: 'Trail cleanup at Marsh Creek',
    description: 'Two hours, gloves and bags provided. Township is bringing a truck for the haul-out.',
    ...near(7.5, -3.0), neighbourhood: 'Chester Springs',
    author: A.tomas, createdAt: daysFromNow(-5),
    startsAt: daysFromNow(6), category: 'community', rsvpCount: 21,
  },
];

/* ── requests ───────────────────────────────────────────────────────────── */

const requests: RequestPost[] = [
  {
    id: 'r1', kind: 'request', status: 'published',
    title: "Feed my cat while we're away",
    description: 'One indoor cat, very easy. Dry food twice a day and a litter change. Keys with the neighbour.',
    ...near(0.3, -0.7), neighbourhood: 'Downingtown',
    author: A.priya, createdAt: daysFromNow(-1),
    serviceType: 'petcare',
    neededFrom: daysFromNow(6), neededTo: daysFromNow(13),
    budget: 120, claimState: 'open', requiresHomeAccess: true,
  },
  {
    id: 'r2', kind: 'request', status: 'published',
    title: 'Dog walk, weekday lunchtimes',
    description: "Friendly lab, needs 30 minutes around midday while I'm back in the office. Ongoing if it works out.",
    ...near(-0.6, 0.2), neighbourhood: 'Downingtown',
    author: A.tomas, createdAt: hoursFromNow(-6),
    serviceType: 'petcare',
    neededFrom: daysFromNow(2), neededTo: daysFromNow(30),
    budget: 20, claimState: 'open', requiresHomeAccess: true,
  },
  {
    id: 'r3', kind: 'request', status: 'published',
    title: 'Help shifting a sofa on Saturday',
    description: 'Second floor, no lift. Two people, half an hour of work. I have the van.',
    ...near(1.0, 2.6), neighbourhood: 'Exton',
    author: A.jen, createdAt: hoursFromNow(-20),
    serviceType: 'handyman',
    neededFrom: daysFromNow(3), neededTo: daysFromNow(3),
    budget: 60, claimState: 'claimed', claimedBy: 'u6', requiresHomeAccess: false,
  },
  {
    id: 'r4', kind: 'request', status: 'published',
    title: 'Lawn needs cutting — one off',
    description: "Small front and back, hasn't been done in a month. Happy to pay for the clippings to go too.",
    ...near(-1.4, -1.9), neighbourhood: 'Thorndale',
    author: A.maya, createdAt: daysFromNow(-3),
    serviceType: 'handyman',
    neededFrom: daysFromNow(1), neededTo: daysFromNow(7),
    budget: 70, claimState: 'open', requiresHomeAccess: false,
  },
  {
    id: 'r5', kind: 'request', status: 'published',
    title: 'Snow blower for the driveway',
    description: 'Corner lot, wide driveway. Looking for someone reliable for the season rather than one visit.',
    ...near(3.4, 1.2), neighbourhood: 'Glenmoore',
    author: A.rosa, createdAt: daysFromNow(-4),
    serviceType: 'handyman',
    neededFrom: daysFromNow(10), neededTo: daysFromNow(120),
    budget: 45, claimState: 'open', requiresHomeAccess: false,
  },
];

/* ── offers ─────────────────────────────────────────────────────────────── */

const offers: OfferPost[] = [
  {
    id: 'o1', kind: 'offer', status: 'published',
    title: 'Lawn and yard work, weekends',
    description: 'I do this around my main job. Mowing, edging, leaf clearing. I bring my own kit.',
    ...near(0.8, -1.4), neighbourhood: 'Downingtown',
    author: A.carl, createdAt: daysFromNow(-45),
    trades: ['lawn', 'gutters'], rate: 45, rateUnit: 'visit',
    availability: 'Saturdays and Sunday mornings',
  },
  {
    id: 'o2', kind: 'offer', status: 'published',
    title: 'House cleaning — regular or one off',
    description: 'Fifteen years doing this. References from four families on this street.',
    ...near(-0.3, -1.7), neighbourhood: 'Downingtown',
    author: A.rosa, createdAt: daysFromNow(-90),
    trades: ['cleaning'], rate: 35, rateUnit: 'hour',
    availability: 'Weekday daytimes',
  },
  {
    id: 'o3', kind: 'offer', status: 'published',
    title: 'Licensed electrician — evenings and weekends',
    description: 'Outlets, fixtures, panel work, EV chargers. Permits pulled where required.',
    ...near(1.6, 2.1), neighbourhood: 'Exton',
    author: A.ig, createdAt: daysFromNow(-20),
    trades: ['electrical'], rate: 95, rateUnit: 'hour',
    availability: 'After 5pm, all day Saturday',
    licence: { number: 'PA-EL-38217', state: 'PA', verified: true, verifiedAt: daysFromNow(-18) },
  },
  {
    id: 'o4', kind: 'offer', status: 'draft',
    title: 'Plumbing — small jobs',
    description: 'Taps, traps, running toilets. Awaiting licence verification before this goes live.',
    ...near(-2.0, 0.5), neighbourhood: 'Thorndale',
    author: A.devin, createdAt: hoursFromNow(-3),
    trades: ['plumbing'], rate: 80, rateUnit: 'hour',
    availability: 'Evenings',
    licence: { number: 'PA-PL-00000', state: 'PA', verified: false },
  },
  {
    id: 'o5', kind: 'offer', status: 'published',
    title: 'General handyman — shelves, doors, flat pack',
    description: "Small repairs under $500. No electrical or plumbing — I'll tell you who to call for those.",
    ...near(0.2, 4.4), neighbourhood: 'Exton',
    author: A.carl, createdAt: daysFromNow(-30),
    trades: ['handyman', 'painting'], rate: 55, rateUnit: 'hour',
    availability: 'Most evenings, weekends by arrangement',
  },
  {
    id: 'o6', kind: 'offer', status: 'published',
    title: 'Gutter clearing before the leaves drop',
    description: 'Two-storey no problem. I take the debris away rather than bagging it on your drive.',
    ...near(-3.6, -2.4), neighbourhood: 'Coatesville',
    author: A.carl, createdAt: daysFromNow(-12),
    trades: ['gutters', 'lawn'], rate: 120, rateUnit: 'job',
    availability: 'Weekday afternoons',
  },
];

/* ── finished — populates profile history ───────────────────────────────── */

const pastPosts: Post[] = [
  {
    id: 'h1', kind: 'event', status: 'published',
    title: 'Street party for the long weekend',
    description: 'We closed the road, someone brought a smoker, it went on far too long. Same again next year.',
    ...near(0.3, -0.4), neighbourhood: 'Downingtown',
    author: A.devin, createdAt: daysFromNow(-40),
    startsAt: daysFromNow(-28), category: 'community', rsvpCount: 63,
  },
  {
    id: 'h2', kind: 'event', status: 'published',
    title: 'Five-a-side at the rec centre',
    description: 'Weekly kickabout. Numbers dropped off over winter so we stopped.',
    ...near(0.9, 0.5), neighbourhood: 'Downingtown',
    author: A.devin, createdAt: daysFromNow(-90),
    startsAt: daysFromNow(-14), category: 'sport', rsvpCount: 9,
  },
  {
    id: 'h3', kind: 'request', status: 'published',
    title: 'Cat sitting over the holidays',
    description: 'Two weeks, twice a day. Rosa took it on and sent photos every day — would ask again.',
    ...near(0.4, -0.6), neighbourhood: 'Downingtown',
    author: A.priya, createdAt: daysFromNow(-70),
    serviceType: 'petcare',
    neededFrom: daysFromNow(-60), neededTo: daysFromNow(-46),
    budget: 210, claimState: 'done', claimedBy: 'u7', requiresHomeAccess: true,
  },
  {
    id: 'h4', kind: 'request', status: 'published',
    title: 'Help clearing the garage',
    description: 'Two hours, two people, one skip. Done and dusted.',
    ...near(-0.7, 0.2), neighbourhood: 'Downingtown',
    author: A.devin, createdAt: daysFromNow(-22),
    serviceType: 'handyman',
    neededFrom: daysFromNow(-18), neededTo: daysFromNow(-18),
    budget: 90, claimState: 'done', claimedBy: 'u6', requiresHomeAccess: false,
  },
];

export const ALL_POSTS: Post[] = [...events, ...requests, ...offers, ...pastPosts];

/**
 * Stand-in for `events_nearby(lat, lng, radius, from)`.
 * Same contract as the RPC it will become: radius filter, then sort.
 */
export function nearby(q: FeedQuery, posts: Post[] = ALL_POSTS): FeedItem[] {
  const kinds = q.kinds;
  const now = new Date();
  const allow = q.includeEnded ? ['live', 'ended'] : ['live'];
  return posts
    .filter((p) => p.status === 'published')
    .filter((p) => allow.includes(lifecycle(p, now)))
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
