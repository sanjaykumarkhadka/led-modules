import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsOverviewPage } from './pages/ProjectsOverviewPage';
import { DesignerPage } from './pages/DesignerPage';
import { ManualEditorRoutePage } from './pages/ManualEditorRoutePage';
import { useAuthStore } from './state/authStore';
import { ThemeToggleButton } from './components/ui/ThemeToggleButton';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { user, status: authStatus, errorMessage: authError, login, logout, bootstrap } =
    useAuthStore();

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
      <div className="min-h-screen px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-[1580px]">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-600)]">
                L
              </div>
              <span className="text-3xl font-medium text-[var(--text-1)]">Led-modules</span>
            </div>
            <ThemeToggleButton />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.35fr_0.9fr]">
            <section className="rounded-[var(--radius-lg)] border border-[var(--border-1)] bg-[var(--surface-canvas)] p-8 shadow-[var(--shadow-md)]">
              <h1 className="text-4xl font-semibold leading-tight text-[var(--text-1)]">
                Professional LED signage planning, organized like modern cloud workspace software.
              </h1>
              <p className="mt-4 max-w-2xl text-base text-[var(--text-3)]">
                Build channel-letter layouts, validate module placement, and export production-ready documentation from a single clean interface.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <Card
                  title="Organized Projects"
                  description="Keep every job in one workspace."
                  className="bg-[var(--surface-panel)]"
                />
                <Card
                  title="Signage Editor"
                  description="Character-level LED placement controls."
                  className="bg-[var(--surface-panel)]"
                />
                <Card
                  title="Engineering Output"
                  description="Power and BOM insights with PDF export."
                  className="bg-[var(--surface-panel)]"
                />
              </div>
            </section>

            <Card title="Sign in" description="Access your project workspace.">
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  error={authError || undefined}
                />
                <Button type="submit" className="w-full justify-center">
                  Sign in
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout userDisplayName={user.displayName || user.email} onLogout={logout}>
      <Routes>
        <Route path="/" element={<ProjectsOverviewPage />} />
        <Route path="/projects/:projectId" element={<DesignerPage />} />
        <Route path="/projects/:projectId/manual/:charId" element={<ManualEditorRoutePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
