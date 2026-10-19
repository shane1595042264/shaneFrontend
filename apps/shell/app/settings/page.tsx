import { redirect } from "next/navigation";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

// SHAN-598: /settings had no page of its own and 404'd, although the layout's
// canonical URL points here. Send it to the first section, the same page the
// profile menu's first item opens.
export default function SettingsIndexPage() {
  redirect(SETTINGS_SECTIONS[0].href);
}
