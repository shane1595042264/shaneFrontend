const body = `# Images API

Journal image storage, used to embed images (and rendered diagrams) in any markdown surface on the site.

## Upload

\`POST /api/journal/images\` with any authenticated token (JWT or any PAT, no scope needed).

\`\`\`bash
curl -X POST https://shanebackend-production.up.railway.app/api/journal/images \\
  -H "Authorization: Bearer $PAT" \\
  -F "file=@diagram.png;type=image/png"
# 201 {"id":"<uuid>","url":"/api/journal/images/<uuid>"}
\`\`\`

Rules:

- Multipart field name must be \`file\`.
- The server sniffs magic bytes and ignores your Content-Type. Accepted: png, jpeg, gif, webp. SVG is deliberately rejected (XSS vector): 415.
- Max 5MB: 413. Empty or missing file: 400.
- Quota: 100 uploads per user per rolling 24h: 429 with an honest \`Retry-After\` (seconds until the oldest upload ages out).

## Serving

\`GET /api/journal/images/:id\` is fully public, streams the stored bytes with the sniffed Content-Type and \`Cache-Control: public, max-age=31536000, immutable\`. There is no delete endpoint.

## Embedding

Embed the absolute backend URL in markdown, which is what the site's own editor does:

\`\`\`markdown
![architecture](https://shanebackend-production.up.railway.app/api/journal/images/<uuid>)
\`\`\`

The relative form \`/api/journal/images/<uuid>\` also renders on shanejli.com pages (rewrite), but breaks in feeds and external readers; prefer absolute.

## Diagrams

Journal entry bodies and appends render fenced \`\`\`mermaid code blocks natively, so prefer a mermaid block there. Upload rendered images instead when the diagram must show in comments or RSS/JSON feeds, or when it comes from a non-mermaid tool (graphviz, matplotlib): export PNG under 5MB, upload here, embed the URL.
`;
export default body;
