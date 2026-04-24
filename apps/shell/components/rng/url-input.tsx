"use client";
import { useState } from "react";

interface UrlInputProps {
  onSubmitUrl: (url: string) => void;
  onSubmitManual: (productName: string, price: number) => void;
  loading: boolean;
  showManualFallback?: boolean;
}

export function UrlInput({ onSubmitUrl, onSubmitManual, loading, showManualFallback }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");

  if (manualMode || showManualFallback) {
    return (
      <div className="space-y-2">
        {showManualFallback && !manualMode && (
          <p className="text-yellow-400 text-sm">Could not extract product info from URL. Enter manually:</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = parseFloat(price);
            if (productName.trim() && !isNaN(p) && !loading) {
              onSubmitManual(productName.trim(), p);
            }
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product name (e.g., Nintendo Switch)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
              disabled={loading}
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
                className="flex-1 sm:flex-none sm:w-32 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !productName.trim() || !price}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? "Rolling..." : "Evaluate"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setManualMode(false); }}
            className="text-xs text-gray-500 hover:text-gray-300 self-start"
          >
            Switch to URL input
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !loading) onSubmitUrl(url.trim());
        }}
        className="flex gap-2"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a product link..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "Rolling..." : "Evaluate"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setManualMode(true)}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        Enter product manually instead
      </button>
    </div>
  );
}
