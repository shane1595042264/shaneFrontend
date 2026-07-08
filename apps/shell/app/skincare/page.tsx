"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth-gate";
import {
  listSkincare,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
  type SkincareProduct,
  type SkincareRoutines,
  type TimeOfDay,
} from "@/lib/api/skincare";

const inputCls =
  "rounded-md border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none";

const ROUTINES: { key: TimeOfDay; label: string; icon: string }[] = [
  { key: "morning", label: "Morning", icon: "☀️" },
  { key: "night", label: "Night", icon: "🌙" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day N since the earliest startedAt in the routine (Day 1 on the start day). */
function routineStreakDay(products: SkincareProduct[]): number | null {
  if (products.length === 0) return null;
  const earliest = products.reduce(
    (min, p) => Math.min(min, new Date(p.startedAt).getTime()),
    Infinity,
  );
  if (!Number.isFinite(earliest)) return null;
  return Math.floor((Date.now() - earliest) / DAY_MS) + 1;
}

function cardBgStyle(url: string) {
  return {
    backgroundImage: `linear-gradient(rgba(8,8,12,0.55), rgba(8,8,12,0.85)), url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

function SkincareContent() {
  const [routines, setRoutines] = useState<SkincareRoutines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSkincare()
      .then(setRoutines)
      .catch((e) => setError(e.message ?? "Failed to load"));
  }, []);

  function patchRoutine(timeOfDay: TimeOfDay, next: SkincareProduct[]) {
    setRoutines((r) => (r ? { ...r, [timeOfDay]: next } : r));
  }

  async function handleAdd(
    timeOfDay: TimeOfDay,
    input: { name: string; brand: string | null; imageUrl: string | null },
  ) {
    setError(null);
    setBusy(true);
    try {
      const product = await createProduct({ timeOfDay, ...input });
      setRoutines((r) => (r ? { ...r, [timeOfDay]: [...r[timeOfDay], product] } : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add product");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(
    timeOfDay: TimeOfDay,
    id: string,
    patch: { name: string; brand: string | null; imageUrl: string | null },
  ) {
    setError(null);
    setBusy(true);
    try {
      const updated = await updateProduct(id, patch);
      patchRoutine(
        timeOfDay,
        (routines?.[timeOfDay] ?? []).map((p) => (p.id === id ? updated : p)),
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(timeOfDay: TimeOfDay, id: string) {
    setError(null);
    setBusy(true);
    try {
      await deleteProduct(id);
      patchRoutine(timeOfDay, (routines?.[timeOfDay] ?? []).filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete product");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(timeOfDay: TimeOfDay, idx: number, dir: -1 | 1) {
    const current = routines?.[timeOfDay];
    if (!current) return;
    const target = idx + dir;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[idx], next[target]] = [next[target], next[idx]];
    // Optimistic swap, then persist the full ordered id list for the routine.
    patchRoutine(timeOfDay, next);
    setError(null);
    setBusy(true);
    try {
      await reorderProducts(timeOfDay, next.map((p) => p.id));
    } catch (e) {
      // Revert on failure so the UI never diverges from the server order.
      patchRoutine(timeOfDay, current);
      setError(e instanceof Error ? e.message : "Failed to reorder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Skincare</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two routines, ordered head to toe. Track products and how long you&apos;ve kept it up.
          </p>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          ← Home
        </Link>
      </header>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {routines === null ? (
        error ? null : <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {ROUTINES.map(({ key, label, icon }) => (
            <RoutineColumn
              key={key}
              timeOfDay={key}
              label={label}
              icon={icon}
              products={routines[key]}
              editingId={editingId}
              busy={busy}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onAdd={handleAdd}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineColumn({
  timeOfDay,
  label,
  icon,
  products,
  editingId,
  busy,
  onStartEdit,
  onCancelEdit,
  onAdd,
  onSaveEdit,
  onDelete,
  onMove,
}: {
  timeOfDay: TimeOfDay;
  label: string;
  icon: string;
  products: SkincareProduct[];
  editingId: string | null;
  busy: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onAdd: (t: TimeOfDay, input: { name: string; brand: string | null; imageUrl: string | null }) => void;
  onSaveEdit: (t: TimeOfDay, id: string, patch: { name: string; brand: string | null; imageUrl: string | null }) => void;
  onDelete: (t: TimeOfDay, id: string) => void;
  onMove: (t: TimeOfDay, idx: number, dir: -1 | 1) => void;
}) {
  const streak = useMemo(() => routineStreakDay(products), [products]);

  return (
    <section className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          <span aria-hidden className="mr-1.5">
            {icon}
          </span>
          {label}
        </h2>
        <span className="text-xs text-gray-400">
          {streak !== null ? `Day ${streak}` : "not started"}
          {products.length > 0 && ` · ${products.length} product${products.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {products.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">No products yet. Add your first below.</p>
      ) : (
        <ol className="mb-4 space-y-2">
          {products.map((p, idx) => (
            <li key={p.id}>
              {editingId === p.id ? (
                <ProductEditForm
                  product={p}
                  busy={busy}
                  onCancel={onCancelEdit}
                  onSave={(patch) => onSaveEdit(timeOfDay, p.id, patch)}
                />
              ) : (
                <div
                  className="flex items-center gap-3 rounded-md border border-white/10 p-3"
                  style={p.imageUrl ? cardBgStyle(p.imageUrl) : undefined}
                >
                  <span className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(timeOfDay, idx, -1)}
                      disabled={idx === 0 || busy}
                      aria-label={`Move ${p.name} up`}
                      className="rounded border border-white/20 px-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(timeOfDay, idx, 1)}
                      disabled={idx === products.length - 1 || busy}
                      aria-label={`Move ${p.name} down`}
                      className="rounded border border-white/20 px-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{p.name}</p>
                    {p.brand && <p className="truncate text-xs text-gray-300">{p.brand}</p>}
                  </div>
                  <span className="flex shrink-0 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onStartEdit(p.id)}
                      className="text-gray-300 hover:text-white"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(timeOfDay, p.id)}
                      disabled={busy}
                      className="text-red-400/80 hover:text-red-300 disabled:opacity-40"
                    >
                      delete
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <ProductAddForm timeOfDay={timeOfDay} busy={busy} onAdd={onAdd} />
    </section>
  );
}

function ProductAddForm({
  timeOfDay,
  busy,
  onAdd,
}: {
  timeOfDay: TimeOfDay;
  busy: boolean;
  onAdd: (t: TimeOfDay, input: { name: string; brand: string | null; imageUrl: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    onAdd(timeOfDay, {
      name: name.trim(),
      brand: brand.trim() || null,
      imageUrl: imageUrl.trim() || null,
    });
    setName("");
    setBrand("");
    setImageUrl("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-white/10 pt-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name"
        aria-label={`${timeOfDay} product name`}
        className={inputCls}
      />
      <div className="flex gap-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand (optional)"
          aria-label={`${timeOfDay} product brand`}
          className={`${inputCls} min-w-0 flex-1`}
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          aria-label={`${timeOfDay} product image URL`}
          className={`${inputCls} min-w-0 flex-1`}
        />
      </div>
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="self-start rounded-md bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40"
      >
        + Add product
      </button>
    </form>
  );
}

function ProductEditForm({
  product,
  busy,
  onSave,
  onCancel,
}: {
  product: SkincareProduct;
  busy: boolean;
  onSave: (patch: { name: string; brand: string | null; imageUrl: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    onSave({
      name: name.trim(),
      brand: brand.trim() || null,
      imageUrl: imageUrl.trim() || null,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border border-white/30 bg-black/40 p-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Edit product name"
        className={inputCls}
      />
      <input
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="Brand (optional)"
        aria-label="Edit product brand"
        className={inputCls}
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Image URL (optional)"
        aria-label="Edit product image URL"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-gray-300 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SkincarePage() {
  return (
    <AuthGate>
      <SkincareContent />
    </AuthGate>
  );
}
