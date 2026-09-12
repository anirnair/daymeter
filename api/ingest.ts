import { CORS, asNodeHandler, handleIngestPost, ingestHello, json } from "../dashboard/src/lib/server";

export async function GET() {
  return ingestHello();
}

export async function POST(request: Request) {
  const body = await request.text();
  return handleIngestPost(request.url, request.headers, body);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export default asNodeHandler(async (incoming) => {
  if (incoming.method === "GET") {
    return ingestHello();
  }
  if (incoming.method === "POST") {
    return handleIngestPost(incoming.url, incoming.headers, incoming.body);
  }
  return json({ ok: false, error: "method" }, 405);
});
