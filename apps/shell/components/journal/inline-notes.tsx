"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import { captureAnchor, type NoteAnchor } from "@/lib/journal-notes";
import type { MarkableNote } from "@/lib/rehype-note-marks";
import { deleteComment, listComments, postComment, type Comment } from "@/lib/api/comments";

/**
 * SHAN-577: inline notes on a journal date.
 *
 * Select words in the entry or an append and a small "Add note" pill appears;
 * it opens into a composer, and once saved the words carry a quiet amber
 * underline. Hovering the underline (or tapping it) opens the thread in a
 * popover, where anyone can reply. A note is an ordinary journal comment with
 * an `anchor`, so membership, deletion rules, reactions and the activity
 * trail are the comment system's own.
 *
 * Two contexts on purpose. The data one changes only when notes do, and it is
 * what the entry bodies read to know which words to mark. The UI one changes
 * on every hover, and only the marks themselves read it. Were they one, every
 * hover would re-render the bodies, and re-rendering a body re-parses its
 * markdown: 80 KB of it on a busy day.
 */

export interface NoteThread {
  root: Comment & { anchor: NoteAnchor };
  replies: Comment[];
}

interface DataCtx {
  threads: NoteThread[];
  byTarget: Map<string, MarkableNote[]>;
}

interface UiCtx {
  activeIds: ReadonlySet<string>;
  freshIds: ReadonlySet<string>;
  peek: (ids: string[], el: HTMLElement, clientY?: number) => void;
  leave: () => void;
  pin: (ids: string[], el: HTMLElement, clientY?: number) => void;
}

const NotesDataContext = createContext<DataCtx | null>(null);
const NotesUiContext = createContext<UiCtx | null>(null);
const OrphansContext = createContext<{ orphans: NoteThread[]; actions: ThreadActions } | null>(null);

