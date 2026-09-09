const body = `# Training Plans API

Goal-driven training plans for the Practice element, mounted at \`/api/practice/plans\`. A plan is an authored curriculum ("learn the windmill") made of ordered **days**, each holding ordered **blocks** ("Warm-up", "Windmill drills"), each holding ordered **steps** ("10 hip openers"). Distinct from \`/api/practice/sessions\`, which are ad-hoc Fitbod-style runs over knowledge items.

This surface is agent-first: one \`POST /api/practice/plans\` can author an entire plan tree, so a coach agent does not need a dozen round trips.

## Auth

Every route needs a JWT or a PAT. Writes need scope \`practice:write\` (the same scope as the rest of the Practice module, with no separate plans scope). Reads of a plan whose \`visibility\` is \`"public"\` work unauthenticated.

Rate limits (PATs only; JWTs bypass): \`practice-plans-write\` 60/min, \`practice-plan-completions-write\` 120/min.

## Create a whole plan in one call

\`\`\`json
POST /api/practice/plans
{
  "title": "Learn the windmill",
  "goal": "Three clean consecutive windmills",
  "discipline": "bboy",
  "status": "active",
  "daysPerWeek": 3,
  "startDate": "2026-09-14",
  "days": [
    {
      "label": "Day 1: Foundation",
      "weekday": 1,
      "blocks": [
        {
          "title": "Warm-up",
          "kind": "warmup",
          "mode": "time",
          "targetSeconds": 600,
          "steps": [
            { "text": "10 neck circles" },
            { "text": "10 hip openers", "reps": 10 },
            { "text": "10 hollow rocks", "reps": 10 }
          ]
        },
        { "title": "Windmill drills", "kind": "drill", "mode": "reps", "targetReps": 20, "sets": 3, "restSeconds": 60 }
      ]
    },
    { "label": "Day 2: Conditioning" }
  ]
}
\`\`\`

Returns 201 \`{plan}\` with the full tree. **Positions come from array order**. Never send a \`position\`; days, blocks and steps are numbered 1..n as they appear. The slug is derived from the title and is unique per user, not globally.

## Field reference

Plan: \`title\` (1..160, trimmed), \`goal\` (<=2000), \`description\` (<=5000), \`discipline\` (<=60), \`status\` \`draft\` | \`active\` | \`archived\` (default \`draft\`), \`visibility\` \`private\` | \`public\` (default \`private\`), \`startDate\` \`YYYY-MM-DD\`, \`daysPerWeek\` 1..7.

Day: \`label\` (1..120), \`weekday\` 0..6 where 0 = Sunday (null means "the next session" rather than a pinned weekday), \`notes\` (<=2000).

Block: \`title\` (1..160); \`kind\` one of \`warmup\`, \`skill\`, \`drill\`, \`strength\`, \`conditioning\`, \`mobility\`, \`cooldown\`, \`other\` (default \`other\`); \`mode\` \`time\` | \`reps\` (default \`time\`); \`targetSeconds\` 1..86400; \`targetReps\` 1..1000; \`sets\` 1..100 (default 1); \`restSeconds\` 0..3600 (default 0); \`notes\` (<=2000); \`steps\` up to 50.

Step: \`text\` (1..300, trimmed), \`reps\` 1..1000, \`durationSeconds\` 1..86400.

Caps: 60 days per plan, 50 blocks per day, 50 steps per block.

## Routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/practice/plans | auth | \`?status=&limit=1..100\`; \`{plans}\`, yours only, newest-updated first |
| POST | /api/practice/plans | practice:write | nested create above; 201 \`{plan}\` (full tree) |
| GET | /api/practice/plans/:planId | public if plan is public | \`{plan}\` with \`days[].blocks[].steps[]\` |
| PATCH | /api/practice/plans/:planId | practice:write | any plan field; a nested \`days\` key is ignored, edit days via the day routes |
| DELETE | /api/practice/plans/:planId | practice:write | 204; cascades to days, blocks, steps and completions |
| POST | /api/practice/plans/:planId/days | practice:write | appends at the next position; 201 \`{day}\` |
| PATCH | /api/practice/plans/:planId/days/:dayId | practice:write | \`{day}\` |
| DELETE | /api/practice/plans/:planId/days/:dayId | practice:write | 204 |
| POST | /api/practice/plans/:planId/days/:dayId/blocks | practice:write | accepts inline \`steps\`; 201 \`{block}\` |
| PATCH | /api/practice/plans/:planId/days/:dayId/blocks/:blockId | practice:write | \`{block}\` |
| DELETE | /api/practice/plans/:planId/days/:dayId/blocks/:blockId | practice:write | 204 |
| PUT | /api/practice/plans/:planId/days/:dayId/blocks/:blockId/steps | practice:write | replaces the whole list; \`{steps: []}\` clears it |
| POST | /api/practice/plans/:planId/completions | practice:write | records the tally; 201 \`{completion}\` |
| GET | /api/practice/plans/:planId/completions | auth | \`?from=&to=\` (\`YYYY-MM-DD\`); \`{completions}\` |
| DELETE | /api/practice/plans/:planId/completions | practice:write | \`?blockId=&isoDate=\` (query, not a body); 204 |

Every nested resource is addressed under its plan, and a day or block that does not belong to the plan in the URL is a 404 (not a 403), so a private plan id is never confirmable by a stranger.

## The completion tally

\`\`\`json
POST /api/practice/plans/:planId/completions
{ "blockId": "…", "isoDate": "2026-09-14", "setsCompleted": 3, "elapsedSeconds": 620, "completed": true }
\`\`\`

Unique on (user, block, date), so re-POSTing the same triple **updates** rather than duplicating, which is safe for a runner that syncs mid-set. \`completed: false\` clears \`completedAt\` while keeping the partial \`setsCompleted\`/\`elapsedSeconds\`, which is what un-checking a block means. \`GET /completions\` always returns the caller's own tally, even on a public plan.

## Gotchas

- \`isoDate\` is a calendar date, not a timestamp. \`2026-02-30\` is a 400.
- Whitespace-only \`title\`, \`label\` or step \`text\` is a 400, not a blank row.
- \`PATCH\` with an empty body is a 400 ("Nothing to update").
- A \`mode: "reps"\` block should carry \`targetReps\` and a \`mode: "time"\` block \`targetSeconds\`; neither is enforced server-side, so an agent that sets the wrong one produces a block the runner cannot time.
`;
export default body;
