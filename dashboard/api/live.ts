import { handleLiveGet } from "../src/lib/server";

export async function GET() {
  return handleLiveGet();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-daymeter-token, Authorization",
    },
  });
}
