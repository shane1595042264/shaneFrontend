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
| GET | /posts/:slug | \`{post, author, title, content, currentVersionNum, prev, next}\` |
| GET | /posts/:slug/versions | \`{versions, nextCursor}\` newest first. Bodies are NOT included (versions are never pruned, so listing them would grow without bound); read one at a time below |
| GET | /posts/:slug/versions/:num | \`{version}\` including the full body |

Pagination on \`/posts\` is a keyset cursor: send the previous response's \`nextCursor\` back verbatim. It is the compound form \`<iso-timestamp>_<row-id>\`, keyed on \`publishedAt\` plus the post id, so do not rebuild it from a post's \`publishedAt\` alone (see [Pagination](/docs/conventions#pagination)). Note the contrast with the Journal API, whose entries cursor is an ISO **date** (\`YYYY-MM-DD\`) because entries are keyed by day. Passing a bare date here is a 400, not a silent empty page. \`nextCursor\` is null on the last page. \`/posts/:slug/versions\` pages on \`versionNum\` instead, like the journal's. A version number — as \`:num\`, as \`?cursor=\`, or as \`target_version_num\` on a revert — is bounded to 1..2147483647, matching the int4 column; past that you get a 400 rather than the 500 Postgres used to raise (SHAN-529).

Sending a valid \`Authorization\` header on any read only ever widens what you see, never narrows it: it adds your own drafts.

### \`prev\` and \`next\` (SHAN-495)

The single-post read carries the post's chronological neighbours so a reader can walk the archive without going back to the index. Each is \`{slug, title}\`, or \`null\` at that end of the archive; both are always present as keys, never omitted.

Neighbours are ordered by \`(published_at, id)\`, and the id breaks ties, so two posts sharing a timestamp are still reachable from one another instead of both claiming the same neighbour. \`prev\` is the older post and \`next\` the newer one, which is the opposite of the list endpoint's newest-first order, so do not assume \`next\` means "the next row you would page to".

Unlike the rest of this endpoint, these two fields do **not** widen for an authenticated caller: neighbours are published posts only, even when the post you asked for is your own draft. Drafts have no place in a chain a stranger can follow.

## Writes (author only)

All writes require \`entries:write\` and share PAT bucket \`blog-write\` (30/min). JWT browser sessions bypass the limit. Every mutation is author-scoped: a post you did not write is a 403 on edit and revert, and a 404 on delete.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /posts | \`{title, content, tags?, status?, cover_image_url?}\` | Slug generated from the title. \`content\` 1..100k markdown, \`tags\` max 10 at 40 chars each, \`status\` defaults to \`published\`. 201 with \`{post, currentVersionNum: 1}\` |
| PATCH | /posts/:slug | any of \`{title, content, tags, status, cover_image_url}\` | See the split below. Empty object is a 400 |
| POST | /posts/:slug/revert | \`{target_version_num}\` | Re-appends that version's title and body as a new version tagged \`revert\`. 404 if the target does not exist |
| DELETE | /posts/:slug | none | 204, soft delete to \`trashed\` |

### The PATCH split

One route, two behaviours, and the difference decides whether you need an \`If-Match\` header:

- \`title\` or \`content\` in the patch is a **content edit**. It mints a new version, bumps \`editCount\`, and **requires \`If-Match: <currentVersionNum>\`**. Omit it and you get a 428. A stale value gets a 409 carrying \`{currentVersionNum}\` so you can rebase and retry. Send only one of the two and the other is carried forward from the current version unchanged.
- \`tags\`, \`status\` or \`cover_image_url\` alone is **metadata**. No version, no \`If-Match\`, no \`editCount\` bump.

A patch may mix both; the content edit runs first, and the metadata update follows.

Remember that \`If-Match\` has to be in the CORS allow-headers list to reach the handler from a browser. It already is, for the journal.

#### From a browser, send \`X-If-Match\` instead (SHAN-487)

\`X-If-Match\` is accepted everywhere \`If-Match\` is, and browsers must use it. Requests from shanejli.com are same-origin and ride a rewrite through Vercel's edge, which evaluates a real \`If-Match\` against the response's ETag. Every 200 JSON response from this API carries a **weak** ETag, and a weak validator can never satisfy \`If-Match\`, which requires strong comparison. The edit committed at the origin and the browser still got \`412 PRECONDITION_FAILED\` back — a save that succeeded, reported as a failure, so a retry wrote it twice. Error responses carry no ETag, which is why 409 and 428 were unaffected.

If you call this API directly (a PAT plus curl against the Railway origin), \`If-Match\` is fine and remains the documented header. \`If-Match\` wins if you somehow send both.

### Cover images (SHAN-487)

\`cover_image_url\` is the post's cover art: the image on its masonry tile and the hero above the body. It is **metadata, not content** — swapping a cover does not mint a version, and a revert to an older version leaves the current cover in place.

Upload the bytes through the journal's uploader, \`POST /api/journal/images\` (multipart \`file\`, 5MB, \`image/*\`), and store the \`url\` it returns. There is deliberately no second upload path for the blog. That endpoint needs journal membership, but \`GET /api/journal/images/:id\` is public, so covers render for anonymous readers.

Accepted values, capped at 500 chars:

- a relative \`/api/journal/images/<uuid>\` path — what the uploader returns, stored relative so it keeps resolving if the backend origin moves
- an absolute \`https://\` URL for art hosted elsewhere

Anything else is a 400: \`http:\`, \`data:\`, \`javascript:\`, and any other same-origin path (a cover must not be able to point at an arbitrary backend route). Send \`null\` to remove a cover; omit the field to leave it untouched. A blank string is treated as \`null\`.

## Comments and reactions (SHAN-488)

The social layer. This is where the blog diverges hardest from the Journal API: **reads are anonymous and writes are open to any signed-in user**, not just the post's author. There is no membership gate on any of these routes.

Both live under the post they belong to, and both resolve that post through the same visibility rules as every other read — so a draft or a trashed post 404s here too, and its thread stays private.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /posts/:slug/comments | none | \`{comments}\`, oldest first, each with an \`author\` object |
| POST | /posts/:slug/comments | \`comments:write\` | \`{content}\`, 1..10k markdown. 201 with \`{comment}\` |
| PATCH | /comments/:id | \`comments:write\` | \`{content}\`. Comment author only; anyone else gets a 404 |
| DELETE | /comments/:id | \`comments:write\` | 204. Comment author **or** the post's author, so the author can moderate their own page |
| GET | /posts/:slug/reactions | none | \`{summary, mine}\`. \`summary\` is \`[{emoji, count}]\`; \`mine\` is empty for an anonymous caller |
| POST | /posts/:slug/reactions | \`reactions:write\` | \`{emoji}\`, toggles. Returns \`{result: "added" \| "removed"}\` |

Comments use PAT bucket \`blog-comments-write\` (30/min) and reactions \`blog-reactions-write\` (60/min) — separate from \`blog-write\`, so a chatty commenting token cannot exhaust the author's publishing budget. JWT browser sessions bypass both.

Two shape notes, both deliberate:

- **Comments are flat.** There is no \`parent_comment_id\`, unlike journal comments, which thread one level deep. A public post's thread is mostly the author answering readers, which reads better chronologically — and comments are hard-deleted, so threading would mean deciding what happens to a reply whose parent is gone.
- **Reactions attach to posts, not comments.** The journal has per-comment reactions because a journal thread is a two-person conversation where a thumbs-up is a reply. On a public post the reaction that carries signal is the one on the post.

\`emoji\` comes from the same site-wide vocabulary as journal reactions: \`+1\`, \`-1\`, \`laugh\`, \`heart\`, \`hooray\`, \`rocket\`, \`eyes\`, \`confused\`. Anything else is a 400. One row per (user, post, emoji): posting the same emoji twice removes it.

Every post carries a \`commentCount\` on the list and detail payloads, maintained alongside the comments themselves so the index can show a count without a query per tile.

## Feeds (SHAN-491)

The blog is subscribable. Both feeds live on the frontend, not the API, because they are reader-facing documents rather than JSON endpoints:

| URL | Format | Content type |
|---|---|---|
| https://shanejli.com/blog/feed.xml | RSS 2.0 | \`application/rss+xml\` |
| https://shanejli.com/blog/feed.json | JSON Feed 1.1 | \`application/feed+json\` |

They carry the 50 newest **published** posts, newest first, with the full body rendered to HTML (\`content:encoded\` in RSS, \`content_html\` in JSON Feed) plus a plain-text excerpt, tags, author, and the cover image where one exists. Both are cached for an hour, so a post shows up in a reader within about that long.

The feeds are built from the same anonymous \`GET /posts\` and \`GET /posts/:slug\` documented above, with no \`Authorization\` header — which is precisely why drafts cannot leak into them. That is also why there is no journal equivalent: the journal is invite-only, a feed pull carries no viewer to check membership against, and \`/journal/feed.xml\` and \`/journal/feed.json\` return 404 on purpose (see [Journal API](/docs/journal-api)).

Mermaid blocks in a post body arrive in the feed as fenced code, not diagrams — the mermaid upgrade is client-side and there is no client in a feed reader. Upload a rendered image instead when the diagram has to survive the trip; see [Images API](/docs/images-api).

Both URLs are advertised from \`<head>\` on \`/blog\` and on every post page as \`<link rel="alternate">\`, so a reader that accepts a page URL will find them on its own.

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

# Comment on it as a different signed-in user
curl -X POST https://shanebackend-production.up.railway.app/api/blog/posts/on-slow-mornings/comments \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"content":"This is the one that made me subscribe."}'
# 201 {"comment":{"id":"...","content":"This is the one that made me subscribe."}}

# React, then react again to take it back
curl -X POST https://shanebackend-production.up.railway.app/api/blog/posts/on-slow-mornings/reactions \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d '{"emoji":"heart"}'
# 200 {"result":"added"}

# Read the thread with no credentials at all
curl https://shanebackend-production.up.railway.app/api/blog/posts/on-slow-mornings/comments
\`\`\`
`;
export default body;
