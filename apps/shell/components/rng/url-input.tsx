"use client";
import { useState } from "react";

export function UrlInput({ onSubmit, loading }: { onSubmit: (url: string) => void; loading: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (url.trim() && !loading) onSubmit(url.trim()); }} className="flex gap-2">
      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a product link..."
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" disabled={loading} />
      <button type="submit" disabled={loading || !url.trim()}
        className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
        {loading ? "Rolling..." : "Evaluate"}
      </button>
    </form>
  );
}
