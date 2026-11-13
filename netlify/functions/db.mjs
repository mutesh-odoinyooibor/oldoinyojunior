// Shared database for ElimuHub on Netlify (uses Netlify Blobs). Endpoint: /api/db
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("elimuhub");
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const prefix = url.searchParams.get("prefix");
  const json = (v, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

  if (req.method === "GET" && prefix !== null) {
    const { blobs } = await store.list({ prefix });
    const out = [];
    for (const b of blobs) out.push({ path: b.key, data: await store.get(b.key, { type: "json" }) });
    return json(out);
  }
  if (req.method === "GET") return json(path ? await store.get(path, { type: "json" }) : null);
  if (req.method === "PUT") {
    const body = await req.json();
    if (!body.path) return json({ error: "path required" }, 400);
    await store.setJSON(body.path, body.data);
    return json({ ok: true });
  }
  if (req.method === "DELETE") {
    if (path) await store.delete(path);
    return json({ ok: true });
  }
  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/db" };
