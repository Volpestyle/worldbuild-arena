import canonSchema from "../schemas/canon.schema.json";
import jsonPatchSchema from "../schemas/json-patch.schema.json";
import matchEventSchema from "../schemas/match-event.schema.json";
import promptPackSchema from "../schemas/prompt-pack.schema.json";
import turnOutputSchema from "../schemas/turn-output.schema.json";

export const schemas = {
  canonSchema,
  jsonPatchSchema,
  matchEventSchema,
  promptPackSchema,
  turnOutputSchema
} as const;
