/**
 * Tiny Vercel function that loads dashboard/ship/api/<name>.js from GitHub.
 * File deploys cannot carry the 30k+ bundles through MCP; the repo can.
 */
export function remoteApiLoader(key, pin) {
  return `import { writeFileSync, symlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
import "@vercel/blob";
import "@vercel/functions";

const KEY = ${JSON.stringify(key)};
const PIN = ${JSON.stringify(pin)};
const PATH = "dashboard/ship/api/" + KEY + ".js";

async function fetchSrc() {
  const urls = [
    "https://raw.githubusercontent.com/anirnair/daymeter/" + PIN + "/" + PATH,
    "https://cdn.jsdelivr.net/gh/anirnair/daymeter@" + PIN + "/" + PATH,
  ];
  let last = "";
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store", headers: { accept: "text/javascript, text/plain" } });
      const t = await r.text();
      last = url + " " + r.status + " " + t.slice(0, 60).replace(/\\s+/g, " ");
      if (r.ok && t.includes("export") && t.length > 1000) return t;
    } catch (err) {
      last = String(err);
    }
  }
  throw new Error("fetch-failed " + last);
}

async function load() {
  const g = "__dm_" + KEY;
  if (!globalThis[g]) {
    const src = await fetchSrc();
    try { symlinkSync("/var/task/node_modules", "/tmp/node_modules"); } catch {}
    try { writeFileSync("/tmp/package.json", '{"type":"module"}'); } catch {}
    const dest = "/tmp/dm-" + KEY + ".mjs";
    writeFileSync(dest, src);
    globalThis[g] = import(pathToFileURL(dest).href);
  }
  return globalThis[g];
}

async function wrap(method, e) {
  try {
    const m = await load();
    if (typeof m[method] === "function") return m[method](e);
    throw new Error("no handler " + method);
  } catch (err) {
    return Response.json({ ok: false, error: String(err), pin: PIN, key: KEY }, { status: 500 });
  }
}

export const GET = (e) => wrap("GET", e);
export const POST = (e) => wrap("POST", e);
export const OPTIONS = (e) => wrap("OPTIONS", e);
`;
}
