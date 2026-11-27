const body = `# Courses API

The course catalog at /courses. Mounted at \`/api/courses\`. A course is a linked slide deck (an external URL with AI-extracted metadata), a set of [interactive lessons](#lessons) played on shanejli.com, or both, plus ratings and comments. Shipped 2026-08-31 (SHAN-437); lessons 2026-11-03 (SHAN-652); [certificates](#certificates) 2026-11-19 (SHAN-720); [recite steps and exams](#recite-steps-and-exams) 2026-11-20 (SHAN-721); the [recall check](#recall-check) 2026-11-20 (SHAN-722); [certification review](#certification-review) 2026-11-20 (SHAN-723).

## Model

- Categories: \`math physics computer-science engineering biology chemistry history economics philosophy language art music other\`
- Difficulties: \`intro intermediate advanced\`
- Visibility: \`public\` (default) or \`private\`. See [Private courses](#private-courses).
- \`coverUrl\` is null until a cover is uploaded; the site renders a generated cover in that case.
- \`url\` is the deck; it is null for a course that is only lessons.
- \`lessonCount\` and \`stepCount\` are 0 for a deck-only course. Anything above 0 means the course has [lessons](#lessons).
- \`certified\` is true when finishing every lesson, passing the exam and then passing the [recall check](#recall-check) a day later earns a [certificate](#certificates). Only a [certification review](#certification-review) sets it.

## Reads (public, except private courses)

| Method | Path | Notes |
|---|---|---|
| GET | / | \`{courses, nextCursor}\` newest first, private courses left out unless you can see them, with \`rating: {average, count}\`, \`commentCount\`, \`myStars\` when authed. Paged like /api/trips: \`limit\` 1..100 and \`cursor\` = the previous response's \`nextCursor\` sent back verbatim, which is the compound keyset form \`<iso-timestamp>_<row-id>\` and not a bare \`createdAt\` (see [Pagination](/docs/conventions#pagination)). Omit \`limit\` for the whole catalog; \`nextCursor\` is null on the last page |
| GET | /:slug | one course, same shape. 404 for a private course you cannot see |
| GET | /covers/:courseId | cover bytes, public, immutable cache |
| GET | /:id/comments | comments with author objects. 404 for a private course you cannot see |
| GET | /:id/content | \`{content, stats, updatedAt}\`: the lesson document. Exam lessons come without their answers to anyone but the course's author, see [Exams](#exams). 404 for a deck-only course or a private course you cannot see |
| GET | /certificates/:code | \`{certificate}\`, see [Certificates](#certificates). The code is read as printed: dashes, spaces and case are ignored. 404 for an unknown code or one whose course is now private |

## Writes

All writes share PAT bucket \`courses-write\` (60/min). Course mutations are owner-scoped (404 for non-owners); ratings and comments are open to any signed-in user.

| Method | Path | Scope | Body | Notes |
|---|---|---|---|---|
| POST | / | entries:write | \`{url?, content?, title?, description?, category?, difficulty?, durationMinutes?, tags?, visibility?}\` | Needs \`url\`, \`content\` or both. With \`content\` and no \`url\` it is a lessons course: \`title\` is required, nothing is fetched and no model is called; category defaults to \`other\`, difficulty to \`intro\`, duration to the lessons' estimate. A bad \`content\` is a 400 with \`issues\` and creates nothing. With \`url\` it fetches the page server-side and classifies it with an LLM. \`url\` must be http or https (400 otherwise). 502 if the URL is unreachable or resolves to a private, loopback or link-local address (redirects are checked hop by hop, 10s timeout); classification failure falls back to safe defaults (never blocks). 409 duplicate url. Slug generated from title, stable forever (never \`private\` or \`covers\`). \`visibility\` defaults to \`public\`; anything but \`public\`/\`private\` is a 400 |
| PATCH | /:id | entries:write | any of title, description, category, difficulty, durationMinutes, tags (max 8), url, visibility | url must be http or https (400 otherwise). 409 on url clash. \`url: null\` removes the deck, allowed only when the course has lessons (400 otherwise) |
| POST | /:id/reclassify | entries:write | none | Re-runs the AI; overwrites description/category/difficulty/duration/tags but PRESERVES title and slug. 400 for a course with no deck URL |
| PUT | /:id/content | entries:write | the lesson document | Replaces the course's lessons. The body is the document itself. 400 \`{error, issues}\` when invalid, including a body that is not JSON; 200 \`{content, stats, updatedAt, course}\` with ids filled in. 413 when \`Content-Length\` is over 1 MB (a document between 512 KB and 1 MB is a 400 issue instead). A lessons-only course's duration follows the lessons. When the lessons actually change on a certified course, or one whose [review](#certification-review) is pending, the course stops issuing certificates and the new version is queued for review; the response then carries that \`review\` |
| DELETE | /:id/content | entries:write | none | 204. 400 on a lessons-only course (delete the course instead); 404 when the course has no lessons |
| POST | /content/validate | signed in | the lesson document | Dry run, never writes: 200 \`{ok: true, content, stats}\` or 200 \`{ok: false, issues}\`, also for a body that is not JSON. The one non-200 is 413 when \`Content-Length\` is over 1 MB |
| GET | /:id/progress | signed in | none | Your progress: \`{progress: [{lessonId, bestScore, lastScore, attempts, completedAt, updatedAt}], exams: [{lessonId, bestScore, lastScore, attempts, passedAt, updatedAt, resitAt}]}\`, empty when you have not started. \`exams\` holds your [exam](#exams) sittings; \`resitAt\` is when the next sitting opens (null for the course's author) |
| PUT | /:id/progress/:lessonId | reactions:write | \`{score}\` int 0..100 | Records one finished run and returns \`{progress: {lessonId, bestScore, lastScore, attempts, completedAt, updatedAt}}\` for that lesson. The first sets \`completedAt\`; later ones bump \`attempts\`, keep the best score. 404 for a lesson id the course does not have, or a course with no lessons. 409 for an exam lesson, which is scored only by submitting it |
| DELETE | /:id/progress | reactions:write | none | 204. Clears your progress, your exam sittings and a passed recall check on this course. An exam sitting from the last day stays, so clearing cannot skip the wait before the next one, and a recall check not yet passed stays, so the next sitting still draws new cards |
| POST | /:id/lessons/:lessonId/steps/:step/recite | reactions:write | \`{answer, attempt?}\` 1..5000, attempt 1..50 | Grades one [recital](#recite-steps-and-exams) in a practice lesson (\`step\` is its 0-based index). Returns \`{correct, score, feedback, judge}\`; a miss adds \`{hint, hintNumber, hintsTotal}\`, the hint for that attempt. Nothing is stored. 404 when that step is not a recite step, 409 inside an exam, 503 when no grader is reachable. PAT bucket \`courses-recite\` (60/min) |
| POST | /:id/exams/:lessonId | reactions:write | \`{answers}\`, one entry per step | Grades a whole [exam](#exams) and records the sitting. Returns \`{score, right, graded, passMark, passed, steps: [{index, correct, feedback?}], result}\`, never the right answers. 404 when the lesson is not an exam, 409 \`{error, resitAt}\` within a day of your last sitting of it (nothing graded), 503 (and nothing recorded) when no grader is reachable. PAT bucket \`courses-exam\` (10/min) |
| GET | /:id/recall | signed in | none | Your [recall check](#recall-check) on a certified course: \`{recall: {status, passMark, questions, lessonsLeft, unlocksAt, result, draw}}\`. \`draw\` is \`{id, steps}\` while \`status\` is \`open\`, else null. 404 on a course that is not certified, or is private |
| POST | /:id/recall | reactions:write | \`{draw, answers}\` | Grades one recall sitting: \`draw\` is the \`draw.id\` you were served and \`answers[i]\` answers \`draw.steps[i]\`, as in an exam. Returns \`{score, right, graded, passMark, passed, steps, result, unlocksAt}\`, never the right answers; \`unlocksAt\` is when the next sitting opens after a fail. 409 before it opens (\`{error, unlocksAt}\`), while a lesson is unfinished, once passed, or when \`draw\` is out of date (the course was edited or another sitting landed; GET it again). 503 (and nothing recorded) when no grader is reachable. PAT bucket \`courses-exam\` |
| GET | /:id/certificate | signed in | none | \`{certificate}\` you were issued for this course; 404 before you claim one |
| POST | /:id/certificate | reactions:write | \`{name?}\` 1..120 | Claims your certificate. 201 \`{certificate}\` when issued, 200 with the same one on any later claim. 409 when the course is not certified (or is private), or while a lesson is unfinished or an exam not passed (\`{error, missing: [lessonId]}\`), or the recall check not passed (\`{error, recall: "pending"}\`). \`name\` is printed on it and defaults to your account name (400 when you have none). Clearing progress does not revoke it |
| POST | /:id/review | entries:write | none | The course's author submits it for [certification review](#certification-review). 202 \`{review}\` with \`status: "pending"\`; the verdict lands a minute or so later. Needs a public course whose lessons include at least one recite step and an exam (400 otherwise, with \`missing\` naming what is lacking). Submitting a version that is still pending retries it and answers 202 with the same review; a version already approved answers 200; a version already rejected, or one whose certification the site owner withdrew, is a 409 until the lessons change. 404 for anyone but the author. PAT bucket \`courses-review\` (5/min) |
| GET | /:id/review | signed in | none | \`{review, certified}\`: the course's newest review, or null when it was never submitted. The author and the site owner only (404 for anyone else) |
| PUT | /:id/certification | entries:write | \`{certified: false}\` | Site owner only (403 for anyone else): withdraws a course's certification. \`true\` is a 409, since only a [review](#certification-review) certifies. Returns \`{course}\`. Issued certificates stay valid |
| DELETE | /:id | entries:write | none | 204, cascades ratings and comments |
| PUT | /:id/cover | entries:write | multipart \`file\` | Same image ladder as journal: sniffed png/jpeg/gif/webp, 5MB 413, 415 otherwise |
| DELETE | /:id/cover | entries:write | none | back to the generated cover |
| PUT | /:id/rating | reactions:write | \`{stars}\` int 1..5 | Upsert per (user, course); returns \`{rating:{average, count, mine}}\` |
| DELETE | /:id/rating | reactions:write | none | clears yours, returns fresh aggregate |
| POST | /:id/comments | comments:write | \`{content, parent_comment_id?}\` 1..10k | markdown, one reply level; the parent must be a top-level comment on this course, else 400 |
| PATCH | /comments/:id | comments:write | \`{content}\` | author only. Saving the text it already has is a 200 that keeps \`editedAt\` |
| DELETE | /comments/:id | comments:write | none | comment author or course owner; 204. Its replies are kept and become top-level comments |

## Lessons

Shipped 2026-11-03 (SHAN-652). A course can carry interactive lessons in the style of Duolingo or CodeSignal: one card at a time, the learner answers, checks, and reads why. Anyone signed in can write a course, in the lesson editor on the course page or by sending the document to the API. Every answer is written by the author. Practice steps are graded by comparison in the browser; a recite step is graded for meaning on the server, and an exam is graded entirely on the server (see [Recite steps and exams](#recite-steps-and-exams)).

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
            { "type": "teach", "title": "Optional", "body": "Markdown. **Bold**, \`code\`, links, lists.",
              "visual": { "kind": "diagram", "mermaid": "flowchart LR\\n  Website --> Collector --> BigQuery",
                          "caption": "Optional" } },
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
| \`teach\` | \`body\` (markdown, 4000), \`visual\` (required, see below), \`title?\`, \`code?\`, \`language?\` | reads, then continues. Not graded |
| \`choice\` | \`prompt\`, \`choices\` 2..8 of \`{text, correct?, why?}\` | picks one. Two or more \`correct\` makes it select-all-that-apply |
| \`blank\` | \`text\` with 1..10 \`[[answer\\|alternative]]\` blanks, \`prompt?\`, \`bank?\` (up to 12 distractors) | types each answer, or with \`bank\` taps tiles (each blank's first answer plus the distractors). Typed answers ignore case, extra spaces, curly quotes and trailing punctuation |
| \`order\` | \`prompt\`, \`items\` 2..10 in the right order | arranges the shuffled items |
| \`match\` | \`pairs\` 2..8 of \`[left, right]\`, \`prompt?\` | pairs the two columns; a wrong pair counts as a miss |
| \`recite\` | \`prompt\` (1000), \`answer\` (2000) | types the answer from memory, in their own words. Graded for meaning, see [Recite steps and exams](#recite-steps-and-exams) |

Every graded step also takes \`code\` (a snippet shown above the answers, the "what does this print?" shape), \`language\` and \`explanation\`.

### Every teach card needs a visual (SHAN-713)

A teach card is where a course explains something, and a page of words alone is not an explanation this site accepts. Whoever writes the course, a person in the editor or an agent through the API, gives every teach card a \`visual\`. Prefer a diagram or an image whenever there is anything to draw; an emoji is the floor for a card that truly has nothing to picture.

| \`kind\` | Fields | Shown |
|---|---|---|
| \`diagram\` | \`mermaid\` (Mermaid source, 4000), \`caption?\` | rendered as a diagram under the text. The source must start with its diagram type (\`flowchart LR\`, \`sequenceDiagram\`, \`stateDiagram-v2\`, \`timeline\`, ...) |
| \`image\` | \`src\`, \`alt\` (required, 300), \`caption?\` | under the text. \`src\` must be an image uploaded to the site: \`POST /api/journal/images\` (multipart \`file\`, see [Images API](/docs/images-api)) and use the \`/api/journal/images/<id>\` path it returns. Images from anywhere else are refused, so a course cannot put a third-party tracking pixel in front of its learners |
| \`emoji\` | \`emoji\` (emoji only, no letters or digits, 32), \`caption?\` | large, above the text |

A teach card without one is a 400 at \`units[i].lessons[j].steps[k].visual\` whose message lists the three shapes. Courses saved before this rule still play as they were stored; the rule applies the next time their content is saved. Slide-deck courses (\`url\`) live outside this validator, and the same rule applies to them by convention: every slide that explains something carries a diagram, an image or at least an emoji.

Rules the validator enforces, each reported with a path such as \`units[0].lessons[2].steps[1].choices\`:

- Unknown keys are errors, so a typo like \`"choises"\` is caught rather than ignored.
- Every lesson needs at least one graded step. A choice needs a \`correct\` one. An exam lesson cannot hold a \`match\` step, and its \`passMark\` is a whole number from 50 to 100. Choices, order items and each side of a match must be unique (case-insensitive). Distractors must be unique and cannot match any of a blank's answers, alternatives included, compared the way typed answers are graded (so \`Paris.\` beside \`[[Paris]]\` is refused).
- \`id\` is optional on units and lessons (\`[a-z0-9-]\`, up to 64) and derived from the title when missing. Lesson ids are unique across the course. Progress is keyed by lesson id, so once learners have started, keep a lesson's id when you rename it.
- Limits: 30 units, 30 lessons a unit, 200 lessons, 40 steps a lesson, 512 KB.

Signed-in learners can select words on a course page or inside a lesson card (a heading, a teach card, an explanation) to add a private note or Explain them with their own AI key (SHAN-653). Those are reader notes with \`surface: "course"\`, see [AI and Reader Notes API](/docs/ai-api).

In the player, a missed step goes back to the end of the lesson every time it is missed, so a lesson only finishes once every step has been answered right (SHAN-709). Each retry reshuffles its tiles and says which try it is. The score is the share of graded steps answered right on the first try. Signed-in progress is stored per lesson (the progress endpoints above); signed out, it stays in the browser until the next signed-in visit to that course, which adds each lesson the account has not finished yet as one run at its best score.

A lesson left halfway is not sent to the API. The player keeps the place (cards answered, first-try results, the missed cards queued for the end) in the browser, one lesson per course, and the course page offers Resume. A run whose lesson steps were edited since is dropped. Everything in the player has a key: each answer, tile, item and match cell shows its key (1 to 9, then 0, then a to z; in a match the right column carries on from the left), Backspace takes back the last pick, Enter checks and continues, Escape leaves. On the course page j and k move between lessons, r resumes, and ? lists every key (SHAN-659). Back (or the Left arrow) shows the cards already done in this run, each locked with the answer given and the feedback seen, so it reviews without changing the score; Next (Right arrow or Enter) returns to the current card as it was (SHAN-660). In a put-in-order card, placed items can be dragged into a new order, or moved with Alt and the up or down arrow (SHAN-665).

## Recite steps and exams

Shipped 2026-11-20 (SHAN-721, phase 2 of SHAN-719). These are what make a certificate mean recall under test rather than clicking through.

### Recite steps

\`{"type": "recite", "prompt": "What does ACID stand for?", "answer": "Atomicity, consistency, isolation and durability"}\`. The learner types the answer from memory, and the server grades it with the same grader as [knowledge recite](/docs/knowledge-api): a near-verbatim answer passes at once, otherwise a small model decides whether the recital carries the answer's central meaning and defining facts (paraphrase, order and typos are fine; a missing or wrong defining fact is not), with local embedding similarity as the fallback when no model answers. So write \`answer\` as the defining facts, not every fact. Feedback on a miss never names what was missing.

In a practice lesson a signed-in learner's recital is graded by \`POST /:id/lessons/:lessonId/steps/:step/recite\`; a miss shows the answer and the step comes back at the end, like any other miss. Signed out, the card shows the answer and the learner says whether they had it. That is practice only: nothing signed out counts toward a certificate.

### Exams

A lesson with \`"exam": {"passMark": 80}\` (\`passMark\` 50..100, default 80) is an exam:

- It is served without its answers to everyone but the course's author: a choice loses \`correct\` and \`why\` and gains \`multi\` (true = select all that apply), a blank's answers become \`[[ ]]\` and a word bank arrives as finished \`tiles\`, order items arrive shuffled, a recite step loses \`answer\`, and every \`explanation\` is dropped.
- The learner answers every question once, with no feedback in between, then submits the whole sheet to \`POST /:id/exams/:lessonId\` with \`answers[i]\` answering step \`i\`: an array of choice indexes, an array of blank answers, the order items in order, or the recital as a string (teach steps take \`null\`). A malformed or missing answer is a wrong answer, not an error.
- The server grades it with the same rules as practice and records the sitting apart from practice progress: best score, last score, attempts, and \`passedAt\` from the first sitting at or above the pass mark. The response says which steps were wrong, never what was right, so a resit is still a test. For the same reason a sitting closes the exam for a day: with resits on demand, keeping the right answers and changing the wrong ones would pass any exam in a few tries. \`result.resitAt\` says when the next one opens, and a sitting inside the wait is a 409 \`{error, resitAt}\` before anything is graded. Parallel sittings cannot slip through together: only the first to be recorded is answered, the rest are a 409 with no grade. The course's author is exempt, since they hold the answers.
- \`PUT /:id/progress/:lessonId\` refuses an exam, so its score cannot be self-reported. The recite endpoint refuses an exam's recite steps for the same reason, since its hints would hand the answer out.

## Recall check

Shipped 2026-11-20 (SHAN-722, phase 3 of SHAN-719). Finishing the lessons shows the learner knew the material while it was in front of them. The recall check asks again a day later, with nothing in front of them, so a certificate needs the knowledge to have lasted. Every certified course has one; nothing has to be authored for it.

- **What it asks.** Cards drawn from the exercises of every lesson, exams included (match steps excepted, since a match grades each pair as it is made). One card per lesson first, so every lesson is asked about, then the rest by weight, with a recite step about four times as likely to be drawn as any other card. A sitting holds as many cards as the course has lessons, at least 8 and at most 20, and never more than the course has.
- **When.** \`GET /:id/recall\` reports \`status\`: \`lessons\` until every practice lesson is finished and every exam passed, then \`waiting\` until \`unlocksAt\`, a day after the learner's last finished run of any lesson or exam sitting, then \`open\`, and \`passed\` for good once a sitting reaches the pass mark (80%). Practising a lesson again moves the opening to a day after that practice, since a check taken an hour after a review measures the review. A failed sitting closes it for a day too.
- **How.** Served and graded exactly like an [exam](#exams): the cards come without their answers, every card is answered once, the server grades the whole sheet and says only which cards were wrong. Each sitting draws its own cards, keyed by the learner, the course, how many times they have sat it (clearing progress does not reset that count until the check is passed) and the version of the lessons; \`draw.id\` names that set, and a submission against any other set is a 409.
- Sittings are recorded per learner per course (best score, last score, attempts, \`passedAt\`) and come back as \`result\`.

## Certificates

Shipped 2026-11-19 (SHAN-720, phase 1 of SHAN-719). A certified course issues a certificate, signed by Shane, to every learner who has finished all of its lessons, passed its exam and then passed its [recall check](#recall-check). The certificate is claimed once and never changes: the name and the course title are copied in when it is issued, so renaming the account or the course later does not rewrite one already shared.

\`\`\`json
{
  "code": "7K3M9QX2ABCD",
  "url": "https://shanejli.com/courses/certificates/7K3M9QX2ABCD",
  "recipientName": "Ada Lovelace",
  "courseId": "uuid",
  "courseSlug": "the-course",
  "courseTitle": "The title when it was issued",
  "score": 92,
  "lessonCount": 6,
  "issuedAt": "2026-11-19T21:00:00.000Z"
}
\`\`\`

- \`code\` is 12 characters of Crockford base32 (no I, L, O or U) and is printed in fours, \`7K3M-9QX2-ABCD\`. Anyone with it can check the certificate at \`https://shanejli.com/courses/certificates/<code>\` or \`GET /api/courses/certificates/<code>\`. The page is noindex: the certificate is its holder's to share.
- \`score\` counts only what the server graded (SHAN-729): the mean of the best sitting of each exam and the best sitting of the recall check. A practice lesson's score is self-reported (\`PUT /:id/progress/:lessonId\` takes any 0 to 100), so finishing it is required but its score is not part of the certificate.
- "Finished" means a recorded run (\`PUT /:id/progress/:lessonId\`) for every practice lesson, and a sitting at or above the current pass mark for every exam, as the course stands at the moment of the claim. A lesson added later does not touch certificates already issued.
- A certified course must contain at least one recite step and an exam (SHAN-721): submitting one for review without them is a 400, and so is a content save that would remove them while the course is certified.
- The recall check has to be passed too (SHAN-722), and its best sitting counts toward the certificate's \`score\`.
- A course is certified by [review](#certification-review), which any author can submit a public course to.

## Certification review

Shipped 2026-11-20 (SHAN-723, phase 4 of SHAN-719). A certificate is issued in Shane's name, so a course earns one by passing a review rather than a switch. The author submits it (\`POST /:id/review\`, or the Certificate tab in the lesson editor); a model reads the whole course, every teach card, exercise, answer, recite step and exam question, and answers one question: could someone who finishes this course call themselves top 1% in its topic? Yes certifies it. No rejects it with concrete changes to make.

\`\`\`json
{
  "id": "uuid",
  "status": "rejected",
  "summary": "A solid introduction, but it stops where the hard part begins.",
  "feedback": ["Add a lesson on branch cuts and an exam question that needs one", "..."],
  "attempts": 1,
  "submittedAt": "2026-11-20T15:00:00.000Z",
  "reviewedAt": "2026-11-20T15:01:10.000Z",
  "current": true
}
\`\`\`

- \`status\` is \`pending\` until the reviewer answers, then \`approved\` (the course is certified) or \`rejected\` (\`feedback\` lists what to change). \`superseded\` means the lessons changed before the reviewer got to that version; the change queued a review of its own. Making the course private, or changing a private course's lessons, also supersedes a pending review but queues none: a private course is never certified, so submit again once it is public.
- \`current\` is false once the lessons have changed since the version that was reviewed.
- The review uses the site's LLM fallback chain. When no model is reachable the submission stays \`pending\` and is retried every ten minutes or so (\`attempts\` counts the tries); an outage never rejects a course. Submitting the same version again retries it straight away.
- Editing an approved course's lessons sends it back: it stops issuing certificates until the new version is approved. Learners keep certificates already issued. A save that does not change the lessons changes nothing.
- A rejected version is not reviewed twice. Change the lessons using the feedback, then submit again.
- The site owner can still withdraw a certification (\`PUT /:id/certification\` with \`{certified: false}\`); only a new, changed version can be certified again.

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
