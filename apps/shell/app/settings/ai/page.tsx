"use client";

import { AiSettingsPanel } from "@/components/settings/ai-settings";

// SHAN-596: Settings > AI. The settings layout (SettingsAuthShell) already
// gates this on a signed-in session, and /settings is in CRAWLER_DISALLOW.
export default function AiSettingsPage() {
  return <AiSettingsPanel />;
}
