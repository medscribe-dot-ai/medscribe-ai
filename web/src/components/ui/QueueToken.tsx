export function QueueToken({ token }: { token: string }) {
  return (
    <span className="inline-flex min-h-10 max-w-full items-center break-all rounded-md border border-primary/40 bg-mint px-3 text-base font-semibold text-primary-hover">
      Token {token}
    </span>
  );
}
