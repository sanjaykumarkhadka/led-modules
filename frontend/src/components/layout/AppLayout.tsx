import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

interface AppLayoutProps {
  userDisplayName: string;
  onLogout: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({
  userDisplayName,
  onLogout,
  headerActions,
  children,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-sm font-bold tracking-tight">QW</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Qwatt LED Studio</div>
              <div className="text-xs text-slate-400">
                Professional channel letter layout & power planning
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {headerActions}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="hidden sm:inline">Signed in as</span>
              <span className="px-2 py-1 rounded-full bg-slate-900/80 text-slate-100 border border-slate-700/80">
                {userDisplayName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="text-xs px-3 py-1.5"
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}

