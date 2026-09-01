import { useEffect, useState, type JSX } from 'react'
import { ledger } from './bridge'
import { AllProjectsTable } from './components/AllProjectsTable'
import { AttentionList } from './components/AttentionList'
import { ClientDetail } from './components/ClientDetail'
import { ClientsTable } from './components/ClientsTable'
import { EmptyState } from './components/EmptyState'
import { InvoiceScreen } from './components/InvoiceScreen'
import { ListToolbar } from './components/ListToolbar'
import { MetricCards } from './components/MetricCards'
import { NewClientModal } from './components/NewClientModal'
import { NewProjectModal } from './components/NewProjectModal'
import { ProjectDetail } from './components/ProjectDetail'
import { ProjectsTable } from './components/ProjectsTable'
import { ProjectsToolbar } from './components/ProjectsToolbar'
import { Sidebar, type NavKey } from './components/Sidebar'
import type { SyncState } from './components/SyncStatus'
import { TimerBar } from './components/TimerBar'
import { TimerRecoveryDialog } from './components/TimerRecoveryDialog'
import { TimeScreen } from './components/TimeScreen'
import { TopBar } from './components/TopBar'
import {
  StatePanel,
  type Modal,
  type Screen,
  type Theme,
  type TimerState
} from './dev/StatePanel'

export function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  /* Create invoice is reached from two places, so it remembers which one and
     names it in the breadcrumb rather than always claiming to come from a list
     that does not exist yet. */
  const [invoiceFrom, setInvoiceFrom] = useState<Screen>('dashboard')
  const [timer, setTimer] = useState<TimerState>('running')
  const [syncState, setSyncState] = useState<SyncState>('saved')
  const [theme, setTheme] = useState<Theme>('dark')

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
  /*
   * The timer bar is window chrome, not part of a screen: "spans the full
   * window above everything and only exists while a timer runs". A new account
   * has nothing to time, so only the empty screen suppresses it.
   */
  const showTimerBar = timer !== 'off' && !isEmpty

  const onNavigate = (key: NavKey): void => {
    if (key === 'dashboard') setScreen('dashboard')
    if (key === 'clients') setScreen('clients')
    if (key === 'projects') setScreen('projects')
    if (key === 'time') setScreen('time')
    // Invoices wants a list, which is not designed yet; Settings has no screen
    // either. Create invoice is reached from a delivered project instead.
  }

  const onCreateInvoice = (): void => {
    setInvoiceFrom(screen)
    setScreen('newInvoice')
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
          onStop={() => setTimer('off')}
        />
      )}

      <div className="app__body">
        <Sidebar
          variant={isEmpty ? 'empty' : 'populated'}
          active={
            screen === 'newInvoice'
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
              back={
                invoiceFrom === 'project'
                  ? { label: 'Brand refresh', onClick: () => setScreen('project') }
                  : { label: 'Dashboard', onClick: () => setScreen('dashboard') }
              }
              /* The one project detail screen designed belongs to Northwind. */
              initialClientId={invoiceFrom === 'project' ? 'northwind' : undefined}
              onOpenProjects={() => setScreen('projects')}
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

      <StatePanel
        screen={screen}
        onScreen={(next) => {
          if (next === 'newClient') {
            setScreen('clients')
            setModal('client')
          } else if (next === 'newProject') {
            setScreen('projects')
            setModal('project')
          } else if (next === 'recovery') {
            setScreen('time')
            setModal('recovery')
          } else {
            setScreen(next)
            setModal(null)
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
