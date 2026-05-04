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
    case "google_maps":
    case "owntracks": {
      const name = (d.name as string) ?? null;
      if (name) return name;
      if (a.type === "place_enter" || a.type === "place_leave") {
        const ev = a.type === "place_enter" ? "Arrived" : "Left";
        const t = (d.timestamp as string) ?? "";
        return t ? `${ev} ${new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ev;
      }
      return "Location ping";
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
      {[...grouped.entries()].map(([source, items]) => (
        <div key={source} className="rounded border border-white/10 bg-black/10 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-gray-400">
            <span>
              <span className="mr-1">{SOURCE_ICONS[source] ?? "•"}</span>
              {SOURCE_LABELS[source] ?? source}
            </span>
            <span className="text-gray-600">{items.length}</span>
          </div>
          <ul className="space-y-1">
            {items.slice(0, 8).map((a) => (
              <li key={a.id} className="text-xs leading-snug text-gray-400">
                {summarize(a)}
              </li>
            ))}
            {items.length > 8 && (
              <li className="text-xs italic text-gray-600">
                …and {items.length - 8} more
              </li>
            )}
          </ul>
        </div>
      ))}
    </aside>
  );
}
