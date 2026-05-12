import { getActivities, type Activity } from "@/lib/api/activities";

interface Props {
  date: string;
}

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  strava: "Strava",
  google_calendar: "Calendar",
  google_maps: "Locations",
  owntracks: "Locations",
  twitch: "Twitch",
  wechat: "WeChat",
  discord: "Discord",
};

const SOURCE_ICONS: Record<string, string> = {
  github: "⬢",
  strava: "🏃",
  google_calendar: "📅",
  google_maps: "📍",
  owntracks: "📍",
  twitch: "📺",
  wechat: "💬",
  discord: "💬",
};

interface Row {
  id: string;
  label: string;
  href?: string;
}

function summarize(a: Activity): string {
  const d = a.data;
  switch (a.source) {
    case "github": {
      const repo = (d.repo as string) ?? "unknown repo";
      const msg = ((d.message as string) ?? "").split("\n")[0].trim();
      return `[${repo}] ${msg || "(no message)"}`;
    }
    case "strava": {
      const name = (d.name as string) ?? a.type;
      const dist = d.distanceMeters as number | undefined;
      if (dist && dist > 0) return `${name} — ${(dist / 1000).toFixed(1)} km`;
      return name;
    }
    case "google_calendar": {
      const title = (d.title as string) ?? (d.summary as string) ?? "Event";
      const start = (d.startTime ?? d.start) as string | undefined;
      return start ? `${title} @ ${start}` : title;
    }
    case "twitch": {
      const title = (d.title as string) ?? "Untitled stream";
      return title;
    }
    case "wechat":
    case "discord": {
      const chat = (d.chat as string) ?? (d.channelId as string) ?? "chat";
      return `Message in ${chat}`;
    }
    default:
      return a.type;
  }
}

const STOP_RADIUS_METERS = 250;
const STOP_MAX_GAP_MS = 60 * 60 * 1000;
const STOP_MIN_DURATION_MS = 10 * 60 * 1000;

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function summarizeLocations(items: Activity[]): { rows: Row[]; backgroundPings: number } {
  const namedEvents: Array<{ a: Activity; t: Date }> = [];
  const pings: Array<{ a: Activity; t: Date; lat: number; lon: number }> = [];

  for (const a of items) {
    const d = a.data;
    const tRaw = d.timestamp as string | undefined;
    if (!tRaw) continue;
    const t = new Date(tRaw);
    if (Number.isNaN(t.getTime())) continue;

    const name = d.name as string | undefined;
    if ((a.type === "place_enter" || a.type === "place_leave") && name) {
      namedEvents.push({ a, t });
      continue;
    }
    const lat = d.latitude as number | undefined;
    const lon = d.longitude as number | undefined;
    if (typeof lat === "number" && typeof lon === "number") {
      pings.push({ a, t, lat, lon });
    }
  }

  pings.sort((a, b) => a.t.getTime() - b.t.getTime());

  type Cluster = { lat: number; lon: number; start: Date; end: Date; count: number; firstId: string };
  const clusters: Cluster[] = [];
  for (const p of pings) {
    const last = clusters[clusters.length - 1];
    if (
      last &&
      distanceMeters(last, p) <= STOP_RADIUS_METERS &&
      p.t.getTime() - last.end.getTime() <= STOP_MAX_GAP_MS
    ) {
      last.lat = (last.lat * last.count + p.lat) / (last.count + 1);
      last.lon = (last.lon * last.count + p.lon) / (last.count + 1);
      last.end = p.t;
      last.count += 1;
    } else {
      clusters.push({ lat: p.lat, lon: p.lon, start: p.t, end: p.t, count: 1, firstId: p.a.id });
    }
  }

  const stops = clusters.filter(
    (c) => c.count >= 2 && c.end.getTime() - c.start.getTime() >= STOP_MIN_DURATION_MS
  );
  const droppedPings = clusters
    .filter((c) => !stops.includes(c))
    .reduce((sum, c) => sum + c.count, 0);

  const rows: Row[] = [];

  for (const n of namedEvents) {
    const d = n.a.data;
    const ev = n.a.type === "place_enter" ? "Arrived at" : "Left";
    const name = d.name as string;
    rows.push({ id: n.a.id, label: `${ev} ${name} · ${formatTime(n.t)}` });
  }

  for (const c of stops) {
    const href = `https://www.google.com/maps?q=${c.lat.toFixed(5)},${c.lon.toFixed(5)}`;
    const duration = formatDuration(c.end.getTime() - c.start.getTime());
    const label = `Stop · ${formatTime(c.start)} – ${formatTime(c.end)} · ${duration}`;
    rows.push({ id: c.firstId, label, href });
  }

  return { rows, backgroundPings: droppedPings };
}

export async function ActivitySidebar({ date }: Props) {
  const acts = await getActivities(date);

  if (acts.length === 0) {
    return (
      <aside className="sticky top-6 rounded border border-white/10 bg-black/10 p-3 text-xs text-gray-500">
        No activity recorded for this date.
      </aside>
    );
  }

  // Group by source preserving first-seen order
  const grouped = new Map<string, Activity[]>();
  for (const a of acts) {
    const list = grouped.get(a.source) ?? [];
    list.push(a);
    grouped.set(a.source, list);
  }

  return (
    <aside className="sticky top-6 space-y-3 text-sm">
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
        Activity
      </h2>
      {[...grouped.entries()].map(([source, items]) => {
        const isLocation = source === "google_maps" || source === "owntracks";
        const locationSummary = isLocation ? summarizeLocations(items) : null;
        const rows: Row[] = isLocation
          ? locationSummary!.rows
          : items.map((a) => ({ id: a.id, label: summarize(a) }));
        const countLabel = isLocation ? rows.length : items.length;
        const bg = isLocation ? locationSummary!.backgroundPings : 0;
        const footer =
          isLocation && rows.length === 0 && bg > 0
            ? `${bg} background ping${bg === 1 ? "" : "s"} · no stops`
            : null;

        return (
          <div key={source} className="rounded border border-white/10 bg-black/10 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-gray-400">
              <span>
                <span className="mr-1">{SOURCE_ICONS[source] ?? "•"}</span>
                {SOURCE_LABELS[source] ?? source}
              </span>
              <span className="text-gray-600">{countLabel}</span>
            </div>
            <ul className="space-y-1">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id} className="text-xs leading-snug text-gray-400">
                  {r.href ? (
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-gray-200 hover:underline"
                    >
                      {r.label}
                    </a>
                  ) : (
                    r.label
                  )}
                </li>
              ))}
              {rows.length > 8 && (
                <li>
                  <details className="group">
                    <summary className="cursor-pointer list-none text-xs italic text-gray-600 hover:text-gray-400 [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">…and {rows.length - 8} more</span>
                      <span className="hidden group-open:inline">show less</span>
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {rows.slice(8).map((r) => (
                        <li key={r.id} className="text-xs leading-snug text-gray-400">
                          {r.href ? (
                            <a
                              href={r.href}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-gray-200 hover:underline"
                            >
                              {r.label}
                            </a>
                          ) : (
                            r.label
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              )}
              {footer && (
                <li className="text-xs italic leading-snug text-gray-600">{footer}</li>
              )}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
