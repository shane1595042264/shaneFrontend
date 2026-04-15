import type { ElementConfig } from "@shane/types";
import { PERIODIC_TABLE_ELEMENTS } from "./periodic-table-data";
import { getAuthHeaders } from "./auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** Sorted list of all valid atomic numbers in periodic table order */
const ALL_ATOMIC_NUMBERS = PERIODIC_TABLE_ELEMENTS
  .map((el) => el.atomicNumber)
  .sort((a, b) => a - b);

export type SlotMap = Record<number, string>; // atomicNumber -> appId

// ---- API client ----

export async function fetchSlotAssignments(): Promise<SlotMap> {
  try {
    const res = await fetch(`${API_URL}/api/slot-assignments`, {
      headers: { ...getAuthHeaders() },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.assignments ?? {};
  } catch {
    return {};
  }
}

export async function saveSlotAssignments(assignments: SlotMap): Promise<void> {
  // Convert numeric keys and values to strings for JSON
  const stringKeyed: Record<string, string> = {};
  for (const [k, v] of Object.entries(assignments)) {
    stringKeyed[String(k)] = String(v);
  }

  const res = await fetch(`${API_URL}/api/slot-assignments`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ assignments: stringKeyed }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save slot assignments (${res.status})`);
  }
}

// ---- Auto-assignment ----

/**
 * Merges backend slot assignments with the app registry.
 * Apps not yet assigned get the next available atomic number.
 * Returns a complete SlotMap.
 */
export function resolveSlots(
  apps: ElementConfig[],
  savedAssignments: SlotMap
): SlotMap {
  const result: SlotMap = {};
  const assignedAppIds = new Set<string>();
  const occupiedSlots = new Set<number>();

  // 1. Apply saved assignments (only for apps that still exist)
  const appIdSet = new Set(apps.map((a) => a.id));
  for (const [atomicStr, appId] of Object.entries(savedAssignments)) {
    const atomic = Number(atomicStr);
    if (appIdSet.has(appId) && !assignedAppIds.has(appId) && !occupiedSlots.has(atomic)) {
      result[atomic] = appId;
      assignedAppIds.add(appId);
      occupiedSlots.add(atomic);
    }
  }

  // 2. Auto-assign remaining apps to next available atomic numbers
  const unassigned = apps.filter((a) => !assignedAppIds.has(a.id));
  let slotIndex = 0;

  for (const app of unassigned) {
    while (slotIndex < ALL_ATOMIC_NUMBERS.length) {
      const candidate = ALL_ATOMIC_NUMBERS[slotIndex];
      slotIndex++;
      if (!occupiedSlots.has(candidate)) {
        result[candidate] = app.id;
        occupiedSlots.add(candidate);
        break;
      }
    }
  }

  return result;
}
