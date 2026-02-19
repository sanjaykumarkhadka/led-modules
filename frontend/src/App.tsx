import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Card } from './components/ui/Card';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { DesignerPage } from './pages/DesignerPage';
import { ManualEditorRoutePage } from './pages/ManualEditorRoutePage';
import { useAuthStore } from './state/authStore';
import { LoginPage } from './pages/LoginPage';
import { useToast } from './components/ui/ToastProvider';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { notify } = useToast();
  const lastAuthErrorRef = useRef<string | null>(null);

  const { user, status: authStatus, errorMessage: authError, login, logout, bootstrap } =
    useAuthStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!authError) return;
    if (authError === lastAuthErrorRef.current) return;
    lastAuthErrorRef.current = authError;
    notify({
      variant: 'error',
      title: 'Authentication failed',
      description: authError,
    });
  }, [authError, notify]);

  useEffect(() => {
    const handler = () => {
      logout();
      notify({
        variant: 'error',
        title: 'Session expired',
        description: 'Please log in again.',
      });
    };
    window.addEventListener('auth:unauthorized', handler as EventListener);
    return () => {
      window.removeEventListener('auth:unauthorized', handler as EventListener);
    };
  }, [logout, notify]);

  const handleAuthSubmit = async (nextEmail: string, nextPassword: string) => {
    setEmail(nextEmail);
    setPassword(nextPassword);
    await login({ email: nextEmail, password: nextPassword });
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
      <LoginPage
        email={email}
        password={password}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <AppLayout userDisplayName={user.displayName || user.email} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/favorites" element={<ProjectsListPage mode="favorites" />} />
        <Route path="/projects/:projectId" element={<DesignerPage />} />
        <Route path="/projects/:projectId/manual/:charId" element={<ManualEditorRoutePage />} />
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
