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

  const {
    user,
    status: authStatus,
    errorMessage: authError,
    login,
    logout,
    bootstrap,
  } = useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
  };

  if (authStatus === 'initializing' || authStatus === 'authenticating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-400 text-sm">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-8 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Design production-ready LED layouts with confidence.
            </h1>
            <p className="text-sm text-slate-400 max-w-md">
              Qwatt helps signage teams plan LED population, wiring, and power with accurate
              engineering data — so every channel letter ships right the first time.
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>• Rapid LED population with manual fine-tuning</li>
              <li>• Instant power calculations and PSU recommendations</li>
              <li>• Project-based workflow for your entire team</li>
            </ul>
          </div>
          <Card title="Sign in" description="Access your projects and continue where you left off.">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  error={undefined}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  error={authError || undefined}
                />
              </div>
              <Button type="submit" className="w-full justify-center">
                Log in
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
        <Button variant="outline" onClick={() => window.print()}>
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
