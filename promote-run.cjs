// Runs the year-end promotion (used by GitHub Actions on 31 December).
// Firebase is the MAIN database; Supabase is the 2nd database and is updated as a copy.
const P = require("./promote.js");

const FB = { apiKey: "AIzaSyDfpgCrYIkDoFvZgMsb1eYY5D_JtFFu4p0", projectId: "oldoinyo-portal" };
const SB_URL = process.env.SUPABASE_URL || "https://aetgrpmydsnczewaqado.supabase.co";
const SB_KEY = process.env.SUPABASE_KEY || "sb_publishable_6wIUwfVDSX9fFr3IIp6SuA_BHzE1bNn";
const T = SB_URL + "/rest/v1/app_data";
const H = { apikey: SB_KEY, "Content-Type": "application/json" };
if (/^eyJ/.test(SB_KEY)) H.Authorization = "Bearer " + SB_KEY;

const FBU = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents/eh";
const fid = (p) => encodeURIComponent(p.replace(/\//g, "~"));
let token = null;
async function tok() {
  if (token) return token;
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FB.apiKey, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
  });
  if (!r.ok) throw new Error("Firebase sign-in failed (" + r.status + "). Is Anonymous sign-in switched on?");
  token = (await r.json()).idToken;
  return token;
}
async function fbReq(method, url, body) {
  return fetch(url, { method, headers: { Authorization: "Bearer " + (await tok()), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
const fb = {
  async get(p) {
    const r = await fbReq("GET", FBU + "/" + fid(p));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Firebase GET " + p + " failed: " + r.status);
    const j = await r.json();
    return JSON.parse(j.fields.json.stringValue);
  },
  async set(p, d) {
    const r = await fbReq("PATCH", FBU + "/" + fid(p), { fields: { json: { stringValue: JSON.stringify(d) }, ts: { integerValue: String(Date.now()) } } });
    if (!r.ok) throw new Error("Firebase SET " + p + " failed: " + r.status);
  },
  async del(p) {
    const r = await fbReq("DELETE", FBU + "/" + fid(p));
    if (!r.ok && r.status !== 404) throw new Error("Firebase DEL " + p + " failed: " + r.status);
  }
};
const sb = {
  async set(p, d) {
    const r = await fetch(T + "?on_conflict=path", { method: "POST", headers: Object.assign({}, H, { Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify([{ path: p, data: d, updated_at: new Date().toISOString() }]) });
    if (!r.ok) throw new Error("Supabase SET " + p + " failed: " + r.status);
  },
  async del(p) {
    const r = await fetch(T + "?path=eq." + encodeURIComponent(p), { method: "DELETE", headers: Object.assign({}, H, { Prefer: "return=minimal" }) });
    if (!r.ok) throw new Error("Supabase DEL " + p + " failed: " + r.status);
  }
};
let mirrorFailed = 0;
const io = {
  get: (p) => fb.get(p),
  async set(p, d) { await fb.set(p, d); try { await sb.set(p, d); } catch (e) { mirrorFailed++; } },
  async del(p) { await fb.del(p); try { await sb.del(p); } catch (e) { mirrorFailed++; } }
};
P.run(io, { dry: process.env.DRY_RUN === "1", force: process.env.FORCE === "1" })
  .then((r) => { console.log(JSON.stringify(r, null, 1)); if (mirrorFailed) console.log("Note: " + mirrorFailed + " writes to the Supabase copy failed. Open the portal as admin and press Options > Sync databases."); })
  .catch((e) => { console.error(e); process.exit(1); });