const EMPTY: MarkableNote[] = [];
const SPRING = { type: "spring", stiffness: 460, damping: 34, mass: 0.7 } as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** The notes to mark inside one part of the page ("entry" or an append id). Stable between renders. */
export function useNotesFor(target: string): MarkableNote[] {
  return useContext(NotesDataContext)?.byTarget.get(target) ?? EMPTY;
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function docBox(r: DOMRect): Box {
  return {
    top: r.top + window.scrollY,
    bottom: r.bottom + window.scrollY,
    left: r.left + window.scrollX,
    right: r.right + window.scrollX,
  };
}

/** The line of a (possibly wrapped) mark nearest the pointer, so the popover opens where you are looking. */
function lineBoxOf(el: Element, clientY?: number): Box {
  const rects = [...el.getClientRects()];
  if (rects.length === 0) return docBox(el.getBoundingClientRect());
  if (clientY === undefined) return docBox(rects[0]);
  let best = rects[0];
  for (const r of rects) {
    if (Math.abs((r.top + r.bottom) / 2 - clientY) < Math.abs((best.top + best.bottom) / 2 - clientY)) best = r;
  }
  return docBox(best);
}

/** Places a panel of a known size against an anchor box: below if it fits, above if not. */
function place(anchor: Box, width: number, height: number) {
  const vw = document.documentElement.clientWidth;
  const left = Math.min(
    Math.max(anchor.left - 14, window.scrollX + 16),
    window.scrollX + vw - width - 16
  );
  const roomBelow = window.scrollY + window.innerHeight - anchor.bottom;
  const above = roomBelow < height + 24 && anchor.top - window.scrollY > height + 24;
  return {
    left,
    top: above ? anchor.top - height - 10 : anchor.bottom + 10,
    above,
    originX: Math.min(Math.max(anchor.left - left + 12, 12), width - 12),
  };
}

function setPendingHighlight(range: Range | null) {
  // The Custom Highlight API paints the words being noted while focus is in
  // the composer (which clears the real selection) without touching the DOM
  // React owns. Browsers without it simply skip the wash.
  const registry = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  if (!registry || !HighlightCtor) return;
  if (range) registry.set("note-pending", new HighlightCtor(range));
  else registry.delete("note-pending");
}

interface ThreadActions {
  reply: (rootId: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  canDelete: (c: Comment) => boolean;
}

export function NotesProvider({
  date,
  entryAuthorId,
  children,
}: {
  date: string;
  entryAuthorId: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());

  const refresh = useCallback(async () => {
    try {
      setComments(await listComments(date));
    } catch {
      // Notes are an enhancement to reading; a failed load leaves the entry as it was.
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const threads = useMemo<NoteThread[]>(() => {
    const roots = comments.filter(
      (c): c is Comment & { anchor: NoteAnchor } => !!c.anchor && c.parentCommentId === null
    );
    return roots.map((root) => ({
      root,
      replies: comments.filter((c) => c.parentCommentId === root.id),
    }));
  }, [comments]);

  const data = useMemo<DataCtx>(() => {
    const byTarget = new Map<string, MarkableNote[]>();
    for (const t of threads) {
      const list = byTarget.get(t.root.anchor.target) ?? [];
      list.push({ id: t.root.id, anchor: t.root.anchor });
      byTarget.set(t.root.anchor.target, list);
    }
    return { threads, byTarget };
  }, [threads]);

  const author = user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null;

  const addNote = async (anchor: NoteAnchor, content: string) => {
    const created = await postComment(date, content, undefined, anchor);
    setComments((prev) => [...prev, { ...created, anchor, author: created.author ?? author }]);
    setFreshIds(new Set([created.id]));
    window.setTimeout(() => setFreshIds(new Set()), 1400);
  };

  const actions: ThreadActions = {
    reply: async (rootId, content) => {
      const created = await postComment(date, content, rootId);
      setComments((prev) => [...prev, { ...created, author: created.author ?? author }]);
    },
    remove: async (id) => {
      await deleteComment(id);
      // A deleted note root with replies is re-rooted server-side (the earliest
      // reply inherits the anchor), so take the server's word for the shape.
      await refresh();
    },
    canDelete: (c) => !!user && (c.authorId === user.id || entryAuthorId === user.id),
  };

  // ---- hover / pin -------------------------------------------------------
  const [open, setOpen] = useState<{ ids: string[]; box: Box; pinned: boolean } | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const openTimer = useRef(0);
  const closeTimer = useRef(0);

  const ui = useMemo<UiCtx>(
    () => ({
      activeIds: new Set(open?.ids ?? []),
      freshIds,
      peek: (ids, el, clientY) => {
        window.clearTimeout(closeTimer.current);
        window.clearTimeout(openTimer.current);
        if (openRef.current?.pinned) return;
        const box = lineBoxOf(el, clientY);
        // Already showing a thread: move straight to this one, no second wait.
        openTimer.current = window.setTimeout(
          () => setOpen({ ids, box, pinned: false }),
          openRef.current ? 0 : 140
        );
      },
      leave: () => {
        window.clearTimeout(openTimer.current);
        if (openRef.current?.pinned) return;
        closeTimer.current = window.setTimeout(() => setOpen(null), 240);
      },
      pin: (ids, el, clientY) => {
        window.clearTimeout(openTimer.current);
        window.clearTimeout(closeTimer.current);
        setOpen({ ids, box: lineBoxOf(el, clientY), pinned: true });
      },
    }),
    [open, freshIds]
  );

  // ---- selection -> pill -> composer --------------------------------------
  const [draft, setDraft] = useState<{
    anchor: NoteAnchor;
    box: Box;
    range: Range;
    stage: "pill" | "compose";
  } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let touchTimer = 0;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const check = () => {
      if (draftRef.current?.stage === "compose") return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setDraft(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const elOf = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
      const a = elOf(range.startContainer)?.closest("[data-note-target]");
      const b = elOf(range.endContainer)?.closest("[data-note-target]");
      if (!a || a !== b) {
        setDraft(null);
        return;
      }
      const anchor = captureAnchor(a.getAttribute("data-note-target") ?? "", a, range);
      if (!anchor) {
        setDraft(null);
        return;
      }
      setDraft({ anchor, box: docBox(range.getBoundingClientRect()), range: range.cloneRange(), stage: "pill" });
    };

    const onPointerUp = () => window.setTimeout(check, 0);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === "Shift") window.setTimeout(check, 0);
    };
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if ((!sel || sel.isCollapsed) && draftRef.current?.stage === "pill") setDraft(null);
      // Touch has no pointerup at the end of a handle drag; wait for it to settle.
      if (coarse) {
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(check, 380);
      }
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      window.clearTimeout(touchTimer);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  useEffect(() => {
    setPendingHighlight(draft?.stage === "compose" ? draft.range : null);
    return () => setPendingHighlight(null);
  }, [draft]);

  // ---- orphans: notes whose words are no longer in the text ----------------
  const [orphanIds, setOrphanIds] = useState<string[]>([]);
  useLayoutEffect(() => {
    const scan = () => {
      const present = new Set<string>();
      document.querySelectorAll("mark[data-note-ids]").forEach((m) => {
        for (const id of (m.getAttribute("data-note-ids") ?? "").split(" ")) present.add(id);
      });
      // A part that is not on the page right now (an append open in the editor)
      // says nothing about its notes, so only parts that are rendered count.
      const shown = new Set(
        [...document.querySelectorAll("[data-note-target]")].map((el) => el.getAttribute("data-note-target"))
      );
      const next = threads
        .filter((t) => shown.has(t.root.anchor.target) && !present.has(t.root.id))
        .map((t) => t.root.id);
      setOrphanIds((prev) => (prev.join() === next.join() ? prev : next));
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [threads]);

  const orphans = useMemo(
    () => threads.filter((t) => orphanIds.includes(t.root.id)),
    [threads, orphanIds]
  );

  const openThreads = open ? threads.filter((t) => open.ids.includes(t.root.id)) : [];

  return (
    <NotesDataContext.Provider value={data}>
      <NotesUiContext.Provider value={ui}>
        <OrphansContext.Provider value={{ orphans, actions }}>
          {children}
          {typeof document !== "undefined" &&
            createPortal(
              <>
                <DraftLayer
                  draft={draft}
                  canWrite={!!user}
                  onCompose={() => setDraft((d) => (d ? { ...d, stage: "compose" } : d))}
                  onCancel={() => {
                    setDraft(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                  onSave={async (content) => {
                    if (!draftRef.current) return;
                    await addNote(draftRef.current.anchor, content);
                    setDraft(null);
                    window.getSelection()?.removeAllRanges();
                  }}
                />
                <ThreadPopover
                  open={open && openThreads.length > 0 ? { ...open, threads: openThreads } : null}
                  actions={actions}
                  onEnter={() => window.clearTimeout(closeTimer.current)}
                  onLeave={ui.leave}
                  onPin={() => setOpen((o) => (o ? { ...o, pinned: true } : o))}
                  onClose={() => setOpen(null)}
                />
              </>,
              document.body
            )}
        </OrphansContext.Provider>
      </NotesUiContext.Provider>
    </NotesDataContext.Provider>
  );
}

/**
 * The `mark` element react-markdown renders for noted text (see
 * lib/rehype-note-marks). One note can be several marks when it crosses
 * formatting; they share its id and light up together.
 */
export function NoteMark({
  node,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { node?: unknown }) {
  const ui = useContext(NotesUiContext);
  const raw = ((rest as Record<string, unknown>)["data-note-ids"] ??
    (node as { properties?: Record<string, unknown> } | undefined)?.properties?.dataNoteIds ??
    "") as string;
  const ids = raw.split(" ").filter(Boolean);
  if (!ui || ids.length === 0) return <mark className="note-mark">{children}</mark>;
  const active = ids.some((id) => ui.activeIds.has(id));
  const fresh = ids.some((id) => ui.freshIds.has(id));
  return (
    <mark
      data-note-ids={ids.join(" ")}
      data-active={active ? "" : undefined}
      data-fresh={fresh ? "" : undefined}
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={active}
      className="note-mark"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") ui.peek(ids, e.currentTarget, e.clientY);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") ui.leave();
      }}
      onClick={(e) => {
        // A drag that started on a mark is a selection, not a click.
        if (window.getSelection()?.isCollapsed === false) return;
        ui.pin(ids, e.currentTarget, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ui.pin(ids, e.currentTarget);
        }
      }}
    >
      {children}
    </mark>
  );
}

// ---------------------------------------------------------------------------
// The "Add note" pill and the composer it opens into. One shared layoutId, so
// the pill visibly grows into the card instead of being swapped for it.
// ---------------------------------------------------------------------------

function DraftLayer({
  draft,
  canWrite,
  onCompose,
  onCancel,
  onSave,
}: {
  draft: { anchor: NoteAnchor; box: Box; stage: "pill" | "compose" } | null;
  canWrite: boolean;
  onCompose: () => void;
  onCancel: () => void;
  onSave: (content: string) => Promise<void>;
}) {
  const reduce = useReducedMotion() ?? false;
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(176);

  useEffect(() => {
    if (!draft) {
      setText("");
      setError(null);
    }
  }, [draft]);

  useLayoutEffect(() => {
    if (draft?.stage === "compose" && cardRef.current) setHeight(cardRef.current.offsetHeight);
  }, [draft?.stage, error]);

  useEffect(() => {
    if (draft?.stage !== "compose") return;
    const onDown = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node) && !text.trim()) onCancel();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [draft?.stage, onCancel, text]);

  if (!canWrite) return null;

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(text.trim());
    } catch {
      setError("Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  let pillPos = { left: 0, top: 0 };
  let cardPos = { left: 0, top: 0, above: false, originX: 24 };
  if (draft) {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const center = (draft.box.left + draft.box.right) / 2;
    const vw = document.documentElement.clientWidth;
    // Above the selection with a mouse, below it on touch, where the system's
    // own copy/paste menu is not.
    const pillAbove = !coarse && draft.box.top - window.scrollY > 64;
    pillPos = {
      left: Math.min(Math.max(center - 52, window.scrollX + 12), window.scrollX + vw - 116),
      top: pillAbove ? draft.box.top - 46 : draft.box.bottom + 10,
    };
    const width = Math.min(340, vw - 32);
    cardPos = place(draft.box, width, height);
  }

  return (
    <AnimatePresence>
      {draft?.stage === "pill" && (
        <motion.button
          key="pill"
          layoutId="note-draft"
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onCompose}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
          transition={SPRING}
          style={{ position: "absolute", left: pillPos.left, top: pillPos.top, borderRadius: 999 }}
          className="z-50 inline-flex h-9 items-center gap-2 bg-gray-950/90 pl-3 pr-3.5 text-[13px] font-medium text-white shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)] ring-1 ring-white/[0.14] backdrop-blur-xl transition-colors hover:bg-gray-900 print:hidden"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-300/90 shadow-[0_0_0_3px_rgb(252_211_77/0.15)]" />
          Add note
        </motion.button>
      )}
      {draft?.stage === "compose" && (
        <motion.div
          key="card"
          ref={cardRef}
          layoutId="note-draft"
          role="dialog"
          aria-label="Add a note"
          initial={reduce ? { opacity: 0 } : undefined}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
          transition={SPRING}
          style={{
            position: "absolute",
            left: cardPos.left,
            top: cardPos.top,
            width: Math.min(340, document.documentElement.clientWidth - 32),
            borderRadius: 18,
            transformOrigin: `${cardPos.originX}px ${cardPos.above ? "100%" : "0%"}`,
          }}
          className="z-50 overflow-hidden bg-gray-950/92 shadow-[0_28px_70px_-18px_rgb(0_0_0/0.85)] ring-1 ring-white/[0.12] backdrop-blur-xl print:hidden"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.08, duration: 0.2 } }}
            className="p-4"
          >
            <p className="line-clamp-2 border-l-2 border-amber-300/60 pl-2.5 text-[13px] italic leading-snug text-gray-300">
              {draft.anchor.quote}
            </p>
            <label htmlFor="note-draft-text" className="sr-only">
              Your note
            </label>
            <textarea
              id="note-draft-text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel();
                }
              }}
              maxLength={10000}
              rows={3}
              placeholder="Write a note"
              className="mt-3 block max-h-48 min-h-[4.5rem] w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none [field-sizing:content] placeholder:text-gray-400"
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-red-300">
                {error}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-gray-400">Ctrl Enter to save</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-8 items-center rounded-full px-3 text-[13px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!text.trim() || saving}
                  className="inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-[background-color,transform] hover:bg-gray-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-400"
                >
                  {saving ? "Saving..." : "Save note"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// The thread popover
// ---------------------------------------------------------------------------

function Avatar({ c }: { c: Comment }) {
  const name = c.author?.name?.trim() || "Anonymous";
  if (c.author?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={c.author.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-medium text-gray-200"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function NoteItem({ c, actions, index }: { c: Comment; actions: ThreadActions; index: number }) {
  const reduce = useReducedMotion() ?? false;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3500);
    return () => window.clearTimeout(t);
  }, [confirming]);

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: reduce ? 0 : 0.05 + index * 0.04, ease: EASE_OUT_EXPO }}
      className="group/note flex gap-2.5"
    >
      <Avatar c={c} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-medium text-gray-100">
            {c.author?.name?.trim() || "Anonymous"}
          </span>
          <RelativeTime iso={c.createdAt} className="shrink-0 text-[11px] text-gray-400" />
          {actions.canDelete(c) && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setBusy(true);
                try {
                  await actions.remove(c.id);
                } finally {
                  setBusy(false);
                  setConfirming(false);
                }
              }}
              className={`ml-auto shrink-0 text-[11px] transition-opacity ${
                confirming
                  ? "text-red-300 opacity-100"
                  : "text-gray-400 opacity-0 hover:text-red-300 focus-visible:opacity-100 group-hover/note:opacity-100"
              }`}
            >
              {busy ? "Deleting..." : confirming ? "Delete?" : "Delete"}
            </button>
          )}
        </div>
        <div className="prose prose-invert prose-sm mt-0.5 max-w-none break-words text-[14px] leading-relaxed text-gray-200 prose-p:my-1 prose-a:text-blue-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.content}</ReactMarkdown>
        </div>
      </div>
    </motion.li>
  );
}

