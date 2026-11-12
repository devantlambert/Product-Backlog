"use client";

import { useEffect, useRef, useState } from "react";
import { legacyMarkup } from "@/lib/legacy-markup";
import { createStore } from "@/lib/store";

/**
 * Loads the data first, then hands the page to the roadmap screens.
 * The screens are the prototype's, run as-is, with their storage pointed at the store.
 */
export function RoadmapApp() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const status = (text: string, tone?: "ok" | "bad") => {
      const el = document.getElementById("store-status");
      if (el) {
        el.textContent = text;
        el.className = tone === "bad" ? "bad" : "";
      }
    };
    createStore(status)
      .then((store) => {
        if (cancelled || (window as any).RoadmapStore) return; // eslint-disable-line @typescript-eslint/no-explicit-any
        (window as any).RoadmapStore = store; // eslint-disable-line @typescript-eslint/no-explicit-any
        setReady(true);
        requestAnimationFrame(() => {
          status(document.getElementById("store-status")?.textContent || "");
          const footer = document.querySelector(".store-status");
          if (store.mode === "database" && footer) {
            const links = document.createElement("span");
            links.className = "auth-links";
            if (store.session) {
              const out = document.createElement("button");
              out.className = "btn sm ghost";
              out.textContent = "Sign out";
              out.onclick = () => store.supabase!.auth.signOut().then(() => location.reload());
              links.append(out);
            } else {
              const a = document.createElement("a");
              a.className = "btn sm ghost";
              a.href = "/login";
              a.textContent = "Sign in";
              links.append(a);
            }
            footer.append(links);
            const reset = document.getElementById("store-reset");
            if (reset && !store.canEdit()) reset.hidden = true;
          }
          // a magic-link sign-in lands with ?code=…; tidy the address once it's used
          if (location.search) history.replaceState(null, "", location.pathname + location.hash);
          const s = document.createElement("script");
          s.src = "/legacy/roadmap.js";
          document.body.append(s);
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="boot">Couldn&apos;t load the roadmap: {error}</p>;
  return (
    <>
      {!ready && <p className="boot">Loading the roadmap…</p>}
      <div ref={host} hidden={!ready} dangerouslySetInnerHTML={{ __html: legacyMarkup }} />
    </>
  );
}
