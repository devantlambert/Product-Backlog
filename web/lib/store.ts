"use client";

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { TABLES, KEYS, toRows, fromRows, diff, type Tables } from "./mapping.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Where the roadmap's data lives.
 *
 * With Supabase settings present, everyone reads the shared database and only
 * signed-in editors write to it. Without them (local development, previews
 * with no database) the app falls back to this browser's storage, exactly like
 * the prototype.
 */
export type Store = {
  mode: "database" | "browser";
  initial: any | null;
  save: (S: any) => void;
  canEdit: () => boolean;
  confirmReset: () => boolean;
  session: Session | null;
  role: string | null;
  supabase: SupabaseClient | null;
};

const LOCAL_KEY = "roadmap-prototype-v3";
const EDITORS = new Set(["product", "dev"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;
export function supabase() {
  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } });
  return client;
}

export async function createStore(onStatus: (text: string, tone?: "ok" | "bad") => void): Promise<Store> {
  const db = supabase();
  if (!db) return browserStore(onStatus);

  const { data } = await db.auth.getSession();
  const session = data.session;
  let role: string | null = null;
  if (session) {
    const { data: prof } = await db.from("profiles").select("role").eq("user_id", session.user.id).maybeSingle();
    role = prof?.role ?? "viewer";
  }
  return databaseStore(db, session, role, onStatus);
}

/** The shared-database store. Exported on its own so tests can run it against a test database. */
export async function databaseStore(
  db: SupabaseClient,
  session: Session | null,
  role: string | null,
  onStatus: (text: string, tone?: "ok" | "bad") => void,
  confirm: (msg: string) => boolean = (m) => window.confirm(m),
): Promise<Store & { flushed: () => Promise<void> }> {
  const loaded = {} as Tables;
  for (const t of TABLES) {
    const { data: rows, error } = await db.from(t).select("*");
    if (error) throw new Error(`Couldn't load ${t}: ${error.message}`);
    (loaded as any)[t] = rows ?? [];
  }
  const initial = fromRows(loaded);
  // compare against what the app would write, so a reload never causes writes by itself
  let snapshot: Tables = initial ? toRows(initial) : emptyTables();

  const editor = !!session && EDITORS.has(role ?? "");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();
  let latest: Tables | null = null;

  async function flush() {
    if (!latest) return;
    const next: Tables = latest;
    latest = null;
    const changes = diff(snapshot, next);
    if (!changes.length) return;
    onStatus("Saving…");
    try {
      // parents first, so new projects exist before their dependencies
      for (const c of changes) {
        if (c.upsert.length) {
          const { error } = await db!.from(c.table).upsert(c.upsert, { onConflict: KEYS[c.table].join(",") });
          if (error) throw new Error(`${c.table}: ${error.message}`);
        }
      }
      for (const c of [...changes].reverse()) {
        for (const r of c.remove) {
          let q = db!.from(c.table).delete();
          for (const k of KEYS[c.table]) q = q.eq(k, r[k] as never);
          const { error } = await q;
          if (error) throw new Error(`${c.table}: ${error.message}`);
        }
      }
      snapshot = next;
      onStatus(savedText(session, role), "ok");
    } catch (e) {
      onStatus(`Not saved: ${(e as Error).message}. Reload to see the latest.`, "bad");
    }
  }

  onStatus(savedText(session, role));
  return {
    mode: "database",
    initial,
    session,
    role,
    supabase: db,
    canEdit: () => editor,
    flushed: async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        running = running.then(flush);
      }
      await running;
    },
    confirmReset: () =>
      editor && confirm("Replace everything in the shared database with the sample data? Everyone will see the change."),
    save(S) {
      if (!editor) return;
      // rows are built now, so list items get their keys on the live state, not on a copy
      latest = toRows(S);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        running = running.then(flush);
      }, 400);
    },
  };
}

function savedText(session: Session | null, role: string | null) {
  if (!session) return "Fictional sample data. Sign in to edit.";
  if (!EDITORS.has(role ?? "")) return `Signed in as ${session.user.email}. Read-only: ask an editor for edit access.`;
  return `Signed in as ${session.user.email}. Changes save to the shared database.`;
}

function emptyTables(): Tables {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables;
}

function browserStore(onStatus: (text: string) => void): Store {
  let initial = null;
  try {
    initial = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null");
  } catch {}
  onStatus("Fictional sample data. No database is connected, so edits are saved in this browser only.");
  return {
    mode: "browser",
    initial,
    session: null,
    role: null,
    supabase: null,
    canEdit: () => true,
    confirmReset: () => true,
    save(S) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(S));
      } catch {}
    },
  };
}
