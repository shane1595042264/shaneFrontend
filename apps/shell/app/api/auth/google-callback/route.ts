import { type NextRequest, NextResponse } from "next/server";

// Bridges Google Identity Services' ux_mode=redirect flow to our
// localStorage-based session.
//
// The GSI popup flow (ux_mode=popup) crashes iOS Chrome tabs (the popup
// tries to bounce auth via a custom URL scheme WebKit cannot open, ending
// at the "Can't open this page" dead-tab error — SHAN-318). Redirect mode
// avoids the popup: Google does a top-level navigate to its OAuth UI and
// then POSTs the credential here.
//
// We then call the existing backend exchange endpoint that already does
// JWKS verification + user upsert, and respond with HTML that writes the
// session JWT to localStorage (matching the popup flow's storage) and
// navigates the user back to where they started.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const credential = form.get("credential")?.toString();
  const csrfFromBody = form.get("g_csrf_token")?.toString();
  const csrfFromCookie = req.cookies.get("g_csrf_token")?.value;
  const state = form.get("state")?.toString() ?? "";

  // Double-submit CSRF check per
  // https://developers.google.com/identity/gsi/web/guides/verify-google-id-token#double_submit_cookie_pattern
  if (!csrfFromBody || !csrfFromCookie || csrfFromBody !== csrfFromCookie) {
    return new NextResponse("CSRF token mismatch", { status: 401 });
  }
  if (!credential) {
    return new NextResponse("Missing credential", { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!upstream.ok) {
    return new NextResponse("Google login exchange failed", { status: 401 });
  }
  const body = (await upstream.json()) as { token?: string };
  if (!body.token) {
    return new NextResponse("Google login exchange returned no token", {
      status: 502,
    });
  }

  // Sanitize the round-tripped state to a same-origin path so this route
  // can't be turned into an open redirect. We only set state from
  // window.location.pathname + search in LoginButton, but a hostile page
  // could craft a credential POST with a different state value.
  const returnPath =
    state.startsWith("/") && !state.startsWith("//") ? state : "/journal";

  const tokenJson = JSON.stringify(body.token);
  const returnJson = JSON.stringify(returnPath);
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Signing you in…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#000;color:#9ca3af;font-family:ui-sans-serif,system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-size:14px}</style>
</head><body>
<p>Signing you in…</p>
<script>
(function(){
  try {
    localStorage.setItem("auth_token", ${tokenJson});
    window.location.replace(${returnJson});
  } catch (e) {
    document.body.textContent = "Could not store session. Please reload and try again.";
  }
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
