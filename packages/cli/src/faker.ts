import { faker } from "@faker-js/faker";

import { JSONSchema } from "./types";

const mockStringByKey = (key: string): string => {
  const str = key.toLowerCase();
  if (str.includes("id")) return faker.string.uuid();
  if (str.includes("email")) return faker.internet.email();
  if (str.includes("name")) return faker.person.fullName();
  if (str.includes("username")) return faker.internet.username();
  if (str.includes("url")) return faker.internet.url();
  if (str.includes("phone")) return faker.phone.number();
  if (str.includes("address")) return faker.location.streetAddress();
  if (str.includes("city")) return faker.location.city();
  if (str.includes("zip")) return faker.location.zipCode();
  if (str.includes("state")) return faker.location.state();
  if (str.includes("country")) return faker.location.country();
  if (str.includes("description")) return faker.lorem.sentence();
  if (str.includes("date")) return faker.date.recent().toISOString();
  return faker.lorem.word();
}

export const generateMockData = (
  schema: JSONSchema,
  definitions: Record<string, JSONSchema> = {},
  propName = ""
): any => {
  // 1. Handle $ref
  if (schema.$ref) {
    const refName = schema.$ref.replace("#/definitions/", "");
    const refSchema = definitions[refName];
    if (!refSchema) {
      throw new Error(`Missing definition for $ref: ${schema.$ref}`);
    }
    return generateMockData(refSchema, definitions, propName);
  }

  // 2. Enums
  if (schema.enum && schema.enum.length > 0) {
    return faker.helpers.arrayElement(schema.enum);
  }

  // 3. Handle types
  switch (schema.type) {
    case "string":
      return mockStringByKey(propName);
    case "number":
    case "integer":
      return faker.number.int({ min: 1, max: 100 });
    case "boolean":
      return faker.datatype.boolean();
    case "array":
      return [
        generateMockData(schema.items ?? {}, definitions, propName),
      ];
    case "object":
      const result: Record<string, any> = {};
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        result[key] = generateMockData(propSchema, definitions, key);
      }
      return result;
    default:
      return null;
  }
};