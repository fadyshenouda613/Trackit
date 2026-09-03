import { useEffect, useState } from 'react'

/**
 * The current time, re-read on an interval.
 *
 * A relative label is the one kind of text that goes stale while nobody
 * touches it: "just now" has to become "2 minutes ago" on its own or it is a
 * lie. Nothing else in this renderer runs on a timer, so this is deliberately
 * the smallest possible one — a counter that forces a re-render and nothing
 * else, mounted only by the two components that show a relative time.
 *
 * Thirty seconds by default, which is well inside the resolution of the
 * coarsest label it feeds (minutes) and cheap enough to ignore.
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])

  return now
}
