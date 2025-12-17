import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { schemas } from "./schemas";
import type { Canon, MatchEvent, PromptPack, TurnOutput } from "./types";

export function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  Object.values(schemas).forEach((schema) => ajv.addSchema(schema));
  return ajv;
}

const ajv = createAjv();

export const validateCanon = ajv.getSchema<Canon>(schemas.canonSchema.$id)!;
export const validateTurnOutput = ajv.getSchema<TurnOutput>(schemas.turnOutputSchema.$id)!;
export const validateMatchEvent = ajv.getSchema<MatchEvent>(schemas.matchEventSchema.$id)!;
export const validatePromptPack = ajv.getSchema<PromptPack>(schemas.promptPackSchema.$id)!;
