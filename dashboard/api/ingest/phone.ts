import { CORS, asNodeHandler, handlePhoneIngest } from "../src/lib/server";

export async function GET(request: Request) {
  return handlePhoneIngest(request.url, request.headers, "", "GET");
}

export async function POST(request: Request) {
  const body = await request.text();
  return handlePhoneIngest(request.url, request.headers, body, "POST");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export default asNodeHandler(async (incoming) => {
  return handlePhoneIngest(incoming.url, incoming.headers, incoming.body, incoming.method);
});
