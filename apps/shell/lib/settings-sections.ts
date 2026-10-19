/**
 * The settings pages, in one list (SHAN-598).
 *
 * Read by the settings shell's tab row and by the profile menu in the nav, so
 * a new settings page shows up in both places or in neither. Before this the
 * tabs were the only way in, and nothing on the site linked to them: the
 * profile menu held an email address and "Sign out", and `/settings` itself
 * was a 404, so the pages were reachable only by typing their URL.
 */
export interface SettingsSection {
  href: string;
  /** Tab label inside /settings, where the page heading already says "Settings". */
  label: string;
  /** Menu label in the nav, where the item has to say what it opens on its own. */
  menuLabel: string;
  /** One line under the menu label: what you will find on the page. */
  hint: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: "/settings/tokens",
    label: "Tokens",
    menuLabel: "Account",
    hint: "Time zone and access tokens",
  },
  // SHAN-596: AI keys for Explain, and what they have cost.
  {
    href: "/settings/ai",
    label: "AI",
    menuLabel: "AI keys",
    hint: "Explain providers and usage",
  },
];
