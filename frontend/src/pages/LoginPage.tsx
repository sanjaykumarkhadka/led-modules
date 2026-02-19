import { useState } from 'react';

interface LoginPageProps {
  email: string;
  password: string;
  onSubmit: (email: string, password: string) => Promise<void> | void;
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" aria-hidden>
      <path
        d="M12 2.75 3.75 7.5v9L12 21.25l8.25-4.75v-9L12 2.75Zm0 2.3 5.95 3.42L12 11.9 6.05 8.47 12 5.05Zm-6 5.15 4.9 2.83v5.66L6 15.86V10.2Zm12 0v5.66l-4.9 2.83v-5.66l4.9-2.83Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-2 h-4 w-4" fill="none" aria-hidden>
      <path
        d="M5 12h14m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureIcon({ kind }: { kind: 'grid' | 'settings' | 'file' }) {
  if (kind === 'grid') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="none" aria-hidden>
        <path
          d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 7v-7h7v7h-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="none" aria-hidden>
        <path
          d="m12 3 1.5 2.7 3 .4.7 3 2.6 1.5-1 2.8 1 2.8-2.6 1.5-.7 3-3 .4L12 21l-1.5-2.7-3-.4-.7-3-2.6-1.5 1-2.8-1-2.8 2.6-1.5.7-3 3-.4L12 3Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13H7V3Zm7 1v5h5M9 12h8M9 16h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: 'grid' | 'settings' | 'file';
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm transition-colors hover:bg-zinc-800/50">
      <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950 p-2">
        <FeatureIcon kind={icon} />
      </div>
      <div>
        <h3 className="font-semibold text-zinc-50">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

export function LoginPage({
  email,
  password,
  onSubmit,
}: LoginPageProps) {
  const [localEmail, setLocalEmail] = useState(email || 'test@example.com');
  const [localPassword, setLocalPassword] = useState(password || 'password');

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#09090b] text-zinc-50">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-zinc-800 bg-zinc-900 p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(29,78,216,0.28),_transparent_46%)]" />

        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600">
              <BrandIcon />
            </div>
            <span className="text-xl font-bold tracking-tight">LED Modules</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Professional LED signage planning, <span className="text-blue-500">reimagined</span>.
          </h1>

          <p className="max-w-md text-lg text-zinc-400">
            Build channel-letter layouts, validate module placement, and export production-ready
            documentation from a single clean interface.
          </p>
        </div>

        <div className="relative z-10 grid gap-6">
          <FeatureCard
            icon="grid"
            title="Organized Projects"
            description="Keep every job in one workspace."
          />
          <FeatureCard
            icon="settings"
            title="Signage Editor"
            description="Character-level LED placement controls."
          />
          <FeatureCard
            icon="file"
            title="Engineering Output"
            description="Power and BOM insights with PDF export."
          />
        </div>

        <div className="relative z-10 text-sm text-zinc-500">© 2024 LED Modules Inc.</div>
      </div>

      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(30,58,138,0.24),_transparent_55%)]" />

        <div className="relative z-10 w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900/50 shadow-xl backdrop-blur-sm">
          <div className="space-y-1 p-6">
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="text-sm text-zinc-400">Access your project workspace.</p>
          </div>
          <div className="p-6 pt-0">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await onSubmit(localEmail, localPassword);
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm text-zinc-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={localEmail}
                  onChange={(e) => setLocalEmail(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm text-zinc-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={localPassword}
                  onChange={(e) => setLocalPassword(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                Sign in <ArrowRightIcon />
              </button>
            </form>
          </div>
          <div className="flex flex-col gap-2 p-6 pt-0">
            <div className="w-full text-center text-xs text-zinc-500">
              By clicking continue, you agree to our Terms of Service and Privacy Policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
