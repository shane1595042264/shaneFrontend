"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CollapsibleSection } from "@/components/trips/page-toc";
import { useAuth } from "@/lib/auth-context";
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  type TripGroupSection,
  type SectionItem,
} from "@/lib/api/trip-groups";

/**
 * Collaborative group sections (SHAN-283). First kind: "todo" — shared
 * checklists like "Remember to bring". Every member can add items,
 * check them off, and remove them; the section creator or group owner
 * can delete the whole section.
 */
export function GroupSections({
  slug,
  isOwner,
  onSectionsChange,
}: {
  slug: string;
  isOwner: boolean;
  /** Bubbles {id,title} up so the page TOC can list user sections (SHAN-284). */
  onSectionsChange?: (sections: { id: string; title: string }[]) => void;
}) {
  const { user } = useAuth();
  const [sections, setSections] = useState<TripGroupSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    listSections(slug)
      .then(setSections)
      .catch((err) => setError((err as Error).message));
  }, [slug]);

  useEffect(() => {
    onSectionsChange?.(sections.map((s) => ({ id: s.id, title: s.title })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity churn
  }, [sections]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const section = await createSection(slug, newTitle.trim());
      setSections((prev) => [section, ...prev]);
      setNewTitle("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function saveItems(section: TripGroupSection, items: SectionItem[]) {
    setSavingId(section.id);
    setError(null);
    // Optimistic: checklist toggles should feel instant.
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, items } : s)));
    try {
      const updated = await updateSection(slug, section.id, { items });
      setSections((prev) => prev.map((s) => (s.id === section.id ? updated : s)));
    } catch (err) {
      setError((err as Error).message);
      setSections((prev) => prev.map((s) => (s.id === section.id ? section : s)));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteSection(id: string) {
    if (!confirm("Delete this section and all its items?")) return;
    try {
      await deleteSection(slug, id);
      setSections((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <CollapsibleSection
      id="sections"
      title="Sections"
      right={
        sections.length > 0 ? (
          <span className="text-xs font-normal text-gray-500">{sections.length}</span>
        ) : undefined
      }
    >
      {error && <p role="alert" className="mb-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={handleCreate} className="mb-3 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={'new section, e.g. "Remember to bring"'}
          maxLength={200}
          aria-label="New section title"
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="shrink-0 rounded border border-white/20 px-3 text-xs font-medium text-gray-300 hover:bg-white/10 disabled:opacity-50"
        >
          {creating ? "Adding…" : "+ Add section"}
        </button>
      </form>

      {sections.length === 0 ? (
        <p className="text-sm text-gray-500">
          No sections yet. Create a shared checklist — packing lists, pre-trip todos, anything.
        </p>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <TodoSection
              key={s.id}
              section={s}
              saving={savingId === s.id}
              canDeleteSection={isOwner || s.createdBy === user?.id}
              userName={user?.name ?? null}
              onSaveItems={(items) => saveItems(s, items)}
              onDeleteSection={() => handleDeleteSection(s.id)}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function TodoSection({
  section,
  saving,
  canDeleteSection,
  userName,
  onSaveItems,
  onDeleteSection,
}: {
  section: TripGroupSection;
  saving: boolean;
  canDeleteSection: boolean;
  userName: string | null;
  onSaveItems: (items: SectionItem[]) => void;
  onDeleteSection: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const doneCount = section.items.filter((i) => i.done).length;

  function addItem(e: FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    onSaveItems([
      ...section.items,
      {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        text: newItem.trim(),
        done: false,
        addedBy: userName,
      },
    ]);
    setNewItem("");
  }

  return (
    <details
      id={`sec-${section.id}`}
      open
      className="group/todo scroll-mt-6 rounded-md border border-white/10 bg-black/20 p-3"
    >
      <summary className="flex cursor-pointer select-none items-baseline justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-medium text-white/90">
          <span className="mr-1.5 inline-block transition-transform group-open/todo:rotate-90">›</span>
          ☑ {section.title}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {doneCount}/{section.items.length}
          </span>
        </h3>
        {canDeleteSection && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDeleteSection();
            }}
            className="shrink-0 text-xs text-red-400/70 hover:text-red-300"
          >
            delete section
          </button>
        )}
      </summary>

      <ul className="mt-2 space-y-1">
        {section.items.map((item) => (
          <li key={item.id} className="group/item flex items-center gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                disabled={saving}
                onChange={() =>
                  onSaveItems(
                    section.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
                  )
                }
                className="h-4 w-4 accent-green-500"
              />
              <span className={`text-sm ${item.done ? "text-gray-500 line-through" : "text-white/90"}`}>
                {item.text}
              </span>
              {item.addedBy && (
                <span className="text-[10px] text-gray-600">— {item.addedBy}</span>
              )}
            </label>
            <button
              type="button"
              onClick={() => onSaveItems(section.items.filter((i) => i.id !== item.id))}
              disabled={saving}
              aria-label={`Remove ${item.text}`}
              className="shrink-0 text-xs text-gray-600 hover:text-red-300 disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={addItem} className="mt-2 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="add an item"
          maxLength={500}
          aria-label={`Add item to ${section.title}`}
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-1 text-xs text-white/90 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !newItem.trim()}
          className="shrink-0 rounded border border-white/20 px-2 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
        >
          add
        </button>
      </form>
    </details>
  );
}
