"use client";

import { useState } from "react";
import { MarkdownEditor } from "@shane/ui";
import { uploadImage } from "@/lib/api/images";

interface NoteInputProps {
  onSubmit: (text: string) => void;
  loading: boolean;
}

export function NoteInput({ onSubmit, loading }: NoteInputProps) {
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
    setText("");
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2">
      <label className="block text-xs text-gray-500">
        What did you learn? (AI will classify it automatically)
      </label>
      <MarkdownEditor
        value={text}
        onChange={setText}
        placeholder='e.g. "gracias means thank you in Spanish" — or paste/drop an image to attach it'
        minHeight="6rem"
        onImageUpload={uploadImage}
        onSubmit={submit}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600">
          Ctrl+Enter to submit. Paste or drop images to embed them.
        </p>
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors whitespace-nowrap"
        >
          {loading ? "Thinking..." : "Add Note"}
        </button>
      </div>
    </form>
  );
}
