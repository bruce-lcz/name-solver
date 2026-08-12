import { ZodError } from "zod";
import { diagnoseName } from "../../../../lib/service.ts";

export async function POST(request: Request): Promise<Response> {
  try { return Response.json(diagnoseName((await request.json()).constraints)); }
  catch (error) { return Response.json({ error: "invalid_request", issues: error instanceof ZodError ? error.issues : undefined }, { status: 400 }); }
}
