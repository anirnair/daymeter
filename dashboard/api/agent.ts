import { CORS, asNodeHandler, handleAgent, json } from "../src/lib/server";

export async function GET(request: Request) {
  return handleAgent(request.url, request.headers, "", "GET");
}

export async function POST(request: Request) {
  const body = await request.text();
  return handleAgent(request.url, request.headers, body, "POST");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export default asNodeHandler(async (incoming) => {
  if (incoming.method === "GET" || incoming.method === "POST") {
    return handleAgent(incoming.url, incoming.headers, incoming.body, incoming.method);
  }
  return json({ ok: false, error: "method" }, 405);
});
