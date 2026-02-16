interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--danger-700)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger-300)]"
    >
      {message}
    </div>
  );
}
