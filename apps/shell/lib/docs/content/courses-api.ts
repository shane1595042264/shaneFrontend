const body = `# Courses API

The course catalog at /courses. Mounted at \`/api/courses\`. A course is an external interactive-lecture URL plus AI-extracted metadata, ratings, and comments. Shipped 2026-08-31 (SHAN-437).

## Model

- Categories: \`math physics computer-science engineering biology chemistry history economics philosophy language art music other\`
- Difficulties: \`intro intermediate advanced\`
- Visibility: \`public\` (default) or \`private\`. See [Private courses](#private-courses).
- \`coverUrl\` is null until a cover is uploaded; the site renders a generated cover in that case.

## Reads (public, except private courses)

| Method | Path | Notes |
|---|---|---|
| GET | / | \`{courses, nextCursor}\` newest first, private courses left out unless you can see them, with \`rating: {average, count}\`, \`commentCount\`, \`myStars\` when authed. Paged like /api/trips: \`limit\` 1..100 and \`cursor\` = the previous response's \`nextCursor\` sent back verbatim, which is the compound keyset form \`<iso-timestamp>_<row-id>\` and not a bare \`createdAt\` (see [Pagination](/docs/conventions#pagination)). Omit \`limit\` for the whole catalog; \`nextCursor\` is null on the last page |
| GET | /:slug | one course, same shape. 404 for a private course you cannot see |
| GET | /covers/:courseId | cover bytes, public, immutable cache |
| GET | /:id/comments | comments with author objects. 404 for a private course you cannot see |

## Writes

All writes share PAT bucket \`courses-write\` (60/min). Course mutations are owner-scoped (404 for non-owners); ratings and comments are open to any signed-in user.

| Method | Path | Scope | Body | Notes |
|---|---|---|---|---|
| POST | / | entries:write | \`{url, title?, visibility?}\` | Fetches the page server-side and classifies it with an LLM. \`url\` must be http or https (400 otherwise). 502 if the URL is unreachable or resolves to a private, loopback or link-local address (redirects are checked hop by hop, 10s timeout); classification failure falls back to safe defaults (never blocks). 409 duplicate url. Slug generated from title, stable forever (never \`private\` or \`covers\`). \`visibility\` defaults to \`public\`; anything but \`public\`/\`private\` is a 400 |
| PATCH | /:id | entries:write | any of title, description, category, difficulty, durationMinutes, tags (max 8), url, visibility | url must be http or https (400 otherwise). 409 on url clash |
| POST | /:id/reclassify | entries:write | none | Re-runs the AI; overwrites description/category/difficulty/duration/tags but PRESERVES title and slug |
| DELETE | /:id | entries:write | none | 204, cascades ratings and comments |
| PUT | /:id/cover | entries:write | multipart \`file\` | Same image ladder as journal: sniffed png/jpeg/gif/webp, 5MB 413, 415 otherwise |
| DELETE | /:id/cover | entries:write | none | back to the generated cover |
| PUT | /:id/rating | reactions:write | \`{stars}\` int 1..5 | Upsert per (user, course); returns \`{rating:{average, count, mine}}\` |
| DELETE | /:id/rating | reactions:write | none | clears yours, returns fresh aggregate |
| POST | /:id/comments | comments:write | \`{content, parent_comment_id?}\` 1..10k | markdown, one reply level; the parent must be a top-level comment on this course, else 400 |
| PATCH | /comments/:id | comments:write | \`{content}\` | author only |
| DELETE | /comments/:id | comments:write | none | comment author or course owner; 204. Its replies are kept and become top-level comments |

## Private courses

Shipped 2026-10-25 (SHAN-617), for decks on material that should not be public. A course created or patched with \`"visibility": "private"\` is visible only to the account that created it and to the site owner (the journal's owner, who invites everyone else). For anyone else, signed in or not, it does not exist:

- \`GET /\` leaves it out (so do the sitemap and the server-rendered catalog, which read anonymously).
- \`GET /:slug\`, \`GET /:id/comments\`, \`POST /:id/comments\` and \`PUT\`/\`DELETE /:id/rating\` answer 404 with the same body as a missing course, so a private slug or id cannot be confirmed.

On the site, a private course reads at \`https://shanejli.com/courses/private/<slug>\` (fetched in the browser with your token, robots-disallowed and noindex) instead of \`/courses/<slug>\`, which 404s for it.

What it does not hide: the deck is served by its own host, so its URL (and its \`/learn/<slug>\` alias) answers anyone who has it. The cover image URL is uuid-addressed and only ever handed to someone who can see the course. Classification still sends the page text to the LLM, as for any course.

## Launching a course (SHAN-477)

Courses hosted on the \`supermassive-courses\` service are launched through a same-origin alias rather than their registered URL:

| Registered \`url\` | Launch path |
|---|---|
| \`https://supermassive-courses-production.up.railway.app/courses/<slug>/\` | \`https://shanejli.com/learn/<slug>\` |

\`/learn/:slug\` is a Next rewrite to the hosting origin, so the deck is served from \`shanejli.com\` and corporate DNS filters (which block \`*.up.railway.app\` as a newly-seen domain) never see the Railway hostname. Courses registered on any other host keep launching at their own URL.

The API is unaffected: \`url\` stays the canonical registration key and the uniqueness target, and server-side fetches during classification still use it. \`/learn\` is robots-disallowed — \`/courses/:slug\` is the canonical, indexable page.

## Example

\`\`\`bash
curl -X POST https://shanebackend-production.up.railway.app/api/courses \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"url":"https://supermassive-courses-production.up.railway.app/courses/pi2-heist/"}'
# 201 with AI-filled category/difficulty/duration/tags (allow ~10s)

# The same, private: only you and the site owner will see it
curl -X POST https://shanebackend-production.up.railway.app/api/courses \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"url":"https://supermassive-courses-production.up.railway.app/courses/my-deck/","visibility":"private"}'
\`\`\`
`;
export default body;
