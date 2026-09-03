import { useCallback, useMemo, useState, type JSX } from 'react'
import { TimeLog } from './TimeLog'
import { TimerStarter } from './TimerStarter'
import { TopBar } from './TopBar'
import { WeekToolbar } from './WeekToolbar'
import { TODAY, totalOf, weekFor, type TimeEntry } from './time-data'

type TimeScreenProps = {
  isTopmost: boolean
}

let nextId = 100

/**
 * The global weekly log.
 *
 * Every other screen has App render its TopBar. This one owns all three tiers,
 * because the header acts on the log below it: "Add entry" writes a row, and
 * the week arrows decide which rows exist at all.
 */
export function TimeScreen({ isTopmost }: TimeScreenProps): JSX.Element {
  const [offset, setOffset] = useState(0)
  const week = useMemo(() => weekFor(offset), [offset])
  const [entries, setEntries] = useState<TimeEntry[]>(week.entries)
  const [focusId, setFocusId] = useState<string | null>(null)
  /* Stepping to another week loads its rows; edits to the old one are dropped,
     which is honest for a design build with no store behind it. */
  const [loaded, setLoaded] = useState(offset)

  if (loaded !== offset) {
    setLoaded(offset)
    setEntries(week.entries)
    setFocusId(null)
  }

  const total = totalOf(entries)

  const change = useCallback((id: string, patch: Partial<TimeEntry>): void => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    )
  }, [])

  const remove = useCallback((id: string): void => {
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const clearFocus = useCallback(() => setFocusId(null), [])

  /*
   * A forgotten session is logged where it happened, so the new row lands on
   * the newest day of the week you are looking at — today, on the current week.
   * It starts when the last entry of that day ended, which is nearly always
   * right and is at worst two keystrokes from it.
   */
  const addEntry = (): void => {
    const iso = offset === 0 ? TODAY : week.start
    const dayEntries = entries.filter((entry) => entry.iso === iso)
    const last = dayEntries.reduce(
      (latest, entry) => (entry.endMin > latest.endMin ? entry : latest),
      dayEntries[0]
    )
    const startMin = last ? last.endMin : 540
    const id = `n${(nextId += 1)}`

    setEntries((current) => [
      ...current,
      {
        id,
        iso,
        project: entries[entries.length - 1]?.project ?? 'Brand refresh',
        note: '',
        startMin,
        endMin: startMin
      }
    ])
    setFocusId(id)
  }

  return (
    <>
      <TopBar
        title="Time"
        isTopmost={isTopmost}
        actions={
          <>
            <TimerStarter />
            <button type="button" className="button no-drag" onClick={addEntry}>
              Add entry
            </button>
          </>
        }
      />

      <WeekToolbar
        offset={offset}
        start={week.start}
        totalMinutes={total}
        previousMinutes={week.previousMinutes}
        onOffset={setOffset}
      />

      <div className="main__content">
        <TimeLog
          week={week}
          entries={entries}
          focusId={focusId}
          onChange={change}
          onDelete={remove}
          onFocused={clearFocus}
        />
      </div>
    </>
  )
}
