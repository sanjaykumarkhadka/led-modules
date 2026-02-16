import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface AppLayoutProps {
  userDisplayName: string;
  onLogout: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ userDisplayName, onLogout, headerActions, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-transparent text-[var(--text-1)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-1)] bg-[rgba(6,12,18,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1460px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-[var(--accent-700)] bg-[var(--accent-soft)] text-sm font-bold tracking-wider text-[var(--accent-300)]">
              QW
            </div>
            <div>
              <p className="text-sm font-semibold">Qwatt Studio</p>
              <p className="text-xs text-[var(--text-3)]">LED channel-letter engineering workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {headerActions}
            <Badge>{userDisplayName}</Badge>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main>
        <div className="mx-auto w-full max-w-[1460px] px-4 py-6 md:px-6 md:py-7">{children}</div>
      </main>
    </div>
  );
}
