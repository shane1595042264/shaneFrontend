"use server";

import { revalidatePath } from "next/cache";

export async function revalidateJournalEntry(date: string): Promise<void> {
  revalidatePath(`/journal/${date}`, "page");
  revalidatePath("/journal", "page");
}
