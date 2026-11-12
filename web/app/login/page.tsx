"use client";

import { useState } from "react";
import { supabase } from "@/lib/store";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const db = supabase();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setState("sending");
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/` } });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else setState("sent");
  }

  return (
    <main className="login">
      <h1>Sign in to Roadmap</h1>
      {!db ? (
        <p className="muted">No database is connected, so there&apos;s nothing to sign in to. Edits save in this browser.</p>
      ) : state === "sent" ? (
        <p>Check {email} for a sign-in link. It opens Roadmap signed in.</p>
      ) : (
        <form onSubmit={send}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state === "error" && <p className="bad">Couldn&apos;t send the link: {msg}</p>}
        </form>
      )}
      <p className="small muted">
        <a href="/">Back to the roadmap</a>
      </p>
    </main>
  );
}
