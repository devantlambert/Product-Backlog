/**
 * A tiny stand-in for Supabase's REST API, backed by a real Postgres with the
 * app's migration applied. It covers only what the store uses: select with eq
 * filters, upsert with on_conflict, and delete with eq filters.
 */
import { createServer, type Server } from "node:http";
import pg from "pg";

// PostgREST sends dates as yyyy-mm-dd and numerics as numbers
pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(1700, (v: string) => Number(v));

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`bad identifier ${s}`);
  return `"${s}"`;
};

export async function startFakeRest(connectionString: string): Promise<{ url: string; close: () => Promise<void>; pool: pg.Pool }> {
  const pool = new pg.Pool({ connectionString });
  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url!, "http://x");
      const m = u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
      if (!m) {
        res.writeHead(404).end();
        return;
      }
      const table = ident(m[1]);
      const filters: string[] = [];
      const vals: unknown[] = [];
      for (const [k, v] of u.searchParams) {
        if (["select", "on_conflict", "columns"].includes(k)) continue;
        if (!v.startsWith("eq.")) throw new Error(`unsupported filter ${k}=${v}`);
        vals.push(v.slice(3));
        filters.push(`${ident(k)}::text = $${vals.length}`);
      }
      const where = filters.length ? ` where ${filters.join(" and ")}` : "";
      let body = "";
      for await (const c of req) body += c;

      if (req.method === "GET") {
        const r = await pool.query(`select * from public.${table}${where}`, vals);
        const rows = r.rows.map(normalize);
        const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(single ? rows[0] ?? null : rows));
      } else if (req.method === "POST") {
        const rows: Record<string, unknown>[] = [].concat(JSON.parse(body));
        const conflict = (u.searchParams.get("on_conflict") ?? "").split(",").filter(Boolean).map(ident);
        for (const row of rows) {
          const cols = Object.keys(row);
          const p = cols.map((_, i) => `$${i + 1}`);
          const v = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
          const upd = cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ");
          await pool.query(
            `insert into public.${table} (${cols.map(ident).join(", ")}) values (${p.join(", ")}) on conflict (${conflict.join(", ")}) do update set ${upd}`,
            v,
          );
        }
        res.writeHead(201).end();
      } else if (req.method === "DELETE") {
        await pool.query(`delete from public.${table}${where}`, vals);
        res.writeHead(204).end();
      } else res.writeHead(405).end();
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ message: (e as Error).message }));
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, pool, close: async () => (server.close(), await pool.end()) };
}

const normalize = (row: Record<string, unknown>) => row;
