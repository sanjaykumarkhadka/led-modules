import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';

interface AppLayoutProps {
  userDisplayName: string;
  onLogout: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

const navItems = [
  { label: 'Projects', path: '/projects' },
  { label: 'Favorites', path: '/favorites' },
];

export function AppLayout({ userDisplayName, onLogout, headerActions, children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesignerRoute = location.pathname.startsWith('/projects/');
  const isProjectsListRoute = location.pathname === '/projects' || location.pathname === '/favorites';
  const isManualEditorRoute = location.pathname.includes('/manual/');
  const isProjectDetailsRoute = isDesignerRoute && !isManualEditorRoute;

  return (
    <div className="min-h-screen bg-[var(--surface-app)] text-[var(--text-1)]">
      {!isManualEditorRoute && (
        <header className="sticky top-0 z-40 border-b border-[var(--border-1)] bg-[var(--header-bg)] backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex items-center gap-8">
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 text-lg font-bold text-[var(--text-1)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-600">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" aria-hidden>
                    <path
                      d="M12 2.75 3.75 7.5v9L12 21.25l8.25-4.75v-9L12 2.75Zm0 2.3 5.95 3.42L12 11.9 6.05 8.47 12 5.05Zm-6 5.15 4.9 2.83v5.66L6 15.86V10.2Zm12 0v5.66l-4.9 2.83v-5.66l4.9-2.83Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span>LED Modules</span>
              </button>

              <nav className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/projects'
                      ? 'text-[var(--text-1)]'
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                >
                  Projects
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/favorites')}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/favorites'
                      ? 'text-[var(--text-1)]'
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                >
                  Favorites
                </button>
              </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {headerActions}
              <ThemeToggleButton />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-subtle)]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                  <path
                    d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="hidden sm:inline">{userDisplayName}</span>
              </button>
              <Button variant="ghost" size="icon" onClick={onLogout} className="text-[var(--text-3)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-1)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                  <path
                    d="M15 17l5-5-5-5M20 12H9M12 19v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto grid w-full ${
          isManualEditorRoute
            ? 'max-w-none gap-0 px-0 py-0 h-screen overflow-hidden'
            : isProjectDetailsRoute
              ? 'max-w-none h-[calc(100vh-64px)] min-h-[calc(100vh-64px)] gap-0 px-0 py-0 overflow-hidden'
              : isProjectsListRoute
                ? 'max-w-[1680px] min-h-[calc(100vh-64px)] gap-0 px-4 py-4 md:px-6'
              : 'max-w-[1680px] min-h-[calc(100vh-64px)] gap-4 px-4 py-4 md:px-6'
        } grid-cols-1 ${
          isDesignerRoute || isProjectsListRoute ? '' : 'md:grid-cols-[220px_minmax(0,1fr)]'
        }`}
      >
        {!isDesignerRoute && !isProjectsListRoute && (
          <aside className="h-full rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-panel)] p-4 shadow-[var(--shadow-sm)]">
            <nav className="space-y-1">
              {navItems.map((item, idx) => (
                <button
                  key={`${item.label}-${idx}`}
                  type="button"
                  onClick={() => item.path && navigate(item.path)}
                  className={`block w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors ${
                    item.path && location.pathname === item.path
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-600)]'
                      : 'text-[var(--text-2)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>
        )}

        <section
          className={
            isManualEditorRoute
              ? 'h-full min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none overflow-hidden'
              : isDesignerRoute || isProjectsListRoute
                ? 'h-full min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none overflow-hidden'
              : 'h-full rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-canvas)] p-4 shadow-[var(--shadow-sm)] md:p-6'
          }
        >
          {children}
        </section>
      </main>
    </div>
  );
}
