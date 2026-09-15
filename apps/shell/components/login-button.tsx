"use client";

import { GoogleLogin, GoogleOAuthProvider, useGoogleOAuth } from "@react-oauth/google";
import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// Shared by the facade, the paint-in placeholder and the iOS Chrome button, so
// all three are the same pill and swapping between them shifts nothing. Sized
// to sit as close as we can to Google's own medium/pill/filled_black button.
const PILL =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15";

// The copy of the pill that sits underneath Google's own button. Same font and
// padding as PILL so it is the same width, but 32px tall and ringless to match
// what GSI paints — anything taller leaves a sliver of outline poking out from
// behind the real button once it lands.
const PILL_UNDERLAY =
  "inline-flex h-8 items-center justify-center rounded-full bg-black px-4 text-sm font-medium text-white";

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

/**
 * The sign-in control users actually see (SHAN-496).
 *
 * Google Identity is a facade until someone shows intent. Mounting
 * GoogleOAuthProvider injects accounts.google.com/gsi/client, which used to
 * happen at the app root: every visitor on every page loaded the SDK and picked
 * up Google's NID third-party cookie, including anonymous readers of the public
 * pages who never sign in, and including signed-in users, who render <UserMenu>
 * and have no login button on screen at all. On mobile it was worse still — the
 * desktop nav is `hidden md:flex`, so the Google button iframe was built
 * off-screen on every page load for a control behind the hamburger. It was the
 * only thing keeping /blog off 100 on Lighthouse Best Practices.
 *
 * The provider lives down here on the button instead of at the root, so
 * activating it remounts one leaf rather than the whole application. Nesting a
 * provider this way is the same pattern add-to-calendar-button.tsx already uses.
 *
 * Pointer-enter and focus activate as well as click, so on a desktop the script
 * is already in flight before the click lands and signing in stays one click.
 * On touch there is no hover to prefetch from, so it costs one extra tap.
 */
export function LoginButton() {
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);
  const mountRef = useRef<HTMLDivElement>(null);

  // A keyboard user tabs onto the facade, which then replaces itself — without
  // this, the focused element is gone and focus falls back to <body>. Focusing
  // the wrapper keeps their place so the next Tab reaches the Google button.
  // Only the instance that was activated does this: the nav renders one
  // LoginButton and the mobile menu another, and both swap together.
  const focusOnMount = useRef(false);
  useEffect(() => {
    if (active && focusOnMount.current) mountRef.current?.focus();
  }, [active]);

  if (!active) {
    const trigger = () => {
      focusOnMount.current = true;
      activate();
    };
    return (
      <button
        type="button"
        onPointerEnter={activate}
        onFocus={trigger}
        onClick={trigger}
        className={`${PILL} transition hover:ring-white/30`}
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div ref={mountRef} tabIndex={-1} className="outline-none">
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <GsiLoginButton />
      </GoogleOAuthProvider>
    </div>
  );
}

function GsiLoginButton() {
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
        <button type="button" onClick={triggerPrompt} className={`${PILL} hover:ring-white/30`}>
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
      {/*
        GoogleLogin renders an empty div that GSI later fills with an iframe, so
        between mounting and painting there is nothing to look at. Stacking a
        copy of the facade in the same grid cell means the pill simply stays put
        until Google's own (opaque, same-shaped) button lands on top of it —
        no blank gap when a hover activates the control, and no timing logic.
        Hidden from pointers and the a11y tree so it never shadows the real one.
      */}
      <div className="grid min-h-9 items-center [&>*]:col-start-1 [&>*]:row-start-1">
        <span aria-hidden="true" className={`${PILL_UNDERLAY} pointer-events-none`}>
          Sign in with Google
        </span>
        <GoogleLogin
          onSuccess={(credentialResponse) => handleCredential(credentialResponse.credential)}
          onError={() => setError("Login failed")}
          size="medium"
          theme="filled_black"
          shape="pill"
          text="signin"
        />
      </div>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
