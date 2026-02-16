import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsOverviewPage } from './pages/ProjectsOverviewPage';
import { DesignerPage } from './pages/DesignerPage';
import { useAuthStore } from './state/authStore';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { user, status: authStatus, errorMessage: authError, login, logout, bootstrap } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
  };

  if (authStatus === 'initializing' || authStatus === 'authenticating') {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-md">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent-500)] border-r-transparent" />
            <p className="text-sm text-[var(--text-2)]">Checking secure session...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-8 md:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-1)] p-7 shadow-[var(--shadow-md)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--accent-300)]">Qwatt Production Suite</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">Professional LED layout engineering, rebuilt for production teams.</h1>
            <p className="mt-3 max-w-xl text-sm text-[var(--text-3)]">
              Build accurate channel-letter designs, validate module population, and export engineering-ready plans with consistent quality control.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card title="Layout" description="High-fidelity character-level LED planning." />
              <Card title="Power" description="Instant module count and PSU recommendations." />
              <Card title="Export" description="Technical PDF output for handoff and archive." />
            </div>
          </section>

          <Card title="Sign in" description="Access your project workspace and continue where you left off.">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                error={authError || undefined}
              />
              <Button type="submit" className="w-full justify-center">
                Sign in to workspace
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      userDisplayName={user.displayName || user.email}
      onLogout={logout}
      headerActions={
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Print Preview
        </Button>
      }
    >
      <Routes>
        <Route path="/" element={<ProjectsOverviewPage />} />
        <Route path="/projects/:projectId" element={<DesignerPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
