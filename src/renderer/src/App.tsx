import { useEffect, useState, type JSX } from 'react'
import { ledger } from './bridge'
import { AllProjectsTable } from './components/AllProjectsTable'
import { AttentionList } from './components/AttentionList'
import { ClientDetail } from './components/ClientDetail'
import { ClientsTable } from './components/ClientsTable'
import { EmptyState } from './components/EmptyState'
import { ListToolbar } from './components/ListToolbar'
import { MetricCards } from './components/MetricCards'
import { NewClientModal } from './components/NewClientModal'
import { NewProjectModal } from './components/NewProjectModal'
import { ProjectsTable } from './components/ProjectsTable'
import { ProjectsToolbar } from './components/ProjectsToolbar'
import { Sidebar, type NavKey } from './components/Sidebar'
import type { SyncState } from './components/SyncStatus'
import { TimerBar } from './components/TimerBar'
import { TopBar } from './components/TopBar'
import { StatePanel, type Modal, type Screen, type Theme } from './dev/StatePanel'

export function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  const [timerRunning, setTimerRunning] = useState(true)
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
  const isProjects = screen === 'projects'
  /*
   * The timer bar is window chrome, not part of a screen: "spans the full
   * window above everything and only exists while a timer runs". A new account
   * has nothing to time, so only the empty screen suppresses it.
   */
  const showTimerBar = timerRunning && !isEmpty

  const onNavigate = (key: NavKey): void => {
    if (key === 'dashboard') setScreen('dashboard')
    if (key === 'clients') setScreen('clients')
    if (key === 'projects') setScreen('projects')
    // The other destinations have no screens designed yet.
  }

  return (
    <div className="app">
      {showTimerBar && <TimerBar />}

      <div className="app__body">
        <Sidebar
          variant={isEmpty ? 'empty' : 'populated'}
          active={isClients ? 'clients' : isProjects ? 'projects' : 'dashboard'}
          counts={
            isProjects
              ? { clients: '8', projects: '14' }
              : isClients
                ? { clients: '8', projects: '6' }
                : { clients: '7', projects: '6' }
          }
          timerRunning={timerRunning}
          syncState={syncState}
          onNavigate={onNavigate}
        />

        <main className="main">
          {screen === 'client' ? (
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
              meta="Monday, 31 August 2026"
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
                <AllProjectsTable />
              </div>
            </>
          )}

          {screen === 'client' && (
            <div className="main__content">
              <ClientDetail />
            </div>
          )}
        </main>
      </div>

      {modal === 'client' && <NewClientModal onClose={() => setModal(null)} />}
      {modal === 'project' && <NewProjectModal onClose={() => setModal(null)} />}

      <StatePanel
        screen={screen}
        onScreen={(next) => {
          if (next === 'newClient') {
            setScreen('clients')
            setModal('client')
          } else if (next === 'newProject') {
            setScreen('projects')
            setModal('project')
          } else {
            setScreen(next)
            setModal(null)
          }
        }}
        modal={modal}
        timerRunning={timerRunning}
        onTimerRunning={setTimerRunning}
        syncState={syncState}
        onSyncState={setSyncState}
        theme={theme}
        onTheme={setTheme}
      />
    </div>
  )
}
