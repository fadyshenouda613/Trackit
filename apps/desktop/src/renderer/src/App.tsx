import { useEffect, useMemo, useState, type JSX } from 'react'
import { ledger } from './bridge'
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
  paymentToast,
  pdfToast,
  timerToast,
  type ToastKind
} from './components/toast-data'
import { TimerBar } from './components/TimerBar'
import { TimerRecoveryDialog } from './components/TimerRecoveryDialog'
import { TimeScreen } from './components/TimeScreen'
import { TopBar } from './components/TopBar'
import { TODAY } from './components/time-data'
import { parseMoney } from '@trackit/shared'
import {
  clearSession,
  hasSeenWelcome,
  markWelcomeSeen,
  readSession,
  writeSession
} from './components/auth-session'
import { defaultSettings, type Settings } from './components/settings-data'
import {
  invoices as seedInvoices,
  summarise,
  type Invoice,
  type Payment
} from './components/invoices-data'
import {
  StatePanel,
  type AuthView,
  type DataState,
  type Modal,
  type NoticeState,
  type Screen,
  type TimerState
} from './dev/StatePanel'

/* The two the dev panel opens straight to: the richest partial, and the void. */
const SAMPLE_INVOICE = 'INV-0145'
const SAMPLE_VOID = 'INV-0137'

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
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  /* Create invoice is reached from three places now, so it remembers which one
     and names it in the breadcrumb rather than always claiming to come from the
     dashboard. */
  const [invoiceFrom, setInvoiceFrom] = useState<Screen>('dashboard')
  const [timer, setTimer] = useState<TimerState>('running')
  const [syncState, setSyncState] = useState<SyncState>('saved')
  const [notice, setNotice] = useState<NoticeState>('none')
  const [data, setData] = useState<DataState>('ready')
  const [theme, setTheme] = useState<Theme>(storedTheme)
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts()

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
   * The register lives here rather than in either invoice screen, because both
   * of them read it: a payment recorded on a detail has to move the list's
   * outstanding figure, and a list that disagreed with the invoice you had just
   * settled would be the first thing anyone noticed.
   */
  /*
   * Settings is the other thing more than one screen reads. The rate floor in
   * particular decides which figures the dashboard, the Projects table and the
   * New project dialog draw in red, so it cannot live inside the Settings
   * screen: changing it there has to change them here.
   */
  /* Seeded with the signed-in address, so Settings' "Signed in as" states who is
     actually signed in rather than the profile's own default. */
  const [settings, setSettings] = useState<Settings>(
    storedSession ? { ...defaultSettings, accountEmail: storedSession.email } : defaultSettings
  )

  const [register, setRegister] = useState<Invoice[]>(seedInvoices)
  const [openInvoice, setOpenInvoice] = useState(SAMPLE_INVOICE)

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

  const isEmpty = screen === 'empty'
  const isClients = screen === 'clients' || screen === 'client'
  const isProjects = screen === 'projects' || screen === 'project'
  const isInvoices = screen === 'invoices' || screen === 'invoice' || screen === 'newInvoice'
  /*
   * The timer bar is window chrome, not part of a screen: "spans the full
   * window above everything and only exists while a timer runs". A new account
   * has nothing to time, so only the empty screen suppresses it.
   */
  const showTimerBar = timer !== 'off' && !isEmpty

  const figures = useMemo(() => summarise(register), [register])
  /* Held as typed text, read back as a number at the one place it is used. */
  const rateFloor = parseMoney(settings.rateFloor) ?? 0
  const invoice = register.find((entry) => entry.number === openInvoice) ?? register[0]

  const patchSettings = (change: Partial<Settings>): void =>
    setSettings((current) => ({ ...current, ...change }))

  /** One place the register changes, so every screen reading it changes together. */
  const patch = (number: string, change: (entry: Invoice) => Invoice): void =>
    setRegister((current) =>
      current.map((entry) => (entry.number === number ? change(entry) : entry))
    )

  /** Signing in and signing up both end here: store it, name it, drop the gate. */
  const enter = (email: string, name: string, view: AuthView | null): void => {
    writeSession({ version: 1, email, name })
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

  const openDetail = (number: string): void => {
    setOpenInvoice(number)
    setScreen('invoice')
  }

  const backFrom = (from: Screen): { label: string; onClick: () => void } =>
    from === 'project'
      ? { label: 'Brand refresh', onClick: () => setScreen('project') }
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
        if (next === 'newClient') {
          setScreen('clients')
          setModal('client')
        } else if (next === 'newProject') {
          setScreen('projects')
          setModal('project')
        } else if (next === 'recovery') {
          setScreen('time')
          setModal('recovery')
        } else if (next === 'voidInvoice') {
          setOpenInvoice(SAMPLE_VOID)
          setScreen('invoice')
        } else if (next === 'payment') {
          setOpenInvoice(SAMPLE_INVOICE)
          setScreen('invoice')
          setModal('payment')
        } else {
          if (next === 'invoice') setOpenInvoice(SAMPLE_INVOICE)
          if (next === 'newInvoice') setInvoiceFrom('invoices')
          setScreen(next)
        }
      }}
      modal={modal}
      authView={authView}
      onAuthView={setAuthView}
      timer={timer}
      onTimer={setTimer}
      syncState={syncState}
      onSyncState={setSyncState}
      notice={notice}
      onNotice={(next) => {
        /* The two conflict notices live on the project screen, so choosing one
           from anywhere else has to take you where it can be seen. */
        if (next === 'conflict' || next === 'reorder') setScreen('project')
        setNotice(next)
      }}
      data={data}
      onData={setData}
      onToast={(kind: ToastKind) => {
        if (kind === 'pdf') pushToast(pdfToast('INV-0148'))
        if (kind === 'payment') pushToast(paymentToast(2400, 'INV-0145'))
        if (kind === 'delivered') pushToast(deliveredToast('Brand refresh'))
        if (kind === 'timer') pushToast(timerToast(84, 'Brand refresh'))
      }}
      theme={theme}
      onTheme={setTheme}
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
          /* The welcome card's single action: into the app, on the screen a new
             account actually has — the empty dashboard. */
          onEnterApp={() => {
            setScreen('empty')
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
      {showTimerBar && (
        <TimerBar
          client="Northwind Studio"
          project="Brand refresh"
          deliverable="Logo lockups"
          loggedMinutes={timer === 'over' ? 1960 : 1695}
          budgetMinutes={1920}
          elapsed={timer === 'over' ? '04:11:52' : '01:24:36'}
          onStop={() => {
            /* The bar takes the elapsed clock with it when it goes, so this is
               the only place the hours just logged are ever stated. */
            pushToast(timerToast(timer === 'over' ? 1960 : 1695, 'Brand refresh'))
            setTimer('off')
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
          counts={
            isProjects || screen === 'time'
              ? { clients: '8', projects: '14' }
              : isClients
                ? { clients: '8', projects: '6' }
                : { clients: '7', projects: '6' }
          }
          /* The badge is the overdue count, so it is counted rather than typed. */
          overdueInvoices={figures.overdueCount}
          timerRunning={timer !== 'off'}
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
              settings={settings}
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
              title="Northwind Studio"
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
                    onClick={() => setModal('project')}
                  >
                    New project
                  </button>
                </>
              }
            />
          ) : screen === 'clients' ? (
            <TopBar
              title="Clients"
              meta="8 active"
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
              meta="14 total · 6 active"
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
              meta="Friday, 28 August 2026"
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

          {screen === 'empty' && (
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

          {screen === 'dashboard' && (
            <div className="main__content">
              <MetricCards />
              {/* The table owns this one, because it owns the heading above
                  the rows and that heading is known while they load. */}
              <ProjectsTable rateFloor={rateFloor} loading={data === 'loading'} />
              <AttentionList />
            </div>
          )}

          {screen === 'clients' && (
            <>
              <ListToolbar />
              <div className="main__content">
                <ClientsTable selectedId="northwind" onOpen={() => setScreen('client')} />
              </div>
            </>
          )}

          {screen === 'projects' && (
            <>
              <ProjectsToolbar />
              <div className="main__content">
                {data === 'loading' ? (
                  <TableSkeleton block="all-projects" />
                ) : (
                  <AllProjectsTable onOpen={() => setScreen('project')} />
                )}
              </div>
            </>
          )}

          {screen === 'invoices' && (
            <InvoicesScreen
              register={register}
              onOpen={openDetail}
              loading={data === 'loading'}
            />
          )}

          {screen === 'invoice' && (
            <div className="main__content">
              <InvoiceDetail
                invoice={invoice}
                onOpen={openDetail}
                onMarkSent={() => patch(invoice.number, (entry) => ({ ...entry, issued: TODAY }))}
                onRecordPayment={() => setModal('payment')}
                onVoid={() =>
                  patch(invoice.number, (entry) => ({
                    ...entry,
                    voided: { date: TODAY, reason: 'Cancelled before payment' }
                  }))
                }
              />
            </div>
          )}

          {screen === 'client' && (
            <div className="main__content">
              <ClientDetail />
            </div>
          )}

          {screen === 'project' && (
            <div className="main__content">
              <ProjectDetail
                onCreateInvoice={onCreateInvoice}
                rateFloor={rateFloor}
                conflict={notice === 'conflict'}
                reorderConflict={notice === 'reorder'}
                onDelivered={(project) => pushToast(deliveredToast(project))}
              />
            </div>
          )}
        </main>
      </div>

      {modal === 'client' && <NewClientModal onClose={() => setModal(null)} />}
      {modal === 'project' && (
        <NewProjectModal onClose={() => setModal(null)} rateFloor={rateFloor} />
      )}
      {modal === 'recovery' && <TimerRecoveryDialog onResolve={() => setModal(null)} />}
      {modal === 'payment' && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setModal(null)}
          onRecord={(payment: Payment) => {
            patch(invoice.number, (entry) => ({
              ...entry,
              payments: [...entry.payments, payment]
            }))
            /* The dialog closes over the figure it just changed, so the toast
               restates the amount against the invoice it landed on. */
            pushToast(paymentToast(payment.amount, invoice.number))
            setModal(null)
          }}
        />
      )}

      {statePanel}
    </div>
  )
}
