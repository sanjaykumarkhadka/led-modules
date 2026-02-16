import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../data/store';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';

interface AppLayoutProps {
  userDisplayName: string;
  onLogout: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

const navItems = [{ label: 'Projects', path: '/' }];

export function AppLayout({ userDisplayName, onLogout, headerActions, children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesignerRoute = location.pathname.startsWith('/projects/');
  const editorCharId = useProjectStore((state) => state.editorCharId);
  const showGlobalHeader = !editorCharId;

  return (
    <div className="min-h-screen text-[var(--text-1)]">
      {showGlobalHeader && (
        <header className="sticky top-0 z-40 border-b border-[var(--border-1)] bg-[var(--header-bg)] backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-600)]">
                L
              </div>
              <div>
                <p className="text-[15px] font-semibold">Led-modules</p>
                <p className="text-xs text-[var(--text-3)]">Signage engineering workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggleButton />
              {headerActions}
              <Badge>{userDisplayName}</Badge>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto grid w-full max-w-[1680px] ${
          showGlobalHeader ? 'min-h-[calc(100vh-76px)]' : 'min-h-screen'
        } grid-cols-1 gap-4 px-4 py-4 md:px-6 ${
          isDesignerRoute ? '' : 'md:grid-cols-[220px_minmax(0,1fr)]'
        }`}
      >
        {!isDesignerRoute && (
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
            isDesignerRoute
              ? 'rounded-none border-0 bg-transparent p-0 shadow-none'
              : 'h-full rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-canvas)] p-4 shadow-[var(--shadow-sm)] md:p-6'
          }
        >
          {children}
        </section>
      </main>
    </div>
  );
}
