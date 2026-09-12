import { CORS, asNodeHandler, handleIngestPost, json } from "../src/lib/server";

export async function GET() {
  return json({
    ok: true,
    post: "JSON samples, phone sessions, Writer summary, or TSV",
    header: "x-daymeter-token or ?k=",
  });
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
    return json({
      ok: true,
      post: "JSON samples, phone sessions, Writer summary, or TSV",
      header: "x-daymeter-token or ?k=",
    });
  }
  if (incoming.method === "POST") {
    return handleIngestPost(incoming.url, incoming.headers, incoming.body);
  }
  return json({ ok: false, error: "method" }, 405);
});
