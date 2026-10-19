import { deleteComment, listComments, postComment, type Comment, type NoteMeta } from "@/lib/api/comments";
import {
  createReaderNote,
  deleteReaderNote,
  listReaderNotes,
  type ReaderNote,
  type ReaderSurface,
} from "@/lib/api/reader-notes";
import type { NoteAnchor } from "@/lib/journal-notes";

/**
 * SHAN-596: one inline-notes UI, two stores. Journal notes are journal
 * comments (shared with every journal member, SHAN-577); blog and knowledge
 * notes are reader notes (private to the reader). An adapter is the only
 * place that difference lives.
 */
export interface NoteRecord {
  id: string;
  parentId: string | null;
  anchor: NoteAnchor | null;
  meta: NoteMeta | null;
  content: string;
  createdAt: string;
  authorId: string;
  author: { id: string; name: string | null; avatarUrl: string | null } | null;
}

export interface NotesAdapter {
  /** Changes when the notes being shown change (another entry, another post). */
  key: string;
  surface: "journal" | "blog" | "knowledge";
  /** "shared": every journal member sees them. "private": only the reader does. */
  visibility: "shared" | "private";
  list(): Promise<NoteRecord[]>;
  create(input: { anchor: NoteAnchor; content: string; meta?: NoteMeta }): Promise<NoteRecord>;
  reply(rootId: string, content: string): Promise<NoteRecord>;
  remove(id: string): Promise<void>;
  canDelete(note: NoteRecord, viewerId: string | null): boolean;
}

function fromComment(c: Comment): NoteRecord {
  return {
    id: c.id,
    parentId: c.parentCommentId,
    anchor: c.anchor ?? null,
    meta: c.meta ?? null,
    content: c.content,
    createdAt: c.createdAt,
    authorId: c.authorId,
    author: c.author,
  };
}

export function journalNotesAdapter(date: string, entryAuthorId: string): NotesAdapter {
  return {
    key: `journal:${date}`,
    surface: "journal",
    visibility: "shared",
    list: async () => (await listComments(date)).map(fromComment),
    create: async ({ anchor, content, meta }) => fromComment(await postComment(date, content, undefined, anchor, meta)),
    reply: async (rootId, content) => fromComment(await postComment(date, content, rootId)),
    remove: (id) => deleteComment(id),
    // The comment's author, or the entry's author (SHAN-577 delete rule).
    canDelete: (note, viewerId) => !!viewerId && (note.authorId === viewerId || entryAuthorId === viewerId),
  };
}

function fromReaderNote(n: ReaderNote): NoteRecord {
  return {
    id: n.id,
    parentId: n.parentId,
    anchor: n.anchor,
    meta: n.meta,
    content: n.content,
    createdAt: n.createdAt,
    authorId: n.userId,
    author: null,
  };
}

export function readerNotesAdapter(surface: ReaderSurface, resourceId: string): NotesAdapter {
  return {
    key: `${surface}:${resourceId}`,
    surface,
    visibility: "private",
    list: async () => (await listReaderNotes(surface, resourceId)).map(fromReaderNote),
    create: async ({ anchor, content, meta }) =>
      fromReaderNote(await createReaderNote({ surface, resource: resourceId, content, anchor, meta })),
    reply: async (rootId, content) =>
      fromReaderNote(await createReaderNote({ surface, resource: resourceId, content, parentId: rootId })),
    remove: (id) => deleteReaderNote(id),
    canDelete: (note, viewerId) => !!viewerId && note.authorId === viewerId,
  };
}
