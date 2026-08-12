import { analyzeName } from "../../../../lib/service.ts";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) return Response.json({ error: "invalid_request" }, { status: 400 });
  return Response.json(analyzeName(body.name));
}
