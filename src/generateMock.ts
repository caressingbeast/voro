import { z } from "zod";

import { TypeMocker } from "./utils/mock.js";
import { ZodParser } from "./utils/zodParser.js";

/**
 * Generate one mock object from a Zod object schema (e.g. `z.object({ ... })`). Useful in tests:
 *
 * @example
 * ```ts
 * import { generateMock } from "voro/generate-mock";
 * import { userSchema } from "./schema";
 *
 * const mockUser = generateMock(userSchema);
 * const sameEveryTime = generateMock(userSchema, "seed-123");
 * ```
 */
export function generateMock<T>(
  schema: z.ZodType<T>,
  seed?: string | number
): T {
  const parser = new ZodParser("");
  const propertySpec = parser.extractProperties(schema as any);
  const mocker = new TypeMocker(propertySpec, seed);
  return mocker.mock() as T;
}
