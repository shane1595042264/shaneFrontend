const body = `# Trips API

A public HTML pastebin for trip itineraries at /trips. Mounted at \`/api/trips\`. Wire fields are camelCase.

## Trips

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | / | optional (anonymous OK) | JSON \`{html (1..10MB), title?, filename?, force?}\` OR multipart \`file\` (.html, 10MB) + \`title?\` + \`force?\` | 201 \`{trip:{id, slug, title, ...}}\`; authed upload stamps ownerId, anonymous is ownerless. 409 \`duplicate_trip\` when it repeats an existing trip |
| GET | / | public | \`?limit=1..100&cursor=<opaque, from nextCursor>\` | metadata only, no html |
| GET | /:slug | public | none | full row including html |
| PATCH | /:slug | optional + trips:write (PATs) | any of html/title/filename, or multipart | 403 if owned by someone else; anonymous trips are editable by anyone; slug never changes |
| DELETE | /:slug | optional + trips:write (PATs) | none | 204; same ownership rule |

Gotchas:

- Title precedence on create: body title, then the html \`<title>\` tag, then first h1, then cleaned filename.
- \`trips:write\` only gates PATs; browser JWTs and anonymous callers pass the scope check. The real protection is per-trip ownership.
- Slug is kebab-cased from the title (max 60 chars) with a random suffix on collision.
- POST refuses a duplicate with \`409 {error, code:"duplicate_trip", existing:{slug, title, createdAt}}\`. Two uploads are the same trip when their titles match after trimming, collapsing whitespace and lowercasing, or when their HTML is byte-identical (an override title hides the first test but not the second). \`existing\` is the OLDEST match, so it points at the original. Send \`force\` (JSON \`true\`, multipart \`"true"\`/\`"1"\`) to create the copy on purpose. A null or whitespace-only title never matches on the title arm. PATCH is not checked: it edits a row in place and cannot mint a second URL.
- No rate limiting on this module. The cursor is the compound keyset form \`<iso-timestamp>_<row-id>\`, not the journal's date cursor. Read \`nextCursor\` off a response and send it back verbatim; do not rebuild it from a row's \`createdAt\`, because the id half is what keeps a tie or a sub-millisecond gap from silently dropping rows. See [Pagination](/docs/conventions#pagination).

## Trip Groups (\`/api/trip-groups\`)

Group trip planning. Everything requires a browser session (requireAuth; no PAT scope exists for this module), except raw photo bytes which are public. Membership is join-by-slug: \`POST /:slug/join\`.

Highlights (all under \`/api/trip-groups/:slug\` unless noted):

- \`POST /api/trip-groups\` \`{title}\`: create, caller becomes owner. \`GET /api/trip-groups\`: your groups.
- Ideas: \`POST /ideas\` \`{body}\` (1..4000), delete is author-only.
- \`POST /itinerary/consolidate\`: LLM call turning ideas into a structured itinerary. Owner writes directly (200); a non-owner member creates a pending suggestion (201). 502 when LLM providers are down.
- \`PUT /itinerary\`: manual structured edit (same owner/member fork). \`DELETE /itinerary\`: owner-only reset.
- Suggestions: \`GET /itinerary/suggestions\` (with conflict detection), owner-only approve/reject, race-safe 409 when already resolved.
- Photos: multipart upload per day (5MB, sniffed types), public raw bytes at \`.../photos/:photoId/raw\`, owner-only \`unsplash-fill\`.
- Notes and todo sections: member CRUD with creator-or-owner deletes. \`PUT /sections/:sectionId\` takes \`title?\` plus either a full \`items\` list, which replaces whatever is stored, or item deltas: \`addItems\` (items shaped like the list's), \`removeItemIds\`, \`setItemsDone\` (\`[{id, done}]\`). Deltas are applied to the section as stored at that moment under a row lock, so a check, add or removal another member made after you loaded the list is kept. Prefer them for every item edit. Removing or toggling an id that is already gone does nothing, re-adding an existing id is skipped, and removal wins when one body names the same id twice. Sending \`items\` together with any delta is a 400, and so is a merge that would leave more than 200 items. The response is the merged \`{section}\`.
- \`POST /itinerary/export-calendar\`: exports to the CALLER's Google Calendar; 409 \`calendar_not_connected\` until they connect. Only dated days export. An activity whose \`time\` is a 24h \`H:MM\` or \`HH:MM\` becomes a 1-hour event (one starting after 23:00 ends the next day); any other \`time\` text exports as untimed, listed with that text in the day's all-day event.

Agents without a browser session cannot use trip-groups; use the plain trips API instead.
`;
export default body;
