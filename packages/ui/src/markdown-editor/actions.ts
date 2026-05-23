// Pure text-transform helpers for the MarkdownEditor. Each action takes
// the textarea's current { value, selectionStart, selectionEnd } and returns
// the new state. The React layer is responsible for actually applying these
// via execCommand so the native undo stack stays intact.

export interface EditorState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type ActionResult = EditorState;
export type EditorAction = (state: EditorState) => ActionResult;

function expandToLines(value: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  let lineStart = start;
  while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
  let lineEnd = end;
  while (lineEnd < value.length && value[lineEnd] !== "\n") lineEnd++;
  return { lineStart, lineEnd };
}

function wrapInline(state: EditorState, prefix: string, suffix: string, placeholder: string): EditorState {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  // Unwrap if the selection itself includes the wrapping
  if (
    selected.length >= prefix.length + suffix.length &&
    selected.startsWith(prefix) &&
    selected.endsWith(suffix)
  ) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    return {
      value: before + inner + after,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    };
  }

  // Unwrap if the wrapping sits just outside the selection
  if (before.endsWith(prefix) && after.startsWith(suffix)) {
    return {
      value: before.slice(0, -prefix.length) + selected + after.slice(suffix.length),
      selectionStart: selectionStart - prefix.length,
      selectionEnd: selectionEnd - prefix.length,
    };
  }

  if (selected.length === 0) {
    const newValue = before + prefix + placeholder + suffix + after;
    return {
      value: newValue,
      selectionStart: selectionStart + prefix.length,
      selectionEnd: selectionStart + prefix.length + placeholder.length,
    };
  }

  return {
    value: before + prefix + selected + suffix + after,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

function prefixLines(
  state: EditorState,
  prefixFor: (lineIdx: number, line: string) => string,
  stripPattern: RegExp,
): EditorState {
  const { value, selectionStart, selectionEnd } = state;
  const { lineStart, lineEnd } = expandToLines(value, selectionStart, selectionEnd);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.length === 0 ? [""] : block.split("\n");

  const allPrefixed = lines.every((l) => stripPattern.test(l));
  let newLines: string[];
  if (allPrefixed) {
    newLines = lines.map((l) => l.replace(stripPattern, ""));
  } else {
    newLines = lines.map((l, i) => prefixFor(i, l) + l);
  }
  const newBlock = newLines.join("\n");

  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  const firstLineDelta = newLines[0].length - lines[0].length;
  const totalDelta = newBlock.length - block.length;
  return {
    value: newValue,
    selectionStart: selectionStart + firstLineDelta,
    selectionEnd: selectionEnd + totalDelta,
  };
}

export const boldAction: EditorAction = (s) => wrapInline(s, "**", "**", "bold text");
export const italicAction: EditorAction = (s) => wrapInline(s, "_", "_", "italic text");
export const strikethroughAction: EditorAction = (s) => wrapInline(s, "~~", "~~", "strikethrough text");
export const inlineCodeAction: EditorAction = (s) => wrapInline(s, "`", "`", "code");

export const quoteAction: EditorAction = (s) => prefixLines(s, () => "> ", /^> ?/);
export const bulletedListAction: EditorAction = (s) => prefixLines(s, () => "- ", /^[-*] /);
export const numberedListAction: EditorAction = (s) =>
  prefixLines(
    s,
    (i) => `${i + 1}. `,
    /^\d+\. /,
  );
export const taskListAction: EditorAction = (s) => prefixLines(s, () => "- [ ] ", /^- \[[ xX]\] /);

export function headingAction(level: 1 | 2 | 3 | 4 | 5 | 6): EditorAction {
  const marker = "#".repeat(level) + " ";
  return (s) => {
    const { value, selectionStart, selectionEnd } = s;
    const { lineStart, lineEnd } = expandToLines(value, selectionStart, selectionEnd);
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    // If every line already has THIS exact level, strip. Otherwise replace any heading marker with this one.
    const allThisLevel = lines.every((l) => l.startsWith(marker));
    const newLines = lines.map((l) => {
      const stripped = l.replace(/^#{1,6} /, "");
      return allThisLevel ? stripped : marker + stripped;
    });
    const newBlock = newLines.join("\n");
    const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    const firstLineDelta = newLines[0].length - lines[0].length;
    const totalDelta = newBlock.length - block.length;
    return {
      value: newValue,
      selectionStart: selectionStart + firstLineDelta,
      selectionEnd: selectionEnd + totalDelta,
    };
  };
}

const URL_LIKE = /^(https?:\/\/|www\.)\S+$/i;
export function looksLikeUrl(text: string): boolean {
  return URL_LIKE.test(text.trim());
}

export function linkAction(state: EditorState, clipboardUrl?: string): ActionResult {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  if (!selected) {
    const url = clipboardUrl && looksLikeUrl(clipboardUrl) ? clipboardUrl.trim() : "url";
    const text = "text";
    const newValue = `${before}[${text}](${url})${after}`;
    return {
      value: newValue,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1 + text.length,
    };
  }

  if (looksLikeUrl(selected)) {
    const text = "text";
    const newValue = `${before}[${text}](${selected.trim()})${after}`;
    return {
      value: newValue,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1 + text.length,
    };
  }

  const url = clipboardUrl && looksLikeUrl(clipboardUrl) ? clipboardUrl.trim() : "url";
  const newValue = `${before}[${selected}](${url})${after}`;
  const urlStart = selectionStart + 1 + selected.length + 2;
  return {
    value: newValue,
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  };
}

export const codeBlockAction: EditorAction = (state) => {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);

  const leadingNL = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const trailingNL = after.length > 0 && !after.startsWith("\n") ? "\n" : "";

  if (selected.length > 0) {
    const newValue = `${before}${leadingNL}\`\`\`\n${selected}\n\`\`\`${trailingNL}${after}`;
    // Put cursor on the language slot (right after first ```)
    const cursor = selectionStart + leadingNL.length + 3;
    return { value: newValue, selectionStart: cursor, selectionEnd: cursor };
  }

  const placeholder = "code";
  const newValue = `${before}${leadingNL}\`\`\`\n${placeholder}\n\`\`\`${trailingNL}${after}`;
  const placeholderStart = before.length + leadingNL.length + 4; // past "```\n"
  return {
    value: newValue,
    selectionStart: placeholderStart,
    selectionEnd: placeholderStart + placeholder.length,
  };
};

export const imageAction: EditorAction = (state) => {
  const { value, selectionStart, selectionEnd } = state;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const alt = selected || "alt text";
  const url = "image-url";
  const newValue = `${before}![${alt}](${url})${after}`;
  const urlStart = selectionStart + 2 + alt.length + 2;
  return {
    value: newValue,
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  };
};

export const horizontalRuleAction: EditorAction = (state) => {
  const { value, selectionStart } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  let lead = "";
  if (before.length > 0) {
    if (!before.endsWith("\n\n")) lead = before.endsWith("\n") ? "\n" : "\n\n";
  }
  const trail = after.startsWith("\n") ? "\n" : "\n\n";
  const insertion = `${lead}---${trail}`;
  const newValue = before + insertion + after;
  const cursor = before.length + insertion.length;
  return { value: newValue, selectionStart: cursor, selectionEnd: cursor };
};

export const tableAction: EditorAction = (state) => {
  const { value, selectionStart } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  let lead = "";
  if (before.length > 0 && !before.endsWith("\n\n")) {
    lead = before.endsWith("\n") ? "\n" : "\n\n";
  }
  const table = `| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |\n`;
  const trail = after.startsWith("\n") ? "" : "\n";
  const insertion = `${lead}${table}${trail}`;
  const newValue = before + insertion + after;
  const selStart = before.length + lead.length + 2;
  const selEnd = selStart + "Column 1".length;
  return { value: newValue, selectionStart: selStart, selectionEnd: selEnd };
};

export const mentionAction: EditorAction = (state) => insertAtCursor(state, "@");
export const referenceAction: EditorAction = (state) => insertAtCursor(state, "#");

function insertAtCursor(state: EditorState, text: string): EditorState {
  const { value, selectionStart, selectionEnd } = state;
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const newValue = before + text + after;
  const cursor = selectionStart + text.length;
  return { value: newValue, selectionStart: cursor, selectionEnd: cursor };
}

// ---- Enter / Tab smart handlers ----

export interface SmartKeyResult {
  state: EditorState;
}

export function handleEnter(state: EditorState): EditorState | null {
  const { value, selectionStart, selectionEnd } = state;
  if (selectionStart !== selectionEnd) return null;

  let lineStart = selectionStart;
  while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
  const lineSoFar = value.slice(lineStart, selectionStart);

  // Order matters: task list before bulleted list (task is a stricter subset).
  const taskMatch = lineSoFar.match(/^(\s*)- \[[ xX]\] (.*)$/);
  if (taskMatch) {
    const indent = taskMatch[1];
    const content = taskMatch[2];
    if (!content) {
      return removePrefix(state, lineStart, selectionStart);
    }
    return insertAtCursor(state, `\n${indent}- [ ] `);
  }

  const ulMatch = lineSoFar.match(/^(\s*)([-*]) (.*)$/);
  if (ulMatch) {
    const indent = ulMatch[1];
    const marker = ulMatch[2];
    const content = ulMatch[3];
    if (!content) {
      return removePrefix(state, lineStart, selectionStart);
    }
    return insertAtCursor(state, `\n${indent}${marker} `);
  }

  const olMatch = lineSoFar.match(/^(\s*)(\d+)\. (.*)$/);
  if (olMatch) {
    const indent = olMatch[1];
    const num = parseInt(olMatch[2], 10);
    const content = olMatch[3];
    if (!content) {
      return removePrefix(state, lineStart, selectionStart);
    }
    return insertAtCursor(state, `\n${indent}${num + 1}. `);
  }

  const quoteMatch = lineSoFar.match(/^(>+ )(.*)$/);
  if (quoteMatch) {
    const marker = quoteMatch[1];
    const content = quoteMatch[2];
    if (!content) {
      return removePrefix(state, lineStart, selectionStart);
    }
    return insertAtCursor(state, `\n${marker}`);
  }

  return null;
}

function removePrefix(state: EditorState, lineStart: number, cursor: number): EditorState {
  const { value } = state;
  const newValue = value.slice(0, lineStart) + value.slice(cursor);
  return { value: newValue, selectionStart: lineStart, selectionEnd: lineStart };
}

export function handleTab(state: EditorState, shift: boolean): EditorState | null {
  const { value, selectionStart, selectionEnd } = state;
  const { lineStart, lineEnd } = expandToLines(value, selectionStart, selectionEnd);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.length === 0 ? [""] : block.split("\n");

  const isListContext = lines.some(
    (l) => /^\s*([-*]|\d+\.) /.test(l) || /^\s*- \[[ xX]\] /.test(l),
  );

  const indent = "  ";

  if (!isListContext) {
    if (selectionStart !== selectionEnd) {
      // Multi-line selection: indent/dedent each
      return indentBlock(state, lineStart, lineEnd, lines, indent, shift);
    }
    if (shift) return null;
    return insertAtCursor(state, indent);
  }

  return indentBlock(state, lineStart, lineEnd, lines, indent, shift);
}

function indentBlock(
  state: EditorState,
  lineStart: number,
  lineEnd: number,
  lines: string[],
  indent: string,
  shift: boolean,
): EditorState {
  const { value, selectionStart, selectionEnd } = state;
  let newLines: string[];
  if (shift) {
    newLines = lines.map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l));
  } else {
    newLines = lines.map((l) => indent + l);
  }
  const newBlock = newLines.join("\n");
  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  const firstDelta = newLines[0].length - lines[0].length;
  const totalDelta = newBlock.length - (lineEnd - lineStart);
  return {
    value: newValue,
    selectionStart: Math.max(lineStart, selectionStart + firstDelta),
    selectionEnd: Math.max(lineStart, selectionEnd + totalDelta),
  };
}
