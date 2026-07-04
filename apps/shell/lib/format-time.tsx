const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  const t = date.getTime();
  if (Number.isNaN(t)) return "";

  const now = Date.now();
  const signedDelta = now - t;
  const isFuture = signedDelta < 0;
  const delta = Math.abs(signedDelta);

  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return isFuture ? `in ${Math.floor(delta / MINUTE)}m` : `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return isFuture ? `in ${Math.floor(delta / HOUR)}h` : `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return isFuture ? `in ${Math.floor(delta / DAY)}d` : `${Math.floor(delta / DAY)}d ago`;

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date(now).getFullYear()) {
    opts.year = "numeric";
  }
  return date.toLocaleDateString("en-US", opts);
}

export function formatAbsoluteTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

interface RelativeTimeProps {
  iso: string;
  className?: string;
}

export function RelativeTime({ iso, className }: RelativeTimeProps) {
  // formatRelativeTime ("2d ago") and formatAbsoluteTime (toLocaleString) both
  // derive from Date.now()/the local timezone, so the value computed during SSR
  // can differ from the client's first render — e.g. crossing a "just now" → "1m
  // ago" boundary, or a different server vs browser timezone. That surfaces as
  // React #418 (text content does not match server-rendered HTML). These drifts
  // are inherent to timestamps and cosmetically harmless, so suppress the
  // hydration warning on this node rather than block hydration over it.
  return (
    <time
      dateTime={iso}
      title={formatAbsoluteTime(iso)}
      className={className}
      suppressHydrationWarning
    >
      {formatRelativeTime(iso)}
    </time>
  );
}
