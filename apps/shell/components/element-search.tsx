"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ElementConfig } from "@shane/types";
import { CATEGORY_STYLES } from "@/lib/elements";

interface ElementSearchProps {
  /** Ranked matches for `query`, computed by the parent (see lib/element-search). */
  results: ElementConfig[];
  query: string;
  onQueryChange: (query: string) => void;
  /**
   * id of the keyboard-highlighted result, or null. Owned by the parent so the
   * grid can scroll the matching card into view.
   */
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
}

export function ElementSearch({
  results,
  query,
  onQueryChange,
  activeId,
  onActiveIdChange,
}: ElementSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const showList = isOpen && hasQuery;
  const activeIndex = results.findIndex((el) => el.id === activeId);

  // "/" focuses the search from anywhere on the homepage, the same shortcut
  // people already expect from GitHub/Slack. Ignored while typing in a field
  // so it never swallows a literal slash.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activate = useCallback(
    (element: ElementConfig) => {
      if (element.status === "coming-soon") return;
      if (element.type === "external" && element.url) {
        window.open(element.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (element.route) router.push(element.route);
    },
    [router]
  );

  const move = useCallback(
    (delta: number) => {
      if (results.length === 0) return;
      setIsOpen(true);
      const next =
        activeIndex === -1
          ? delta > 0
            ? 0
            : results.length - 1
          : (activeIndex + delta + results.length) % results.length;
      onActiveIdChange(results[next].id);
    },
    [activeIndex, results, onActiveIdChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        e.preventDefault();
        activate(target);
      }
    } else if (e.key === "Escape") {
      // First Escape closes the suggestion list, a second one clears the query
      // (and with it the dimming applied to the grid).
      e.preventDefault();
      if (showList) {
        setIsOpen(false);
      } else {
        onQueryChange("");
        onActiveIdChange(null);
      }
    }
  };

  const handleChange = (value: string) => {
    onQueryChange(value);
    onActiveIdChange(null);
    setIsOpen(true);
  };

  const clear = () => {
    onQueryChange("");
    onActiveIdChange(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div
      className="relative mx-auto mb-3 w-full max-w-sm"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder="Search elements by name, symbol, category"
          aria-label="Search elements"
          role="combobox"
          aria-expanded={showList}
          // Only reference the listbox while it exists, so the accessibility
          // tree never carries a dangling aria-controls target.
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeId ? `${listId}-${activeId}` : undefined
          }
          autoComplete="off"
          className="min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 pr-9 text-sm text-white placeholder:text-gray-600 focus:border-white/40 focus:outline-none"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex h-9 w-8 -translate-y-1/2 items-center justify-center rounded text-gray-500 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 py-px text-[10px] leading-tight text-gray-500 sm:block"
          >
            /
          </span>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {hasQuery
          ? `${results.length} element${results.length === 1 ? "" : "s"} match ${trimmed}`
          : ""}
      </p>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Element search results"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-white/15 bg-gray-950/95 py-1 shadow-xl backdrop-blur"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-xs text-gray-500">No elements match</li>
          )}
          {results.map((element) => {
            const styles =
              CATEGORY_STYLES[element.category] || CATEGORY_STYLES["projects"];
            const isActive = element.id === activeId;
            const isComingSoon = element.status === "coming-soon";
            return (
              <li
                key={element.id}
                id={`${listId}-${element.id}`}
                role="option"
                aria-selected={isActive}
                aria-disabled={isComingSoon || undefined}
                onMouseEnter={() => onActiveIdChange(element.id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => activate(element)}
                className={`flex items-center gap-2 px-2 py-1.5 ${
                  isActive ? "bg-white/10" : ""
                } ${isComingSoon ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${styles.bg} ${styles.border} ${styles.text}`}
                >
                  {element.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-gray-100">
                    {element.name}
                    {isComingSoon && (
                      <span className="ml-1 text-[10px] text-gray-500">
                        (soon)
                      </span>
                    )}
                    {element.type === "external" && !isComingSoon && (
                      <span
                        aria-hidden="true"
                        className="ml-1 text-[10px] text-gray-500"
                      >
                        &#8599;
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[10px] text-gray-500">
                    {element.description}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
