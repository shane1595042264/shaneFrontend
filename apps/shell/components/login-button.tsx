"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

export function LoginButton() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          try {
            setError(null);
            await login(credentialResponse.credential);
          } catch (err: any) {
            setError(err.message || "Login failed");
          }
        }}
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
