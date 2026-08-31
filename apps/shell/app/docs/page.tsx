import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs/registry";

// Static: content ships with the build.
export default function DocsIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Documentation</h1>
        <p className="mt-1 text-sm text-gray-400">
          Developer reference for every API on this site. Written to be skimmed by AI agents.
        </p>
      </div>

      <div className="mb-8 rounded-lg border border-white/10 bg-black/20 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          For agents
        </h2>
        <ul className="mt-2 space-y-1 font-mono text-sm text-gray-300">
          <li>
            <a className="hover:text-white" href="/llms.txt">/llms.txt</a>{" "}
            <span className="text-gray-500">index of these docs</span>
          </li>
          <li>
            <a className="hover:text-white" href="/llms-full.txt">/llms-full.txt</a>{" "}
            <span className="text-gray-500">every page in one fetch</span>
          </li>
          <li>
            <span>/docs/raw/&lt;slug&gt;</span>{" "}
            <span className="text-gray-500">any page as raw markdown</span>
          </li>
        </ul>
      </div>

      <ul className="space-y-3">
        {DOC_PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/docs/${p.slug}`}
              className="block rounded-lg border border-white/10 bg-black/20 p-4 hover:border-white/25 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-white">{p.title}</span>
                <span className="font-mono text-xs text-gray-500">/docs/{p.slug}</span>
              </span>
              <span className="mt-1 block text-sm text-gray-400">{p.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
