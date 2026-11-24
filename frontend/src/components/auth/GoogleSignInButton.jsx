import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle } from "../../services/auth";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

const productionOrigin = "https://portfolio-forge-ten.vercel.app";
const isHostedPreview = /^portfolio-forge-[a-z0-9-]+-titan-drag\.vercel\.app$/.test(window.location.hostname);

export default function GoogleSignInButton() {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clientId || isHostedPreview) return undefined;

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
        return;
      }

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response?.credential) {
            setError("Google sign-in did not return a credential. Please try again.");
            return;
          }

          setError("");
          try {
            const data = await loginWithGoogle(response.credential);
            if (!data?.access_token || !data?.user) {
              throw new Error("The server returned an invalid sign-in response.");
            }

            sessionStorage.setItem("access_token", data.access_token);
            sessionStorage.setItem("user", JSON.stringify(data.user));
            navigate("/dashboard", { replace: true });
          } catch (err) {
            setError(err.message || "Unable to sign in with Google. Please try again.");
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(buttonRef.current.parentElement?.clientWidth || 360, 420),
      });
    };

    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener("load", renderGoogleButton);
    } else {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      script.onerror = () => setError("Google sign-in could not load. Check your internet connection.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (script) script.removeEventListener("load", renderGoogleButton);
    };
  }, [navigate]);

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[#78847B]">
        <span className="h-px flex-1 bg-white/10" />
        <span>Or continue with</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {isHostedPreview ? (
        <a className="block text-center underline" href={productionOrigin + window.location.pathname}>
          Continue to the public site for Google sign-in
        </a>
      ) : clientId ? (
        <div className="flex min-h-11 justify-center">
          <div ref={buttonRef} className="max-w-full" />
        </div>
      ) : (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
          Google sign-in needs VITE_GOOGLE_CLIENT_ID in your frontend .env file.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
