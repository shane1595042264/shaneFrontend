const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  const t = date.getTime();
  if (Number.isNaN(t)) return "";

  const now = Date.now();
  const delta = Math.max(0, now - t);

  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

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
  return (
    <time dateTime={iso} title={formatAbsoluteTime(iso)} className={className}>
      {formatRelativeTime(iso)}
    </time>
  );
}
