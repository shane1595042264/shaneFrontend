"use client";

import * as React from "react";
import {
  BoldIcon,
  BulletedListIcon,
  CodeBlockIcon,
  HeadingIcon,
  HorizontalRuleIcon,
  ImageIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  MentionIcon,
  NumberedListIcon,
  QuoteIcon,
  ReferenceIcon,
  StrikethroughIcon,
  TableIcon,
  TaskListIcon,
} from "./icons";

export interface ToolbarButtonSpec {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface Props {
  buttons: ToolbarButtonSpec[];
  disabled?: boolean;
}

export function Toolbar({ buttons, disabled }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-t border border-b-0 border-white/10 bg-black/20 px-2 py-1.5"
    >
      {buttons.map((b, i) =>
        b.key.startsWith("_sep_") ? (
          <div key={`sep-${i}`} className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
        ) : (
          <button
            key={b.key}
            type="button"
            aria-label={b.label}
            title={`${b.label}${b.hint ? `\n${b.hint}` : ""}`}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.onClick}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {b.icon}
          </button>
        ),
      )}
    </div>
  );
}

export const TOOLBAR_ICONS = {
  heading: <HeadingIcon />,
  bold: <BoldIcon />,
  italic: <ItalicIcon />,
  strikethrough: <StrikethroughIcon />,
  quote: <QuoteIcon />,
  inlineCode: <InlineCodeIcon />,
  codeBlock: <CodeBlockIcon />,
  link: <LinkIcon />,
  image: <ImageIcon />,
  bulletedList: <BulletedListIcon />,
  numberedList: <NumberedListIcon />,
  taskList: <TaskListIcon />,
  mention: <MentionIcon />,
  reference: <ReferenceIcon />,
  horizontalRule: <HorizontalRuleIcon />,
  table: <TableIcon />,
};
