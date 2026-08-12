import { findCharacter } from "../../../../../lib/catalog.ts";

export function GET(_: Request, context: { params: Promise<{ char: string }> }): Promise<Response> {
  return context.params.then(({ char }) => {
    const character = findCharacter(char);
    return character ? Response.json(character) : Response.json({ error: "not_found" }, { status: 404 });
  });
}
