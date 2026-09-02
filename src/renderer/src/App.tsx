import { useEffect, useMemo, useState, type JSX } from 'react'
import { ledger } from './bridge'
import { AllProjectsTable } from './components/AllProjectsTable'
import { AttentionList } from './components/AttentionList'
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
import { ProjectsToolbar } from './components/ProjectsToolbar'
import { RecordPaymentModal } from './components/RecordPaymentModal'
import { Sidebar, type NavKey } from './components/Sidebar'
import type { SyncState } from './components/SyncStatus'
import { TimerBar } from './components/TimerBar'
import { TimerRecoveryDialog } from './components/TimerRecoveryDialog'
import { TimeScreen } from './components/TimeScreen'
import { TopBar } from './components/TopBar'
import { TODAY } from './components/time-data'
import {
  invoices as seedInvoices,
  summarise,
  type Invoice,
  type Payment
} from './components/invoices-data'
import {
  StatePanel,
  type Modal,
  type Screen,
  type Theme,
  type TimerState
} from './dev/StatePanel'

/* The two the dev panel opens straight to: the richest partial, and the void. */
const SAMPLE_INVOICE = 'INV-0145'
const SAMPLE_VOID = 'INV-0137'

export function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  /* Create invoice is reached from three places now, so it remembers which one
     and names it in the breadcrumb rather than always claiming to come from the
     dashboard. */
  const [invoiceFrom, setInvoiceFrom] = useState<Screen>('dashboard')
  const [timer, setTimer] = useState<TimerState>('running')
  const [syncState, setSyncState] = useState<SyncState>('saved')
  const [theme, setTheme] = useState<Theme>('dark')

  /*
   * The register lives here rather than in either invoice screen, because both
   * of them read it: a payment recorded on a detail has to move the list's
   * outstanding figure, and a list that disagreed with the invoice you had just
   * settled would be the first thing anyone noticed.
   */
  const [register, setRegister] = useState<Invoice[]>(seedInvoices)
  const [openInvoice, setOpenInvoice] = useState(SAMPLE_INVOICE)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    // Only macOS keeps system traffic lights on a frameless window.
    if (ledger.platform === 'darwin') {
      document.documentElement.style.setProperty('--chrome-leading', '88px')
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
  const invoice = register.find((entry) => entry.number === openInvoice) ?? register[0]

  /** One place the register changes, so every screen reading it changes together. */
  const patch = (number: string, change: (entry: Invoice) => Invoice): void =>
    setRegister((current) =>
      current.map((entry) => (entry.number === number ? change(entry) : entry))
    )

  const onNavigate = (key: NavKey): void => {
    if (key === 'dashboard') setScreen('dashboard')
    if (key === 'clients') setScreen('clients')
    if (key === 'projects') setScreen('projects')
    if (key === 'time') setScreen('time')
    if (key === 'invoices') setScreen('invoices')
    // Settings has no screen yet.
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
          onStop={() => setTimer('off')}
        />
      )}

      <div className="app__body">
        <Sidebar
          variant={isEmpty ? 'empty' : 'populated'}
          active={
            isInvoices
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
          onNavigate={onNavigate}
        />

        <main className="main">
          {/* Time is the one screen that owns its whole header — see TimeScreen. */}
          {screen === 'time' ? (
            <TimeScreen isTopmost={!showTimerBar} />
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

          {screen === 'empty' && <EmptyState />}

          {screen === 'dashboard' && (
            <div className="main__content">
              <MetricCards />
              <ProjectsTable />
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
                <AllProjectsTable onOpen={() => setScreen('project')} />
              </div>
            </>
          )}

          {screen === 'invoices' && <InvoicesScreen register={register} onOpen={openDetail} />}

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
              <ProjectDetail onCreateInvoice={onCreateInvoice} />
            </div>
          )}
        </main>
      </div>

      {modal === 'client' && <NewClientModal onClose={() => setModal(null)} />}
      {modal === 'project' && <NewProjectModal onClose={() => setModal(null)} />}
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
            setModal(null)
          }}
        />
      )}

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
        timer={timer}
        onTimer={setTimer}
        syncState={syncState}
        onSyncState={setSyncState}
        theme={theme}
        onTheme={setTheme}
      />
    </div>
  )
}
