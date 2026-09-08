import { useEffect, useState } from 'react'

/**
 * The current time, re-read on an interval.
 *
 * A relative label is the one kind of text that goes stale while nobody
 * touches it: "just now" has to become "2 minutes ago" on its own or it is a
 * lie. So this is deliberately the smallest possible timer — a counter that
 * forces a re-render and nothing else.
 *
 * Four things mount it, and what they ask for is what they show. The sidebar
 * and the account pane want a relative time, and take the default. The shell
 * wants a date and a budget meter, so it asks for a minute — and for a second
 * only while a clock is running, because the recovery dialog and the logged
 * total then keep step with the bar. The timer bar wants a second hand and
 * asks for it itself, which is what keeps a running timer to one component
 * re-rendering a second rather than the whole window.
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
