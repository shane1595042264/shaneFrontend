const body = `# Courses API

The course catalog at /courses. Mounted at \`/api/courses\`. A course is an external interactive-lecture URL plus AI-extracted metadata, ratings, and comments. Shipped 2026-08-31 (SHAN-437).

## Model

- Categories: \`math physics computer-science engineering biology chemistry history economics philosophy language art music other\`
- Difficulties: \`intro intermediate advanced\`
- \`coverUrl\` is null until a cover is uploaded; the site renders a generated cover in that case.

## Reads (public)

| Method | Path | Notes |
|---|---|---|
| GET | / | \`{courses}\` newest first with \`rating: {average, count}\`, \`commentCount\`, \`myStars\` when authed |
| GET | /:slug | one course, same shape |
| GET | /covers/:courseId | cover bytes, public, immutable cache |
| GET | /:id/comments | comments with author objects |

## Writes

All writes share PAT bucket \`courses-write\` (60/min). Course mutations are owner-scoped (404 for non-owners); ratings and comments are open to any signed-in user.

| Method | Path | Scope | Body | Notes |
|---|---|---|---|---|
| POST | / | entries:write | \`{url, title?}\` | Fetches the page server-side and classifies it with an LLM. 502 if the URL is unreachable; classification failure falls back to safe defaults (never blocks). 409 duplicate url. Slug generated from title, stable forever |
| PATCH | /:id | entries:write | any of title, description, category, difficulty, durationMinutes, tags (max 8), url | 409 on url clash |
| POST | /:id/reclassify | entries:write | none | Re-runs the AI; overwrites description/category/difficulty/duration/tags but PRESERVES title and slug |
| DELETE | /:id | entries:write | none | 204, cascades ratings and comments |
| PUT | /:id/cover | entries:write | multipart \`file\` | Same image ladder as journal: sniffed png/jpeg/gif/webp, 5MB 413, 415 otherwise |
| DELETE | /:id/cover | entries:write | none | back to the generated cover |
| PUT | /:id/rating | reactions:write | \`{stars}\` int 1..5 | Upsert per (user, course); returns \`{rating:{average, count, mine}}\` |
| DELETE | /:id/rating | reactions:write | none | clears yours, returns fresh aggregate |
| POST | /:id/comments | comments:write | \`{content, parent_comment_id?}\` 1..10k | markdown, one reply level |
| PATCH | /comments/:id | comments:write | \`{content}\` | author only |
| DELETE | /comments/:id | comments:write | none | comment author or course owner; 204 |

## Example

\`\`\`bash
curl -X POST https://shanebackend-production.up.railway.app/api/courses \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"url":"https://supermassive-courses-production.up.railway.app/courses/pi2-heist/"}'
# 201 with AI-filled category/difficulty/duration/tags (allow ~10s)
\`\`\`
`;
export default body;
