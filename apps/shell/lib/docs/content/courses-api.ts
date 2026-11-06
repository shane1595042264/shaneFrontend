const body = `# Courses API

The course catalog at /courses. Mounted at \`/api/courses\`. A course is a linked slide deck (an external URL with AI-extracted metadata), a set of [interactive lessons](#lessons) played on shanejli.com, or both, plus ratings and comments. Shipped 2026-08-31 (SHAN-437); lessons 2026-11-03 (SHAN-652).

## Model

- Categories: \`math physics computer-science engineering biology chemistry history economics philosophy language art music other\`
- Difficulties: \`intro intermediate advanced\`
- Visibility: \`public\` (default) or \`private\`. See [Private courses](#private-courses).
- \`coverUrl\` is null until a cover is uploaded; the site renders a generated cover in that case.
- \`url\` is the deck; it is null for a course that is only lessons.
- \`lessonCount\` and \`stepCount\` are 0 for a deck-only course. Anything above 0 means the course has [lessons](#lessons).

## Reads (public, except private courses)

| Method | Path | Notes |
|---|---|---|
| GET | / | \`{courses, nextCursor}\` newest first, private courses left out unless you can see them, with \`rating: {average, count}\`, \`commentCount\`, \`myStars\` when authed. Paged like /api/trips: \`limit\` 1..100 and \`cursor\` = the previous response's \`nextCursor\` sent back verbatim, which is the compound keyset form \`<iso-timestamp>_<row-id>\` and not a bare \`createdAt\` (see [Pagination](/docs/conventions#pagination)). Omit \`limit\` for the whole catalog; \`nextCursor\` is null on the last page |
| GET | /:slug | one course, same shape. 404 for a private course you cannot see |
| GET | /covers/:courseId | cover bytes, public, immutable cache |
| GET | /:id/comments | comments with author objects. 404 for a private course you cannot see |
| GET | /:id/content | \`{content, stats, updatedAt}\`: the lesson document. 404 for a deck-only course or a private course you cannot see |

## Writes

All writes share PAT bucket \`courses-write\` (60/min). Course mutations are owner-scoped (404 for non-owners); ratings and comments are open to any signed-in user.

| Method | Path | Scope | Body | Notes |
|---|---|---|---|---|
| POST | / | entries:write | \`{url?, content?, title?, description?, category?, difficulty?, durationMinutes?, tags?, visibility?}\` | Needs \`url\`, \`content\` or both. With \`content\` and no \`url\` it is a lessons course: \`title\` is required, nothing is fetched and no model is called; category defaults to \`other\`, difficulty to \`intro\`, duration to the lessons' estimate. A bad \`content\` is a 400 with \`issues\` and creates nothing. With \`url\` it fetches the page server-side and classifies it with an LLM. \`url\` must be http or https (400 otherwise). 502 if the URL is unreachable or resolves to a private, loopback or link-local address (redirects are checked hop by hop, 10s timeout); classification failure falls back to safe defaults (never blocks). 409 duplicate url. Slug generated from title, stable forever (never \`private\` or \`covers\`). \`visibility\` defaults to \`public\`; anything but \`public\`/\`private\` is a 400 |
| PATCH | /:id | entries:write | any of title, description, category, difficulty, durationMinutes, tags (max 8), url, visibility | url must be http or https (400 otherwise). 409 on url clash. \`url: null\` removes the deck, allowed only when the course has lessons (400 otherwise) |
| POST | /:id/reclassify | entries:write | none | Re-runs the AI; overwrites description/category/difficulty/duration/tags but PRESERVES title and slug. 400 for a course with no deck URL |
| PUT | /:id/content | entries:write | the lesson document | Replaces the course's lessons. The body is the document itself. 400 \`{error, issues}\` when invalid; 200 \`{content, stats, updatedAt, course}\` with ids filled in. A lessons-only course's duration follows the lessons |
| DELETE | /:id/content | entries:write | none | 204. 400 on a lessons-only course (delete the course instead) |
| POST | /content/validate | signed in | the lesson document | Dry run, never writes: 200 \`{ok: true, content, stats}\` or 200 \`{ok: false, issues}\` |
| GET | /:id/progress | signed in | none | Your progress: \`{progress: [{lessonId, bestScore, lastScore, attempts, completedAt}]}\` |
| PUT | /:id/progress/:lessonId | reactions:write | \`{score}\` int 0..100 | Records one finished run. The first sets \`completedAt\`; later ones bump \`attempts\`, keep the best score. 404 for a lesson id the course does not have |
| DELETE | /:id/progress | reactions:write | none | Clears your progress on this course |
| DELETE | /:id | entries:write | none | 204, cascades ratings and comments |
| PUT | /:id/cover | entries:write | multipart \`file\` | Same image ladder as journal: sniffed png/jpeg/gif/webp, 5MB 413, 415 otherwise |
| DELETE | /:id/cover | entries:write | none | back to the generated cover |
| PUT | /:id/rating | reactions:write | \`{stars}\` int 1..5 | Upsert per (user, course); returns \`{rating:{average, count, mine}}\` |
| DELETE | /:id/rating | reactions:write | none | clears yours, returns fresh aggregate |
| POST | /:id/comments | comments:write | \`{content, parent_comment_id?}\` 1..10k | markdown, one reply level; the parent must be a top-level comment on this course, else 400 |
| PATCH | /comments/:id | comments:write | \`{content}\` | author only |
| DELETE | /comments/:id | comments:write | none | comment author or course owner; 204. Its replies are kept and become top-level comments |

## Lessons

Shipped 2026-11-03 (SHAN-652). A course can carry interactive lessons in the style of Duolingo or CodeSignal: one card at a time, the learner answers, checks, and reads why. Anyone signed in can write a course, in the lesson editor on the course page or by sending the document to the API. Nothing is AI: every answer is written by the author and graded by comparison in the browser.

The document is plain JSON. Units hold lessons, lessons hold steps:

\`\`\`json
{
  "version": 1,
  "units": [
    {
      "id": "the-trip",
      "title": "The trip",
      "summary": "Optional, shown under the unit title.",
      "lessons": [
        {
          "id": "ten-stops",
          "title": "Ten stops to the report",
          "steps": [
            { "type": "teach", "title": "Optional", "body": "Markdown. **Bold**, \`code\`, links, lists." },
            { "type": "choice", "prompt": "Where does the pixel send a hit?",
              "choices": [
                { "text": "The collector", "correct": true, "why": "Shown when this one is picked." },
                { "text": "BigQuery" }
              ],
              "explanation": "Shown after any answer." },
            { "type": "blank", "text": "Hits land in [[Bronze|lm_bronze]] about hourly." },
            { "type": "blank", "text": "Then they are cleaned into [[Silver]].", "bank": ["Gold", "Bronze"] },
            { "type": "order", "prompt": "Put the stops in order", "items": ["Website", "Collector", "BigQuery"] },
            { "type": "match", "prompt": "Match each table to its layer",
              "pairs": [["raw_events_pixel", "Bronze"], ["identity_candidates", "Silver"]] }
          ]
        }
      ]
    }
  ]
}
\`\`\`

| Step | Fields | The learner |
|---|---|---|
| \`teach\` | \`body\` (markdown, 4000), \`title?\`, \`code?\`, \`language?\` | reads, then continues. Not graded |
| \`choice\` | \`prompt\`, \`choices\` 2..8 of \`{text, correct?, why?}\` | picks one. Two or more \`correct\` makes it select-all-that-apply |
| \`blank\` | \`text\` with 1..10 \`[[answer\\|alternative]]\` blanks, \`prompt?\`, \`bank?\` (up to 12 distractors) | types each answer, or with \`bank\` taps tiles (each blank's first answer plus the distractors). Typed answers ignore case, extra spaces, curly quotes and trailing punctuation |
| \`order\` | \`prompt\`, \`items\` 2..10 in the right order | arranges the shuffled items |
| \`match\` | \`pairs\` 2..8 of \`[left, right]\`, \`prompt?\` | pairs the two columns; a wrong pair counts as a miss |

Every graded step also takes \`code\` (a snippet shown above the answers, the "what does this print?" shape), \`language\` and \`explanation\`.

Rules the validator enforces, each reported with a path such as \`units[0].lessons[2].steps[1].choices\`:

- Unknown keys are errors, so a typo like \`"choises"\` is caught rather than ignored.
- Every lesson needs at least one graded step. A choice needs a \`correct\` one. Choices, order items and each side of a match must be unique (case-insensitive). A distractor cannot also be an answer.
- \`id\` is optional on units and lessons (\`[a-z0-9-]\`, up to 64) and derived from the title when missing. Lesson ids are unique across the course. Progress is keyed by lesson id, so once learners have started, keep a lesson's id when you rename it.
- Limits: 30 units, 30 lessons a unit, 200 lessons, 40 steps a lesson, 512 KB.

Signed-in learners can select words on a course page or inside a lesson card (a heading, a teach card, an explanation) to add a private note or Explain them with their own AI key (SHAN-653). Those are reader notes with \`surface: "course"\`, see [AI and Reader Notes API](/docs/ai-api).

In the player, a step missed the first time comes back once at the end of the lesson. The score is the share of graded steps answered right on the first try. Signed-in progress is stored per lesson (the progress endpoints above); signed out, it stays in the browser until the next signed-in visit to that course, which adds each lesson the account has not finished yet as one run at its best score.

A lesson left halfway is not sent to the API. The player keeps the place (cards answered, first-try results, the missed cards queued for the end) in the browser, one lesson per course, and the course page offers Resume. A run whose lesson steps were edited since is dropped. Everything in the player has a key: each answer, tile, item and match cell shows its key (1 to 9, then 0, then a to z; in a match the right column carries on from the left), Backspace takes back the last pick, Enter checks and continues, Escape leaves. On the course page j and k move between lessons, r resumes, and ? lists every key (SHAN-659). Back (or the Left arrow) shows the cards already done in this run, each locked with the answer given and the feedback seen, so it reviews without changing the score; Next (Right arrow or Enter) returns to the current card as it was (SHAN-660). In a put-in-order card, placed items can be dragged into a new order, or moved with Alt and the up or down arrow (SHAN-665).

## Private courses

Shipped 2026-10-25 (SHAN-617), for decks on material that should not be public. A course created or patched with \`"visibility": "private"\` is visible only to the account that created it and to the site owner (the journal's owner, who invites everyone else). For anyone else, signed in or not, it does not exist:

- \`GET /\` leaves it out (so do the sitemap and the server-rendered catalog, which read anonymously).
- \`GET /:slug\`, \`GET /:id/comments\`, \`POST /:id/comments\` and \`PUT\`/\`DELETE /:id/rating\` answer 404 with the same body as a missing course, so a private slug or id cannot be confirmed.

On the site, a private course reads at \`https://shanejli.com/courses/private/<slug>\` (fetched in the browser with your token, robots-disallowed and noindex) instead of \`/courses/<slug>\`, which 404s for it.

Lessons are covered completely: \`GET /:id/content\` and the progress endpoints answer a stranger with the same 404.

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

# A lessons course from a file, no AI involved. course.json is {"units": [...]}
jq -n --slurpfile c course.json '{title: "My course", category: "computer-science", content: $c[0]}' \\
  | curl -X POST https://shanebackend-production.up.railway.app/api/courses \\
      -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" --data @-

# Replace the lessons of an existing course; check first without saving
curl -X POST https://shanebackend-production.up.railway.app/api/courses/content/validate \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" --data @course.json
curl -X PUT https://shanebackend-production.up.railway.app/api/courses/$COURSE_ID/content \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" --data @course.json
\`\`\`
`;
export default body;
