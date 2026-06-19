"use client";

import { GoogleLogin, useGoogleOAuth } from "@react-oauth/google";
import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useState } from "react";

// iOS Chrome (CriOS) crashes the tab when the GSI popup tries to window.open the
// OAuth consent screen (SHAN-318). One Tap is rendered as an in-page iframe
// (bottom sheet on mobile) — no popup, so no tab crash. The full redirect-mode
// fix needs a Cloud Console redirect-URI whitelist change we can't make from here.
function detectIosChrome(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /CriOS/.test(ua);
}

type GsiId = {
  initialize: (config: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
  prompt: (cb?: (notification: {
    isNotDisplayed?: () => boolean;
    isSkippedMoment?: () => boolean;
    isDismissedMoment?: () => boolean;
  }) => void) => void;
  cancel: () => void;
};

function getGsi(): GsiId | undefined {
  return (window as unknown as { google?: { accounts?: { id?: GsiId } } }).google?.accounts?.id;
}

export function LoginButton() {
  const { login } = useAuth();
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
  const [error, setError] = useState<string | null>(null);
  const [iosChrome, setIosChrome] = useState(false);
  const [oneTapBlocked, setOneTapBlocked] = useState(false);

  useEffect(() => {
    setIosChrome(detectIosChrome());
  }, []);

  const handleCredential = useCallback(
    async (credential: string | undefined) => {
      if (!credential) return;
      try {
        setError(null);
        await login(credential);
      } catch (err: any) {
        setError(err.message || "Login failed");
      }
    },
    [login],
  );

  useEffect(() => {
    if (!iosChrome || !scriptLoadedSuccessfully) return;
    const gid = getGsi();
    if (!gid) return;
    gid.initialize({
      client_id: clientId,
      callback: (resp) => handleCredential(resp.credential),
    });
    return () => gid.cancel();
  }, [iosChrome, scriptLoadedSuccessfully, clientId, handleCredential]);

  if (iosChrome) {
    const triggerPrompt = () => {
      setOneTapBlocked(false);
      setError(null);
      getGsi()?.prompt((n) => {
        if (n.isNotDisplayed?.() || n.isSkippedMoment?.() || n.isDismissedMoment?.()) {
          setOneTapBlocked(true);
        }
      });
    };
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={triggerPrompt}
          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:ring-white/30"
        >
          Sign in with Google
        </button>
        {oneTapBlocked && (
          <span className="max-w-[240px] text-right text-xs leading-tight text-amber-400">
            Sign-in didn&apos;t appear. Open this page in Safari to log in (iOS Chrome popup workaround).
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <GoogleLogin
        onSuccess={(credentialResponse) => handleCredential(credentialResponse.credential)}
        onError={() => setError("Login failed")}
        size="medium"
        theme="filled_black"
        shape="pill"
        text="signin"
      />
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
