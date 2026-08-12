import { explanationFacts } from "../../../../lib/service.ts";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("result" in body)) return Response.json({ error: "invalid_request" }, { status: 400 });
  return Response.json(explanationFacts((body as { result: Parameters<typeof explanationFacts>[0] }).result));
}
