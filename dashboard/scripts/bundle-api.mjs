import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: {
    ingest: "api/ingest.ts",
    live: "api/live.ts",
    agent: "api/agent.ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outdir: "ship/api",
  outExtension: { ".js": ".js" },
  external: ["@vercel/blob", "@vercel/functions"],
  minify: true,
  legalComments: "none",
});

console.log("wrote dashboard/ship/api/{ingest,live,agent}.js");
