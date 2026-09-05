import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type JSX } from 'react'
import { isDesktop, ledger } from './bridge'
import { AllProjectsTable } from './components/AllProjectsTable'
import { AttentionList } from './components/AttentionList'
import { AuthScreen } from './components/AuthScreen'
import { ClientDetail } from './components/ClientDetail'
import { ClientsTable } from './components/ClientsTable'
import { EmptyState } from './components/EmptyState'
import { InvoiceDetail } from './components/InvoiceDetail'
import { InvoiceScreen } from './components/InvoiceScreen'
import { InvoicesScreen } from './components/InvoicesScreen'
import { ListToolbar } from './components/ListToolbar'
import { MetricCards } from './components/MetricCards'
import { NewClientModal } from './components/NewClientModal'
import { NewProjectModal } from './components/NewProjectModal'
import { ProjectDetail } from './components/ProjectDetail'
import { ProjectsTable } from './components/ProjectsTable'
import { PrintedInvoice } from './components/PrintedInvoice'
import { ProjectsToolbar } from './components/ProjectsToolbar'
import { RecordPaymentModal } from './components/RecordPaymentModal'
import { SettingsScreen } from './components/SettingsScreen'
import { Sidebar, type NavKey } from './components/Sidebar'
import type { SyncState } from './components/sync-data'
import { readTheme, resolve, watchSystem, writeTheme, type Theme } from './components/theme'
import { TableSkeleton } from './components/TableSkeleton'
import { ToastStack, useToasts } from './components/Toast'
import { UpdateNotice } from './components/UpdateNotice'
import {
  deliveredToast,
  errorToast,
  paymentToast,
  pdfToast,
  timerToast,
  type ToastKind
} from './components/toast-data'
import { TimerBar } from './components/TimerBar'
import { TimerRecoveryDialog } from './components/TimerRecoveryDialog'
import { TimeScreen } from './components/TimeScreen'
import { TopBar } from './components/TopBar'
import { useNow } from './components/use-now'
import {
  elapsedSeconds,
  hoursToMinutes,
  overdueDays,
  totalMinutes,
  type Id
} from '@trackit/shared'
import {
  clearSession,
  hasSeenWelcome,
  markWelcomeSeen,
  readSession,
  writeSession
} from './components/auth-session'
import { defaultSettings, type Settings } from './components/settings-data'
import { invoices as seedInvoices, summarise } from './components/invoices-fixture'
import {
  StatePanel,
  type AuthView,
  type Modal,
  type NoticeState,
  type Screen
} from './dev/StatePanel'
import { createQueryClient } from './data/query-client'
import { useChecklist } from './data/use-checklist'
import { useClient, useClients } from './data/use-clients'
import { useDevReset, useDevSeed, useDevTimerScenario } from './data/use-dev'
import { useInvoices } from './data/use-invoices'
import { useProject, useProjects } from './data/use-projects'
import { useSettings, useUpdateSettings } from './data/use-settings'
import { usePendingCounts } from './data/use-sync'
import {
  useDeleteTimeEntry,
  useOrphanedTimer,
  useRunningTimer,
  useStopTimer,
  useTimeEntries,
  useTimerChangedFromMain,
  useUpdateTimeEntry
} from './data/use-time'

/*
 * The two records the dev panel opens straight to, found by number in whatever
 * the store holds: the richest partial, and the void. The panel is the only
 * thing in the renderer that still knows a fixture by name, and it has to —
 * "open the interesting invoice" is not a query.
 */
const SAMPLE_INVOICE = 'INV-0145'
const SAMPLE_VOID = 'INV-0137'
/* The project the panel's Project and Timer choices open, likewise. */
const SAMPLE_PROJECT = 'Brand refresh'

/*
 * Read once, here, rather than in an effect: an effect would paint the sign-in
 * card for a frame before the stored session replaced it, and StrictMode would
 * run it twice. Both initialisers below want the same answer and nothing can
 * change it between them.
 */
const storedSession = readSession()

/* Read here for the same reason, and with an extra one: theme-boot.js has
   already stamped data-theme from this value before the first paint, so
   starting from anything else would flip the app on mount. */
const storedTheme = readTheme()

export function App(): JSX.Element {
  const toastQueue = useToasts()
  const [queryClient] = useState(() =>
    createQueryClient((error) => toastQueue.push(errorToast(error.message)))
  )
  return (
    <QueryClientProvider client={queryClient}>
      <Shell toastQueue={toastQueue} />
    </QueryClientProvider>
  )
}

