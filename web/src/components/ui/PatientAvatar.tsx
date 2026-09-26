function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PatientAvatar({ name }: { name: string }) {
  return (
    <span
      role="img"
      aria-label={name}
      className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-mint text-sm font-semibold text-primary-hover"
    >
      {initials(name)}
    </span>
  );
}
