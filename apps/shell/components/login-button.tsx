"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";

// SHAN-318: iOS Chrome's tab crashes on the GSI popup flow (the popup tries
// to bounce auth through a custom URL scheme WebKit can't open). Switching
// to ux_mode='redirect' avoids the popup entirely. Google POSTs the
// credential to login_uri (our /api/auth/google-callback route handler),
// which exchanges it for our session JWT and lands the user back where
// they started via the `state` round-trip.

export function LoginButton() {
  const [loginUri, setLoginUri] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string>("/journal");

  useEffect(() => {
    setLoginUri(`${window.location.origin}/api/auth/google-callback`);
    setReturnPath(window.location.pathname + window.location.search || "/journal");
  }, []);

  // Hold the button slot until login_uri resolves to a same-origin URL;
  // GIS validates that login_uri is same-origin at initialize-time.
  if (!loginUri) {
    return <div className="h-8 w-32 rounded-full bg-white/5" aria-hidden />;
  }

  return (
    <div className="flex items-center gap-2">
      <GoogleLogin
        // In redirect mode GIS never invokes these JS callbacks — the
        // credential flows server-side through Google's POST to login_uri.
        // The props remain required by @react-oauth/google's types.
        onSuccess={() => {}}
        onError={() => {}}
        size="medium"
        theme="filled_black"
        shape="pill"
        text="signin"
        state={returnPath}
        ux_mode="redirect"
        login_uri={loginUri}
      />
    </div>
  );
}