function Shell({ toastQueue }: { toastQueue: ReturnType<typeof useToasts> }): JSX.Element {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  /* Which record a detail screen is showing. Ids, not names: the screens read
     them back out of the store. */
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<Id | null>(null)
  const [openInvoiceId, setOpenInvoiceId] = useState<Id | null>(null)
  /* The client "New project" is opened for, so the dialog can be told once it
     accepts an initial client (Task 15) — it does not yet, so only the setter
     is used for now. */
  const [, setNewProjectClientId] = useState<Id | null>(null)
  /* Create invoice is reached from three places now, so it remembers which one
     and names it in the breadcrumb rather than always claiming to come from the
     dashboard. */
  const [invoiceFrom, setInvoiceFrom] = useState<Screen>('dashboard')
  const [syncState, setSyncState] = useState<SyncState>('saved')
  const [notice, setNotice] = useState<NoticeState>('none')
  /*
   * The Data axis. Loading is a real query state now; this only forces it, so
   * the skeletons stay reviewable against a local database that answers in
   * under a frame.
   */
  const [forceLoading, setForceLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>(storedTheme)
  /* Covers the frame between answering the recovery dialog and the refetch
     that finds no orphaned timer any more. */
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const { toasts, push: pushToast, dismiss: dismissToast } = toastQueue

  /*
   * Being signed in is the one thing this app remembers across launches, because
   * the front door promises an account is only needed the first time. `null`
   * means the app itself is showing.
   *
   * A stored session beats having no connection: the offline card is the first
   * launch and only the first launch, since the whole promise afterwards is that
   * the app opens with or without a link.
   */
  const [authView, setAuthView] = useState<AuthView | null>(
    storedSession ? null : navigator.onLine ? 'signIn' : 'offline'
  )

  /*
   * Interim, both of these, and both go in Part E.
   *
   * The register is the fixture the three invoice screens still render. It is
   * read-only now — the store is the register, and Task 18 moves those screens
   * onto it — so mark sent, void and record payment change nothing here.
   *
   * The settings form is the same story: the Settings screen holds its figures
   * as typed text and has no writer on the store yet (Task 19). The rate floor
   * every other screen is judged against no longer comes from here; it comes
   * from the settings row.
   */
  const register = seedInvoices
  const [settingsForm, setSettingsForm] = useState<Settings>(
    storedSession ? { ...defaultSettings, accountEmail: storedSession.email } : defaultSettings
  )

  /*
   * The preference is what is stored and what the main process is told —
   * nativeTheme already knows what "system" means. Only the stylesheet gets
   * the resolved answer, because tokens.css has two blocks, not three.
   */
  useEffect(() => {
    document.documentElement.dataset.theme = resolve(theme)
    writeTheme(theme)
    ledger.window.setTheme(theme)

    /* Only worth listening while the answer can change under us. */
    if (theme !== 'system') return
    return watchSystem(() => {
      document.documentElement.dataset.theme = resolve(theme)
    })
  }, [theme])

  useEffect(() => {
    // Only macOS keeps system traffic lights on a frameless window.
    if (ledger.platform === 'darwin') {
      document.documentElement.style.setProperty('--chrome-leading', '88px')
    }
  }, [])

  /*
   * navigator.onLine reports only whether the machine thinks it has a link,
   * which is the most this app can honestly know: there is no account service
   * behind it to reach. So it is used to open the door and never to shut one — a
   * connection dropping while someone is halfway through a password should not
   * take the form away from them.
   */
  useEffect(() => {
    const recheck = (): void =>
      setAuthView((view) => (view === 'offline' && navigator.onLine ? 'signIn' : view))

    window.addEventListener('online', recheck)
    window.addEventListener('offline', recheck)
    return () => {
      window.removeEventListener('online', recheck)
      window.removeEventListener('offline', recheck)
    }
  }, [])

  /*
   * What the shell itself needs from the store. Everything below is derived
   * from these — the shell holds no copy of any of it.
   */
  const clients = useClients()
  const projects = useProjects()
  const invoices = useInvoices()
  const settings = useSettings()
  const runningTimer = useRunningTimer()
  const orphanedTimer = useOrphanedTimer()
  const pendingCounts = usePendingCounts()
  /* The tray and the shortcut move the clock behind our back; this is how the
     bar hears about it without a refresh. */
  useTimerChangedFromMain()

  const stopTimer = useStopTimer()
  const updateTimeEntry = useUpdateTimeEntry()
  const deleteTimeEntry = useDeleteTimeEntry()
  const updateSettings = useUpdateSettings()
  const devReset = useDevReset()
  const devSeed = useDevSeed()
  const devScenario = useDevTimerScenario()

  /* One tick a second for the whole window: the timer bar's clock and the
     dashboard's date both read it, and nothing else in here counts. */
  const nowMs = useNow(1000)

  const clientList = clients.data ?? []
  const projectList = projects.data ?? []
  const invoiceList = invoices.data ?? []

  /*
   * Empty is not a screen any more — it is what the dashboard looks like with
   * nothing behind it. While the first list is still in flight the shell draws
   * populated, so the skeletons rather than the empty state are what a launch
   * shows.
   */
  const isEmpty = clients.isSuccess && clients.data.length === 0
  const isClients = screen === 'clients' || screen === 'client'
  const isProjects = screen === 'projects' || screen === 'project'
  const isInvoices = screen === 'invoices' || screen === 'invoice' || screen === 'newInvoice'

  const rateFloorCents = settings.data?.rateFloorCents ?? 0

  const running = runningTimer.data ?? null
  /* A clock still running from before this launch: one the app never got to
     stop, which is what the recovery dialog is for. It is the same row as
     `running`, so everything the bar works out about that row serves it too. */
  const orphan = orphanedTimer.data ?? null

  const runningProject = useProject(running?.projectId ?? null).data ?? null
  const runningClient = useClient(runningProject?.clientId ?? null).data ?? null
  const runningDeliverable = useChecklist(running?.projectId ?? null).data?.find(
    (item) => item.id === running?.checklistItemId
  )
  /* Null, not undefined: with no timer running there is no project to total,
     and undefined would ask for the whole log once a second. */
  const runningProjectEntries =
    useTimeEntries(running ? { projectId: running.projectId } : null).data ?? []

  /* Measured to this second, so the meter moves with the clock above it. */
  const loggedMinutes = totalMinutes(runningProjectEntries, new Date(nowMs).toISOString())
  const overBudget =
    running && runningProject ? loggedMinutes > hoursToMinutes(runningProject.budgetedHours) : false

  /*
   * The timer bar is window chrome, not part of a screen: "spans the full
   * window above everything and only exists while a timer runs". A new account
   * has nothing to time, so an empty store suppresses it.
   */
  const showTimerBar = running !== null && !isEmpty

  /* What the panel's Project, Invoice and Void invoice choices open. Found by
     name and number, because that is what makes them the interesting ones. */
  const sampleProject =
    projectList.find((project) => project.name === SAMPLE_PROJECT) ?? projectList[0] ?? null
  const sampleInvoice =
    invoiceList.find((entry) => entry.number === SAMPLE_INVOICE) ?? invoiceList[0] ?? null
  const sampleVoid =
    invoiceList.find((entry) => entry.number === SAMPLE_VOID) ?? invoiceList[0] ?? null

  const selectedClient = useClient(selectedClientId).data ?? null
  const selectedProject = useProject(selectedProjectId).data ?? null
  const openInvoice = invoiceList.find((entry) => entry.id === openInvoiceId) ?? null

  const activeProjects = projectList.filter((project) => project.status === 'active').length
  /* The badge is the overdue count, counted rather than typed: a void, a draft
     and a settled invoice are never overdue, whatever their due date says. */
  const overdueInvoices = invoiceList.filter(
    (entry) =>
      (entry.status === 'sent' || entry.status === 'partial') &&
      overdueDays(entry.dueAt, new Date(nowMs).toISOString()) !== null
  ).length

  /* Interim: the figures above the fixture invoice list, and the fixture row
     the three invoice screens render. Task 18. */
  const figures = useMemo(() => summarise(register), [register])
  const invoice = register.find((entry) => entry.number === openInvoice?.number) ?? register[0]

  const patchSettings = (change: Partial<Settings>): void =>
    setSettingsForm((current) => ({ ...current, ...change }))

  /** Signing in and signing up both end here: store it, name it, drop the gate. */
  const enter = (email: string, name: string, view: AuthView | null): void => {
    writeSession({ version: 1, email, name })
    updateSettings.mutate({ accountEmail: email })
    patchSettings({ accountEmail: email })
    /* Deliberately not patching `person`: that is the name printed on invoices,
       and the seeded business profile is what every invoice screen renders. */
    setAuthView(view)
  }

  const onSignIn = (email: string): void => enter(email, '', null)

  const onSignUp = (name: string, email: string): void => {
    /* The welcome screen is shown once per machine. Someone who signs out and
       makes a second account is not on their first run. */
    const first = !hasSeenWelcome()
    markWelcomeSeen()
    enter(email, name, first ? 'welcome' : null)
  }

  const onSignOut = (): void => {
    clearSession() // the welcome flag is a separate key, and stays
    setScreen('dashboard') // so signing back in does not land mid-flow
    setAuthView('signIn')
  }

  const onNavigate = (key: NavKey): void => {
    if (key === 'dashboard') setScreen('dashboard')
    if (key === 'clients') setScreen('clients')
    if (key === 'projects') setScreen('projects')
    if (key === 'time') setScreen('time')
    if (key === 'invoices') setScreen('invoices')
    if (key === 'settings') setScreen('settings')
  }

  /*
   * Sync now, with nothing behind it. There is no service to ask, so this
   * walks the states the real one would: a moment in flight, then saved. It is
   * a stand-in and reads like one — it always succeeds — but a button in a
   * panel about syncing that does nothing at all would make the whole panel
   * hard to believe.
   */
  const onSyncNow = (): void => {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    window.setTimeout(() => setSyncState('saved'), 1400)
  }

  const onCreateInvoice = (): void => {
    setInvoiceFrom(screen)
    setScreen('newInvoice')
  }

  /* Interim: the fixture list still opens rows by number, so this finds the
     stored invoice that carries it. Task 18 hands the id straight over. */
  const openDetail = (number: string): void => {
    setOpenInvoiceId(invoiceList.find((entry) => entry.number === number)?.id ?? null)
    setScreen('invoice')
  }

  const backFrom = (from: Screen): { label: string; onClick: () => void } =>
    from === 'project'
      ? { label: selectedProject?.name ?? 'Project', onClick: () => setScreen('project') }
      : from === 'invoices'
        ? { label: 'Invoices', onClick: () => setScreen('invoices') }
        : { label: 'Dashboard', onClick: () => setScreen('dashboard') }

  /* Lifted out of the tree: the printed sheet returns before the app shell and
     still needs the panel to get back, so there is one definition of it. */
  const statePanel = (
    <StatePanel
      screen={screen}
      onScreen={(next) => {
        setModal(null)
        if (next === 'empty') {
          /* Empty and Seed are the database, not the screen: they wipe and
             reload it, and every query refetches into whatever is left. */
          devReset.mutate(undefined)
          setScreen('dashboard')
        } else if (next === 'seed') {
          devSeed.mutate({ reset: true })
          setScreen('dashboard')
        } else if (next === 'newClient') {
          setScreen('clients')
          setModal('client')
        } else if (next === 'newProject') {
          setScreen('projects')
          setModal('project')
        } else if (next === 'recovery') {
          /* Stages a clock left running since yesterday afternoon; the dialog
             is a condition of the launch, so it appears over whatever is up. */
          setRecoveryDismissed(false)
          devScenario.mutate('orphaned')
          setScreen('time')
        } else if (next === 'voidInvoice') {
          setOpenInvoiceId(sampleVoid?.id ?? null)
          setScreen('invoice')
        } else if (next === 'payment') {
          setOpenInvoiceId(sampleInvoice?.id ?? null)
          setScreen('invoice')
          setModal('payment')
        } else {
          if (next === 'invoice') setOpenInvoiceId(sampleInvoice?.id ?? null)
          if (next === 'project') setSelectedProjectId(sampleProject?.id ?? null)
          if (next === 'client') {
            setSelectedClientId(sampleProject?.clientId ?? clientList[0]?.id ?? null)
          }
          if (next === 'newInvoice') setInvoiceFrom('invoices')
          setScreen(next)
        }
      }}
      modal={modal}
      isEmpty={isEmpty}
      authView={authView}
      onAuthView={setAuthView}
      timer={running === null ? 'off' : overBudget ? 'over' : 'running'}
      onTimer={(next) => {
        /* Stopping is the app's own move; the other two stage a clock on a
           project the store has to already hold. */
        if (next === 'off') {
          if (running) stopTimer.mutate()
        } else {
          devScenario.mutate(next)
        }
      }}
      syncState={syncState}
      onSyncState={setSyncState}
      notice={notice}
      onNotice={(next) => {
        /* The two conflict notices live on the project screen, so choosing one
           from anywhere else has to take you where it can be seen. */
        if (next === 'conflict' || next === 'reorder') setScreen('project')
        setNotice(next)
      }}
      data={forceLoading ? 'loading' : 'ready'}
      onData={(next) => setForceLoading(next === 'loading')}
      onToast={(kind: ToastKind) => {
        if (kind === 'pdf') pushToast(pdfToast('INV-0148'))
        if (kind === 'payment') pushToast(paymentToast(2400, 'INV-0145'))
        if (kind === 'delivered') pushToast(deliveredToast('Brand refresh'))
        if (kind === 'timer') pushToast(timerToast(84, 'Brand refresh'))
        if (kind === 'error')
          pushToast(errorToast('A timer is already running; stop it before starting another'))
      }}
      theme={theme}
      onTheme={setTheme}
      /* The levers that write to the store need the bridge and a development
         build — main registers them only when the app is not packaged. */
      devAvailable={isDesktop && import.meta.env.DEV}
    />
  )

  /*
   * The account screens come before everything, the printed sheet included:
   * there is no shell, no sidebar and no timer bar until someone is signed in.
   * Only the States panel comes along, because it is the way back — the same
   * arrangement the printed invoice uses below.
   */
  if (authView !== null) {
    return (
      <>
        <AuthScreen
          view={authView}
          onView={setAuthView}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          /* All Retry can check is whether the machine has a link; the card
             states what it found either way. */
          onRetry={() => {
            if (!navigator.onLine) return false
            setAuthView('signIn')
            return true
          }}
          /* The welcome card's single action: into the app, on the dashboard —
             which a new account's empty store draws as the empty state. */
          onEnterApp={() => {
            setScreen('dashboard')
            setAuthView(null)
          }}
        />
        {statePanel}
      </>
    )
  }

  /*
   * The printed invoice is not a screen of the app — it is the artefact the app
   * produces. So it returns before the shell: no sidebar, no top bar, no timer
   * bar, and none of --bg-base behind it. Only the States panel comes along,
   * because it is the way back.
   */
  if (screen === 'printed') {
    return (
      <>
        <PrintedInvoice />
        {statePanel}
      </>
    )
  }

  return (
    <div className="app">
      {showTimerBar && running && runningProject && runningClient && (
        <TimerBar
          entry={running}
          project={runningProject}
          client={runningClient}
          deliverable={runningDeliverable?.label ?? ''}
          loggedMinutes={loggedMinutes}
          budgetMinutes={hoursToMinutes(runningProject.budgetedHours)}
          nowMs={nowMs}
          onStop={() => {
            /* The bar takes the elapsed clock with it when it goes, so this is
               the only place the hours just logged are ever stated. What was
               just logged is this run, not the project's lifetime — and it has
               to be read before the row closes. */
            const minutes = Math.floor(elapsedSeconds(running.startedAt, nowMs) / 60)
            const name = runningProject.name
            stopTimer.mutate(undefined, {
              onSuccess: () => pushToast(timerToast(minutes, name))
            })
          }}
        />
      )}

      <div className="app__body">
        <Sidebar
          variant={isEmpty ? 'empty' : 'populated'}
          active={
            screen === 'settings'
              ? 'settings'
              : isInvoices
                ? 'invoices'
                : screen === 'time'
                  ? 'time'
                  : isClients
                    ? 'clients'
                    : isProjects
                      ? 'projects'
                      : 'dashboard'
          }
          /* One real count on every screen: the artboards' per-screen figures
             were fixtures of their own frames. */
          counts={{ clients: String(clientList.length), projects: String(activeProjects) }}
          pending={pendingCounts.data ?? {}}
          overdueInvoices={overdueInvoices}
          timerRunning={running !== null}
          syncState={syncState}
          onSyncNow={onSyncNow}
          onNavigate={onNavigate}
        />

        <main className="main">
          {/* Inside .main rather than the window, so it clears the sidebar and
              cannot cover the timer bar. Always mounted: a live region has to
              be in the document before its content arrives. */}
          <ToastStack toasts={toasts} onDismiss={dismissToast} />

          {/* Time is the one screen that owns its whole header — see TimeScreen. */}
          {screen === 'time' ? (
            <TimeScreen isTopmost={!showTimerBar} />
          ) : screen === 'settings' ? (
            /* Also owns its whole header: the sub-nav beside the pane is part
               of the screen, not of the shell. */
            <SettingsScreen
              settings={settingsForm}
              onChange={patchSettings}
              syncState={syncState}
              isTopmost={!showTimerBar}
              onSignOut={onSignOut}
              theme={theme}
              onTheme={setTheme}
            />
          ) : screen === 'newInvoice' ? (
            /* Also owns its whole header: the footer acts on the body between. */
            <InvoiceScreen
              isTopmost={!showTimerBar}
              back={backFrom(invoiceFrom)}
              /* The one project detail screen designed belongs to Northwind. */
              initialClientId={invoiceFrom === 'project' ? 'northwind' : undefined}
              onOpenProjects={() => setScreen('projects')}
            />
          ) : screen === 'invoice' ? (
            /* The document names the record, so the bar only offers a way back. */
            <TopBar
              breadcrumb={{ label: 'Invoices', onClick: () => setScreen('invoices') }}
              isTopmost={!showTimerBar}
            />
          ) : screen === 'invoices' ? (
            <TopBar
              title="Invoices"
              meta={register.length + ' total · ' + figures.openCount + ' unpaid'}
              isTopmost={!showTimerBar}
              actions={
                <button
                  type="button"
                  className="button button--primary no-drag"
                  onClick={onCreateInvoice}
                >
                  New invoice
                </button>
              }
            />
          ) : screen === 'project' ? (
            <TopBar
              breadcrumb={{ label: 'Projects', onClick: () => setScreen('projects') }}
              isTopmost={!showTimerBar}
            />
          ) : screen === 'client' ? (
            <TopBar
              breadcrumb={{ label: 'Clients', onClick: () => setScreen('clients') }}
              title={selectedClient?.company || selectedClient?.name}
              isTopmost={!showTimerBar}
              actions={
                <>
                  <button type="button" className="button no-drag">
                    Archive
                  </button>
                  <button type="button" className="button no-drag">
                    Edit client
                  </button>
                  <button
                    type="button"
                    className="button button--primary no-drag"
                    onClick={() => {
                      setNewProjectClientId(selectedClientId)
                      setModal('project')
                    }}
                  >
                    New project
                  </button>
                </>
              }
            />
          ) : screen === 'clients' ? (
            <TopBar
              title="Clients"
              meta={`${clientList.length} active`}
              isTopmost={!showTimerBar}
              actions={
                <button
                  type="button"
                  className="button button--primary no-drag"
                  onClick={() => setModal('client')}
                >
                  New client
                </button>
              }
            />
          ) : screen === 'projects' ? (
            <TopBar
              title="Projects"
              meta={`${projectList.length} total · ${activeProjects} active`}
              isTopmost={!showTimerBar}
              actions={
                <button
                  type="button"
                  className="button button--primary no-drag"
                  onClick={() => setModal('project')}
                >
                  New project
                </button>
              }
            />
          ) : (
            <TopBar
              title="Dashboard"
              meta={new Date(nowMs).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
              isTopmost={!showTimerBar}
              actions={
                isEmpty ? null : (
                  <>
                    <button type="button" className="button no-drag">
                      Log time
                    </button>
                    <button
                      type="button"
                      className="button button--primary no-drag"
                      onClick={() => setModal('project')}
                    >
                      New project
                    </button>
                  </>
                )
              }
            />
          )}

          {notice === 'update' && (
            <div className="notice-bar">
              <UpdateNotice version="1.4" onDismiss={() => setNotice('none')} />
            </div>
          )}

          {/* An account with no clients has no dashboard to draw, so the
              dashboard is where it says so. */}
          {screen === 'dashboard' && isEmpty && (
            <EmptyState
              title="Start with a client"
              body="Add whoever is paying you. Projects, hours and invoices all hang off a client, and Trackit starts working out your real hourly rate from the first entry."
              action={{
                label: 'Add your first client',
                kbd: '⌘N',
                onClick: () => setModal('client')
              }}
              aside={<>or <a href="#">import from a CSV</a></>}
            />
          )}

          {screen === 'dashboard' && !isEmpty && (
            <div className="main__content">
              <MetricCards />
              {/* The table owns this one, because it owns the heading above
                  the rows and that heading is known while they load. */}
              <ProjectsTable rateFloorCents={rateFloorCents} loading={forceLoading} />
              <AttentionList />
            </div>
          )}

          {screen === 'clients' && (
            <>
              <ListToolbar />
              <div className="main__content">
                <ClientsTable
                  selectedId={selectedClientId ?? undefined}
                  onOpen={(id) => {
                    setSelectedClientId(id)
                    setScreen('client')
                  }}
                  onNewClient={() => setModal('client')}
                  loading={forceLoading}
                />
              </div>
            </>
          )}

          {screen === 'projects' && (
            <>
              <ProjectsToolbar />
              <div className="main__content">
                {forceLoading ? (
                  <TableSkeleton block="all-projects" />
                ) : (
                  <AllProjectsTable onOpen={() => setScreen('project')} />
                )}
              </div>
            </>
          )}

          {screen === 'invoices' && (
            <InvoicesScreen register={register} onOpen={openDetail} loading={forceLoading} />
          )}

          {screen === 'invoice' && (
            <div className="main__content">
              {/* Interim: the fixture document, and two actions that cannot
                  write anywhere yet — the register they used to edit is now
                  read-only. Task 18 puts both on invoices.send / invoices.void. */}
              <InvoiceDetail
                invoice={invoice}
                onOpen={openDetail}
                onMarkSent={() => undefined}
                onRecordPayment={() => setModal('payment')}
                onVoid={() => undefined}
              />
            </div>
          )}

          {screen === 'client' && selectedClientId && (
            <div className="main__content">
              <ClientDetail
                clientId={selectedClientId}
                onOpenProject={(id) => {
                  setSelectedProjectId(id)
                  setScreen('project')
                }}
                onOpenInvoice={(id) => {
                  setOpenInvoiceId(id)
                  setScreen('invoice')
                }}
                loading={forceLoading}
              />
            </div>
          )}

          {screen === 'project' && (
            <div className="main__content">
              <ProjectDetail
                onCreateInvoice={onCreateInvoice}
                rateFloorCents={rateFloorCents}
                conflict={notice === 'conflict'}
                reorderConflict={notice === 'reorder'}
                onDelivered={(project) => pushToast(deliveredToast(project))}
              />
            </div>
          )}
        </main>
      </div>

      {modal === 'client' && (
        <NewClientModal
          onClose={() => setModal(null)}
          onCreated={(id) => setSelectedClientId(id)}
        />
      )}
      {modal === 'project' && (
        <NewProjectModal onClose={() => setModal(null)} rateFloorCents={rateFloorCents} />
      )}
      {modal === 'payment' && (
        /* Interim, as above: the dialog states the consequence and closes,
           and records nothing until Task 18 gives it payments.create. */
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setModal(null)}
          onRecord={() => setModal(null)}
        />
      )}

      {/*
       * Not a modal: a timer left running by a session that never ended is a
       * condition of the launch, so the dialog appears over whatever screen is
       * up and stays until it is answered. Every answer invalidates the time
       * queries, which is what takes it away.
       */}
      {orphan && !recoveryDismissed && runningProject && (
        <TimerRecoveryDialog
          entry={orphan}
          projectName={runningProject.name}
          alreadyLoggedMinutes={totalMinutes(
            runningProjectEntries.filter((entry) => entry.id !== orphan.id)
          )}
          nowMs={nowMs}
          onResolve={(choice) => {
            /* The dialog goes on the click rather than on the refetch, so the
               frame between them is not a dialog answering itself. A write that
               is refused brings it back — the timer still has to become
               something, and the error toast says what went wrong. */
            const reopen = { onError: () => setRecoveryDismissed(false) }
            if (choice.kind === 'keep') stopTimer.mutate(undefined, reopen)
            if (choice.kind === 'trim') {
              updateTimeEntry.mutate(
                { id: orphan.id, patch: { endedAt: choice.endedAt } },
                reopen
              )
            }
            if (choice.kind === 'discard') deleteTimeEntry.mutate(orphan.id, reopen)
            setRecoveryDismissed(true)
          }}
        />
      )}

      {statePanel}
    </div>
  )
}
