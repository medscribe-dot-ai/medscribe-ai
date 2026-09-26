export function Spinner({ label = "Loading", labelled = true }: { label?: string; labelled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold" role="status">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      {labelled ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
