import { faker } from "@faker-js/faker";

import { JSONSchema } from "./types";

export const generateMockData = (schema: JSONSchema, type: string) => {
  const output: Record<string, unknown> = {};

  const obj = schema?.definitions?.[type];

  if (obj?.properties && typeof obj.properties === "object") {
    for (const [name, schema] of Object.entries(obj.properties)) {
      if (schema && typeof schema === "object") {
        if (schema.type === "number") {
          output[name] = faker.number.int({ min: 0, max: 100 });
        }

        if (schema.type === "string") {
          if (name.includes("name")) {
            output[name] = faker.person.fullName();
          } else if (name.includes("email")) {
            output[name] = faker.internet.email();
          } else {
            output[name] = faker.word.sample();
          }
        }
      }
    }
  }

  return output;
};