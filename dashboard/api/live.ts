import { asNodeHandler, handleLiveGet, json } from "../src/lib/server";

export async function GET() {
  return handleLiveGet();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-daymeter-token, x-daymeter-secret, Authorization",
    },
  });
}

export default asNodeHandler(async (incoming) => {
  if (incoming.method === "GET") return handleLiveGet();
  return json({ ok: false, error: "method" }, 405);
});
