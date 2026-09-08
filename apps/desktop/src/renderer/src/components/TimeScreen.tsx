import { useCallback, useState, type JSX } from 'react'
import { totalMinutes, type Id, type TimeEntry } from '@trackit/shared'
import { EmptyState } from './EmptyState'
import { TableSkeleton } from './TableSkeleton'
import { TimeLog } from './TimeLog'
import { TimerStarter } from './TimerStarter'
import { TopBar } from './TopBar'
import { WeekToolbar } from './WeekToolbar'
import { clientNameOf, dayOf, daysOf, weekWindow } from './time-data'
import { atLocal, localMinutesOf, todayIso } from './local-dates'
import { useClients } from '../data/use-clients'
import { useProjects } from '../data/use-projects'
import {
  useCreateTimeEntry,
  useDeleteTimeEntry,
  useStartTimer,
  useTimeEntries,
  useUpdateTimeEntry
} from '../data/use-time'

type TimeScreenProps = {
  isTopmost: boolean
  loading?: boolean
}

/**
 * The global weekly log.
 *
 * Every other screen has App render its TopBar. This one owns all three tiers,
 * because the header acts on the log below it: "Add entry" writes a row, and
 * the week arrows decide which rows exist at all.
 */
export function TimeScreen({ isTopmost, loading = false }: TimeScreenProps): JSX.Element {
  const today = todayIso()
  const [offset, setOffset] = useState(0)
  const week = weekWindow(offset, today)
  const previous = weekWindow(offset - 1, today)
  const [focusId, setFocusId] = useState<Id | null>(null)

  const entriesQuery = useTimeEntries({ from: week.from, to: week.to })
  const previousQuery = useTimeEntries({ from: previous.from, to: previous.to })
  const projectsQuery = useProjects()
  const clientsQuery = useClients()

  const create = useCreateTimeEntry()
  const update = useUpdateTimeEntry()
  const del = useDeleteTimeEntry()
  const start = useStartTimer()

  const projects = projectsQuery.data ?? []
  const clients = clientsQuery.data ?? []
  /* The running entry (endedAt null) belongs to the timer bar, not the log. */
  const entries = (entriesQuery.data ?? []).filter((entry) => entry.endedAt !== null)
  const previousEntries = (previousQuery.data ?? []).filter((entry) => entry.endedAt !== null)

  const loggable = projects.filter((project) => project.status !== 'cancelled')
  const startable = projects.filter((project) => project.status === 'active')

  const pending =
    loading ||
    entriesQuery.isPending ||
    previousQuery.isPending ||
    projectsQuery.isPending ||
    clientsQuery.isPending

  const clearFocus = useCallback(() => setFocusId(null), [])

  /*
   * A forgotten session is logged where it happened, so the new row lands on
   * the newest day of the week you are looking at — today, on the current week.
   * It starts when the last entry of that day ended, which is nearly always
   * right and is at worst two keystrokes from it.
   */
  const addEntry = (): void => {
    const day = offset === 0 ? today : week.start
    const dayEntries = entries.filter((entry) => dayOf(entry) === day)
    const last = dayEntries.reduce<TimeEntry | undefined>(
      (latest, entry) =>
        !latest || (entry.endedAt ?? '') > (latest.endedAt ?? '') ? entry : latest,
      undefined
    )
    const startMin = last?.endedAt ? localMinutesOf(last.endedAt) : 540
    const projectId = entries.at(-1)?.projectId ?? loggable[0]?.id
    if (!projectId) return
    const id = crypto.randomUUID()

    create.mutate(
      {
        id,
        projectId,
        checklistItemId: null,
        note: '',
        startedAt: atLocal(day, startMin),
        endedAt: atLocal(day, startMin),
        source: 'manual'
      },
      { onSuccess: () => setFocusId(id) }
    )
  }

  return (
    <>
      <TopBar
        title="Time"
        isTopmost={isTopmost}
        actions={
          <>
            <TimerStarter
              projects={startable}
              onStart={(projectId) =>
                start.mutate({ id: crypto.randomUUID(), projectId, checklistItemId: null, note: '' })
              }
            />
            <button type="button" className="button no-drag" onClick={addEntry}>
              Add entry
            </button>
          </>
        }
      />

      <WeekToolbar
        offset={offset}
        start={week.start}
        totalMinutes={totalMinutes(entries)}
        previousMinutes={totalMinutes(previousEntries)}
        onOffset={setOffset}
      />

      <div className="main__content">
        {pending ? (
          <TableSkeleton block="time-log" />
        ) : loggable.length === 0 ? (
          <EmptyState
            variant="panel"
            title="Nothing to log against"
            body="Create a project first; hours are always logged to one."
          />
        ) : (
          <TimeLog
            days={daysOf(week, today)}
            today={today}
            entries={entries}
            projects={loggable}
            clientNameOf={(projectId) => clientNameOf(projectId, projects, clients)}
            focusId={focusId}
            onChange={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => del.mutate(id)}
            onFocused={clearFocus}
          />
        )}
      </div>
    </>
  )
}
