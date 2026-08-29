/**
 * Grouping a feed by when things happen.
 *
 * Thirty posts in one list is fifteen screens of thumb-scrolling and no way to
 * skim. Nobody wants "all thirty" — they want *tonight*, or *this weekend*.
 * Four labelled groups turn an endless list into a page you can read the shape
 * of in a second, and the counts alone answer "is anything on?".
 *
 * Time is the organiser rather than distance because events expire. A good
 * event four miles away beats a dull one at the end of the street; neither
 * matters once it has finished. Distance is a filter, not a structure.
 */

import type { FeedItem, Post, EventPost, RequestPost } from './types.js';
import { endsAtOf } from './types.js';

export type WhenKey = 'today' | 'tomorrow' | 'week' | 'later' | 'anytime';

export interface WhenGroup {
  key: WhenKey;
  label: string;
  items: FeedItem[];
}

/** When a post begins. Offers have no start — they are standing. */
function startsAtOf(post: Post): number | null {
  if (post.kind === 'event') return new Date((post as EventPost).startsAt).getTime();
  if (post.kind === 'request') return new Date((post as RequestPost).neededFrom).getTime();
  return null;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Which group a post belongs in.
 *
 * Judged on the day it STARTS, except for something already running — a
 * three-day sale that began yesterday belongs under Today, because today is
 * when you can still go to it.
 */
export function whenKeyOf(post: Post, now: Date = new Date()): WhenKey {
  const starts = startsAtOf(post);
  if (starts === null) return 'anytime';

  const today = startOfDay(now);
  const day = 86_400_000;
  const ends = endsAtOf(post);

  // Under way right now, whenever it began.
  if (starts < now.getTime() && ends !== null && ends >= now.getTime()) return 'today';

  const startsDay = startOfDay(new Date(starts));
  if (startsDay <= today) return 'today';
  if (startsDay === today + day) return 'tomorrow';
  if (startsDay <= today + day * 7) return 'week';
  return 'later';
}

const LABELS: Record<WhenKey, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  anytime: 'Available anytime',
};

const ORDER: readonly WhenKey[] = ['today', 'tomorrow', 'week', 'later', 'anytime'];

/**
 * Group a feed, dropping empty groups.
 *
 * An empty "Tomorrow" heading is worse than no heading: it reads as something
 * failing to load rather than as nothing being on.
 */
export function groupByWhen(items: readonly FeedItem[], now: Date = new Date()): WhenGroup[] {
  const buckets = new Map<WhenKey, FeedItem[]>();
  for (const item of items) {
    const key = whenKeyOf(item.post, now);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return ORDER.filter((k) => (buckets.get(k)?.length ?? 0) > 0).map((k) => ({
    key: k,
    label: LABELS[k]!,
    items: buckets.get(k)!,
  }));
}
