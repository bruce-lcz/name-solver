import { elements, elementSchools, strokeSystems } from "../../../../../../../../packages/domain/src/index.ts";
import { datasetVersion } from "../../../../../lib/catalog.ts";

export function GET(): Response {
  return Response.json({ datasetVersion, strokeSystems, elementSchools, elements, styles: ["modern", "gentle", "classic", "neutral"] });
}
