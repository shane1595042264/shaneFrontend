const body = `# Blog API

The public blog. Mounted at \`/api/blog\`. Shipped 2026-09-11 (SHAN-478 Phase 1). The human-readable surface it powers is [/blog](/blog): a masonry index with a tag rail, and \`/blog/<slug>\` per post (SHAN-478 Phase 2).

This is the journal's mechanics without the journal's door. The journal is invite-only (SHAN-472): every route under \`/api/journal\` runs a membership check and 403s strangers. The blog runs none of it. Every GET below answers an anonymous request with no \`Authorization\` header at all.

## Model

A post is a slug plus an append-only chain of versions, exactly like a journal entry and its \`journal_versions\`. Two differences from the journal are worth reading before you write a client:

- **Keyed by slug, not date.** The journal is a diary: one entry per calendar day, \`date\` unique. A blog publishes many posts a day, so the natural key is a slug generated from the title. Slugs are stable forever; renaming a post does not move its URL.
- **Titles are versioned.** A journal entry is titled by its date. A blog post carries a real title, and a rename is an edit like any other, recorded in the revision history and restored by a revert.

\`status\` is one of \`published\`, \`draft\`, \`trashed\`. Only \`published\` posts are world-readable. A \`draft\` is visible to its author and to nobody else, on both the list and the detail route. A \`trashed\` post is visible to nobody, including its author. Publishing a draft re-dates \`publishedAt\` to the moment it went public, so a post you started three weeks ago does not appear already buried; re-saving an already-published post leaves \`publishedAt\` alone.

## Reads (public, no auth)

| Method | Path | Notes |
|---|---|---|
| GET | /posts | \`{posts, nextCursor}\`, newest \`publishedAt\` first, each with \`contentExcerpt\` and an \`author\` object. \`limit\` 1..100 (default 20), \`tag\` filters on the tags array, \`q\` searches title and body case-insensitively |
| GET | /posts/:slug | \`{post, author, title, content, currentVersionNum}\` |
| GET | /posts/:slug/versions | \`{versions, nextCursor}\` newest first. Bodies are NOT included (versions are never pruned, so listing them would grow without bound); read one at a time below |
| GET | /posts/:slug/versions/:num | \`{version}\` including the full body |

Pagination on \`/posts\` is a keyset cursor: \`cursor\` is the previous page's last \`publishedAt\` as an ISO 8601 **datetime**. Note the contrast with the Journal API, whose cursor is an ISO **date** (\`YYYY-MM-DD\`) because entries are keyed by day. Passing a bare date here is a 400, not a silent empty page. \`nextCursor\` is null on the last page. \`/posts/:slug/versions\` pages on \`versionNum\` instead, like the journal's.

Sending a valid \`Authorization\` header on any read only ever widens what you see, never narrows it: it adds your own drafts.

## Writes (author only)

All writes require \`entries:write\` and share PAT bucket \`blog-write\` (30/min). JWT browser sessions bypass the limit. Every mutation is author-scoped: a post you did not write is a 403 on edit and revert, and a 404 on delete.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /posts | \`{title, content, tags?, status?}\` | Slug generated from the title. \`content\` 1..100k markdown, \`tags\` max 10 at 40 chars each, \`status\` defaults to \`published\`. 201 with \`{post, currentVersionNum: 1}\` |
| PATCH | /posts/:slug | any of \`{title, content, tags, status}\` | See the split below. Empty object is a 400 |
| POST | /posts/:slug/revert | \`{target_version_num}\` | Re-appends that version's title and body as a new version tagged \`revert\`. 404 if the target does not exist |
| DELETE | /posts/:slug | none | 204, soft delete to \`trashed\` |

### The PATCH split

One route, two behaviours, and the difference decides whether you need an \`If-Match\` header:

- \`title\` or \`content\` in the patch is a **content edit**. It mints a new version, bumps \`editCount\`, and **requires \`If-Match: <currentVersionNum>\`**. Omit it and you get a 428. A stale value gets a 409 carrying \`{currentVersionNum}\` so you can rebase and retry. Send only one of the two and the other is carried forward from the current version unchanged.
- \`tags\` or \`status\` alone is **metadata**. No version, no \`If-Match\`, no \`editCount\` bump.

A patch may mix both; the content edit runs first, and the metadata update follows.

Remember that \`If-Match\` has to be in the CORS allow-headers list to reach the handler from a browser. It already is, for the journal.

## Example

\`\`\`bash
# Publish
curl -X POST https://shanebackend-production.up.railway.app/api/blog/posts \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"title":"On Slow Mornings","content":"# On Slow Mornings\\n\\n...","tags":["essays"]}'
# 201 {"post":{"slug":"on-slow-mornings",...},"currentVersionNum":1}

# Edit the body (concurrency-checked)
curl -X PATCH https://shanebackend-production.up.railway.app/api/blog/posts/on-slow-mornings \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -H "If-Match: 1" \\
  -d '{"content":"# On Slow Mornings\\n\\nRewritten."}'
# 200 {"post":{...},"currentVersionNum":2}

# Read it back with no credentials at all
curl https://shanebackend-production.up.railway.app/api/blog/posts/on-slow-mornings
\`\`\`
`;
export default body;
