import { CORS, handleAgent } from "../src/lib/server";

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
