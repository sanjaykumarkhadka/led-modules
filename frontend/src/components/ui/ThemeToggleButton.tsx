import { useTheme } from './ThemeProvider';

export function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-elevated)] text-[var(--text-2)] shadow-[var(--shadow-sm)] transition-all duration-300 hover:scale-[1.03] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-400)]"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`absolute h-5 w-5 transition-all duration-500 ${
          dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      >
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M12 2.5V5.1" />
          <path d="M12 18.9v2.6" />
          <path d="M2.5 12H5.1" />
          <path d="M18.9 12h2.6" />
          <path d="m5.2 5.2 1.8 1.8" />
          <path d="m17 17 1.8 1.8" />
          <path d="m18.8 5.2-1.8 1.8" />
          <path d="m7 17-1.8 1.8" />
        </g>
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`absolute h-5 w-5 transition-all duration-500 ${
          dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
        }`}
      >
        <path
          d="M20.8 14.5A8.8 8.8 0 1 1 9.5 3.2a7.2 7.2 0 0 0 11.3 11.3Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
