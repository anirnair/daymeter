import type { Plugin } from "vite";
import { CORS, handleAgent, handleIngestPost, handleLiveGet, json, readIncoming, writeNodeResponse } from "./src/lib/server";

export function liveApi(): Plugin {
  return {
    name: "daymeter-live-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0] || "";
        if (!path.startsWith("/api/")) return next();
        try {
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);
            res.end();
            return;
          }
          const incoming = await readIncoming(req);
          let response: Response;
          if (path === "/api/live" && incoming.method === "GET") response = await handleLiveGet();
          else if (path === "/api/ingest" && incoming.method === "GET") {
            response = json({
              ok: true,
              post: "JSON samples, sessions, Writer summary, or TSV",
              header: "x-daymeter-token",
            });
          } else if (path === "/api/ingest" && incoming.method === "POST") {
            response = await handleIngestPost(incoming.url, incoming.headers, incoming.body);
          } else if (path === "/api/agent") {
            response = await handleAgent(incoming.url, incoming.headers, incoming.body, incoming.method);
          } else {
            return next();
          }
          writeNodeResponse(res, response, await response.text());
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "server-error" }));
        }
      });
    },
  };
}
