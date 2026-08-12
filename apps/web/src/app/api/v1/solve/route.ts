import { ZodError } from "zod";
import { solveRequestSchema } from "../../../../../../../packages/domain/src/index.ts";
import { solveName, type SolveNameResponse } from "../../../../lib/service.ts";
import { allowRequest } from "../../../../lib/runtime.ts";

export interface SolveRequestBody {
  constraints: unknown;
  characters?: unknown[];
  limit?: number;
}

type SolveApiResponse =
  | { status: 200; body: SolveNameResponse }
  | { status: 400; body: { error: "invalid_request"; issues: ZodError["issues"] } };

/** Framework-neutral route core; a Next.js Route Handler can call this directly. */
export function postSolve(body: SolveRequestBody): SolveApiResponse {
  try {
    const request = solveRequestSchema.parse(body);
    const result = solveName(request.constraints, request.characters, request.limit);
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: 400, body: { error: "invalid_request", issues: error.issues } };
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const identity = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  if (!allowRequest(identity)) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const result = postSolve(await request.json());
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
}
