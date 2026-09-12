import { CORS, handleIngestPost, json } from "../src/lib/server";

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
