"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  boldAction,
  bulletedListAction,
  codeBlockAction,
  handleEnter,
  handleTab,
  headingAction,
  horizontalRuleAction,
  imageAction,
  inlineCodeAction,
  italicAction,
  linkAction,
  looksLikeUrl,
  mentionAction,
  numberedListAction,
  quoteAction,
  referenceAction,
  strikethroughAction,
  tableAction,
  taskListAction,
  type EditorAction,
  type EditorState,
} from "./actions";
import { Toolbar, TOOLBAR_ICONS, type ToolbarButtonSpec } from "./toolbar";

export interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: string;
  /** Tailwind class applied to the textarea wrapper. */
  className?: string;
  /** Show the Preview tab. Defaults to true. */
  showPreviewTab?: boolean;
  /** Auto-focus on mount. */
  autoFocus?: boolean;
  /** Submit shortcut (Ctrl/Cmd + Enter). */
  onSubmit?: () => void;
}

type Mode = "write" | "preview";

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in markdown. Use the toolbar or shortcuts (Ctrl+B, Ctrl+I, Ctrl+K…). Lists auto-continue on Enter.",
  minHeight = "20rem",
  className,
  showPreviewTab = true,
  autoFocus,
  onSubmit,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<Mode>("write");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Apply a pure action to the textarea, preserving the native undo stack
  // by replacing only the differing region via document.execCommand.
  const apply = React.useCallback(
    (action: EditorAction) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const before: EditorState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      };
      const after = action(before);
      replaceRegionPreservingUndo(ta, before, after);
      onChange(ta.value);
    },
    [onChange],
  );

  const applyLink = React.useCallback(
    (clipboardUrl?: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const before: EditorState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      };
      const after = linkAction(before, clipboardUrl);
      replaceRegionPreservingUndo(ta, before, after);
      onChange(ta.value);
    },
    [onChange],
  );

  const buttons: ToolbarButtonSpec[] = [
    { key: "heading", label: "Heading", hint: "Toggles H3 · Ctrl+Alt+1/2/3 for levels", icon: TOOLBAR_ICONS.heading, onClick: () => apply(headingAction(3)) },
    { key: "bold", label: "Bold", hint: "Ctrl+B", icon: TOOLBAR_ICONS.bold, onClick: () => apply(boldAction) },
    { key: "italic", label: "Italic", hint: "Ctrl+I", icon: TOOLBAR_ICONS.italic, onClick: () => apply(italicAction) },
    { key: "strikethrough", label: "Strikethrough", hint: "", icon: TOOLBAR_ICONS.strikethrough, onClick: () => apply(strikethroughAction) },
    { key: "_sep_1", label: "", hint: "", icon: null, onClick: () => {} },
    { key: "quote", label: "Quote", hint: "Ctrl+Shift+.", icon: TOOLBAR_ICONS.quote, onClick: () => apply(quoteAction) },
    { key: "inline-code", label: "Inline code", hint: "Ctrl+E", icon: TOOLBAR_ICONS.inlineCode, onClick: () => apply(inlineCodeAction) },
    { key: "code-block", label: "Code block", hint: "Ctrl+Shift+E", icon: TOOLBAR_ICONS.codeBlock, onClick: () => apply(codeBlockAction) },
    { key: "link", label: "Link", hint: "Ctrl+K", icon: TOOLBAR_ICONS.link, onClick: () => applyLink() },
    { key: "image", label: "Image (paste a URL)", hint: "", icon: TOOLBAR_ICONS.image, onClick: () => apply(imageAction) },
    { key: "_sep_2", label: "", hint: "", icon: null, onClick: () => {} },
    { key: "bulleted-list", label: "Bulleted list", hint: "Ctrl+Shift+8", icon: TOOLBAR_ICONS.bulletedList, onClick: () => apply(bulletedListAction) },
    { key: "numbered-list", label: "Numbered list", hint: "Ctrl+Shift+7", icon: TOOLBAR_ICONS.numberedList, onClick: () => apply(numberedListAction) },
    { key: "task-list", label: "Task list", hint: "Ctrl+Shift+L", icon: TOOLBAR_ICONS.taskList, onClick: () => apply(taskListAction) },
    { key: "_sep_3", label: "", hint: "", icon: null, onClick: () => {} },
    { key: "mention", label: "Mention", hint: "", icon: TOOLBAR_ICONS.mention, onClick: () => apply(mentionAction) },
    { key: "reference", label: "Reference", hint: "", icon: TOOLBAR_ICONS.reference, onClick: () => apply(referenceAction) },
    { key: "hr", label: "Horizontal rule", hint: "", icon: TOOLBAR_ICONS.horizontalRule, onClick: () => apply(horizontalRuleAction) },
    { key: "table", label: "Table", hint: "", icon: TOOLBAR_ICONS.table, onClick: () => apply(tableAction) },
  ];

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && (e.key === "Enter")) {
      if (onSubmit) {
        e.preventDefault();
        onSubmit();
        return;
      }
    }

    if (mod && e.shiftKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      setMode((m) => (m === "write" ? "preview" : "write"));
      return;
    }

    if (mode !== "write") return;

    // Single-key smart handlers
    if (e.key === "Enter" && !e.shiftKey && !mod && !e.altKey) {
      const state = readState(textareaRef.current);
      if (!state) return;
      const next = handleEnter(state);
      if (next) {
        e.preventDefault();
        const ta = textareaRef.current!;
        replaceRegionPreservingUndo(ta, state, next);
        onChange(ta.value);
      }
      return;
    }

    if (e.key === "Tab") {
      const state = readState(textareaRef.current);
      if (!state) return;
      const next = handleTab(state, e.shiftKey);
      if (next) {
        e.preventDefault();
        const ta = textareaRef.current!;
        replaceRegionPreservingUndo(ta, state, next);
        onChange(ta.value);
      }
      return;
    }

    if (!mod) return;

    if (e.shiftKey) {
      if (e.key === "7" || e.code === "Digit7") {
        e.preventDefault();
        apply(numberedListAction);
        return;
      }
      if (e.key === "8" || e.code === "Digit8") {
        e.preventDefault();
        apply(bulletedListAction);
        return;
      }
      if (e.key === "L" || e.key === "l") {
        e.preventDefault();
        apply(taskListAction);
        return;
      }
      if (e.key === ">" || e.key === "." || e.code === "Period") {
        e.preventDefault();
        apply(quoteAction);
        return;
      }
      if (e.key === "E" || e.key === "e") {
        e.preventDefault();
        apply(codeBlockAction);
        return;
      }
    }

    if (e.altKey) {
      if (e.key === "1") {
        e.preventDefault();
        apply(headingAction(1));
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        apply(headingAction(2));
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        apply(headingAction(3));
        return;
      }
    }

    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        apply(boldAction);
        return;
      case "i":
        e.preventDefault();
        apply(italicAction);
        return;
      case "e":
        e.preventDefault();
        apply(inlineCodeAction);
        return;
      case "k":
        e.preventDefault();
        applyLink();
        return;
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart === ta.selectionEnd) return;
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted || !looksLikeUrl(pasted)) return;
    e.preventDefault();
    applyLink(pasted);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1 border border-b-0 border-white/10 bg-black/30 px-2 pt-2">
        <button
          type="button"
          onClick={() => setMode("write")}
          className={`rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors ${
            mode === "write"
              ? "border-blue-400 text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Write
        </button>
        {showPreviewTab && (
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors ${
              mode === "preview"
                ? "border-blue-400 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            Preview
          </button>
        )}
        <span className="ml-auto hidden text-[11px] text-gray-500 sm:inline">
          Ctrl+Shift+P preview · Ctrl+B/I/K · Ctrl+Shift+7/8/L
        </span>
      </div>

      {mode === "write" ? (
        <>
          <Toolbar buttons={buttons} />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={placeholder}
            autoFocus={autoFocus}
            spellCheck={true}
            className="block w-full resize-y rounded-b border border-white/10 bg-black/20 p-3 font-mono text-base text-white/90 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:text-sm"
            style={{ minHeight }}
          />
        </>
      ) : (
        <div
          className="prose prose-invert max-w-none overflow-y-auto rounded-b border border-white/10 bg-black/10 p-4"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-gray-500 italic">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}

function readState(ta: HTMLTextAreaElement | null): EditorState | null {
  if (!ta) return null;
  return {
    value: ta.value,
    selectionStart: ta.selectionStart,
    selectionEnd: ta.selectionEnd,
  };
}

// Replaces only the changed region of the textarea via execCommand so the
// browser's native undo/redo stack keeps each toolbar action as one entry.
function replaceRegionPreservingUndo(ta: HTMLTextAreaElement, before: EditorState, after: EditorState) {
  // Compute common prefix length
  let prefix = 0;
  const minLen = Math.min(before.value.length, after.value.length);
  while (prefix < minLen && before.value[prefix] === after.value[prefix]) prefix++;
  // Compute common suffix length
  let suffix = 0;
  while (
    suffix < before.value.length - prefix &&
    suffix < after.value.length - prefix &&
    before.value[before.value.length - 1 - suffix] === after.value[after.value.length - 1 - suffix]
  ) {
    suffix++;
  }
  const replaceStart = prefix;
  const replaceEnd = before.value.length - suffix;
  const insertText = after.value.slice(prefix, after.value.length - suffix);

  ta.focus();
  ta.setSelectionRange(replaceStart, replaceEnd);
  // execCommand("insertText") triggers an input event and keeps undo history.
  // It's deprecated but still supported in Chromium, Firefox, and Safari.
  const ok = typeof document !== "undefined" && document.execCommand
    ? document.execCommand("insertText", false, insertText)
    : false;
  if (!ok) {
    // Fallback: mutate value directly (undo will collapse into one)
    ta.setRangeText(insertText, replaceStart, replaceEnd, "end");
  }
  ta.setSelectionRange(after.selectionStart, after.selectionEnd);
}