function ReplyBox({ rootId, actions, onFocus }: { rootId: string; actions: ThreadActions; onFocus: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      await actions.reply(rootId, text.trim());
      setText("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-inset ring-white/[0.07] transition-colors focus-within:ring-white/20">
        <label htmlFor={`note-reply-${rootId}`} className="sr-only">
          Reply
        </label>
        <textarea
          id={`note-reply-${rootId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={10000}
          placeholder="Reply"
          className="block max-h-32 min-h-6 flex-1 resize-none bg-transparent text-[14px] leading-6 text-white outline-none [field-sizing:content] placeholder:text-gray-400"
        />
        <AnimatePresence initial={false}>
          {text.trim() && (
            <motion.button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={SPRING}
              className="inline-flex h-7 shrink-0 items-center rounded-full bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:opacity-60"
            >
              {busy ? "..." : "Send"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">Couldn&apos;t send that reply.</p>}
    </div>
  );
}

/** One note and its replies, with a reply box. Shared by the popover and the orphan list. */
function ThreadView({
  thread,
  actions,
  onFocus,
  showQuote,
}: {
  thread: NoteThread;
  actions: ThreadActions;
  onFocus: () => void;
  showQuote: boolean;
}) {
  const items = [thread.root, ...thread.replies];
  return (
    <div>
      {showQuote && (
        <p className="mb-3 line-clamp-2 border-l-2 border-amber-300/50 pl-2.5 text-[13px] italic leading-snug text-gray-400">
          {thread.root.anchor.quote}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((c, i) => (
          <NoteItem key={c.id} c={c} actions={actions} index={i} />
        ))}
      </ul>
      <ReplyBox rootId={thread.root.id} actions={actions} onFocus={onFocus} />
    </div>
  );
}

function ThreadPopover({
  open,
  actions,
  onEnter,
  onLeave,
  onPin,
  onClose,
}: {
  open: { ids: string[]; box: Box; pinned: boolean; threads: NoteThread[] } | null;
  actions: ThreadActions;
  onEnter: () => void;
  onLeave: () => void;
  onPin: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(220);
  const key = open?.ids.join(" ") ?? "";

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (ref.current?.contains(t) || t?.closest?.("mark[data-note-ids]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const width = typeof document === "undefined" ? 352 : Math.min(352, document.documentElement.clientWidth - 32);
  const pos = open ? place(open.box, width, height) : null;

  return (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          key={key}
          ref={ref}
          role="dialog"
          aria-label="Notes on this text"
          onPointerEnter={onEnter}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") onLeave();
          }}
          onFocusCapture={onPin}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos.above ? 8 : -8, scale: 0.96, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: pos.above ? 4 : -4, scale: 0.98, transition: { duration: 0.14 } }
          }
          transition={SPRING}
          style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            width,
            transformOrigin: `${pos.originX}px ${pos.above ? "100%" : "0%"}`,
          }}
          className="z-50 max-h-[min(28rem,70vh)] overflow-y-auto overscroll-contain rounded-2xl bg-gray-950/90 shadow-[0_28px_70px_-18px_rgb(0_0_0/0.85)] ring-1 ring-white/[0.12] backdrop-blur-xl print:hidden"
        >
          <div aria-hidden="true" className="h-px bg-gradient-to-r from-amber-300/70 via-amber-200/20 to-transparent" />
          <div className="divide-y divide-white/[0.06]">
            {open.threads.map((t) => (
              <div key={t.root.id} className="p-4">
                <ThreadView thread={t} actions={actions} onFocus={onPin} showQuote={open.threads.length > 1} />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Notes whose words are gone: the entry was edited and the quoted text with it.
 * They are listed under the article rather than dropped, quote first, so the
 * discussion is still there to read and to answer.
 */
export function OrphanNotes() {
  const ctx = useContext(OrphansContext);
  if (!ctx || ctx.orphans.length === 0) return null;
  return (
    <section aria-labelledby="orphan-notes-heading" className="mt-10 rounded-2xl p-5 ring-1 ring-white/[0.08]">
      <h2 id="orphan-notes-heading" className="text-sm font-medium text-gray-200">
        Notes on text that changed
      </h2>
      <p className="mt-1 text-xs text-gray-400">The words these were pinned to aren&apos;t in the entry anymore.</p>
      <div className="mt-4 space-y-5 divide-y divide-white/[0.06]">
        {ctx.orphans.map((t) => (
          <div key={t.root.id} className="pt-5 first:pt-0">
            <ThreadView thread={t} actions={ctx.actions} onFocus={() => {}} showQuote />
          </div>
        ))}
      </div>
    </section>
  );
}
