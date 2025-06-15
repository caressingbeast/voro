import { z, ZodTypeAny } from "zod";
import { faker } from "@faker-js/faker";

import { JSONSchema } from "./types";

const nameBasedFakerMap: Record<string, () => unknown> = {
  id: () => faker.string.uuid(),
  uuid: () => faker.string.uuid(),
  name: () => faker.person.fullName(),
  email: () => faker.internet.email(),
  username: () => faker.internet.username(),
  password: () => faker.internet.password(),
  address: () => faker.location.streetAddress(),
  city: () => faker.location.city(),
  state: () => faker.location.state(),
  country: () => faker.location.country(),
  zip: () => faker.location.zipCode(),
  phone: () => faker.phone.number(),
  url: () => faker.internet.url(),
  avatar: () => faker.image.avatar(),
  title: () => faker.lorem.words(3),
  description: () => faker.lorem.sentence(),
  createdAt: () => faker.date.past().toISOString(),
  updatedAt: () => faker.date.recent().toISOString(),
};

const guessFakerByKey = (key: string): (() => unknown) | undefined => {
  const normalized = key.toLowerCase();

  // Exact match
  if (nameBasedFakerMap[normalized]) {
    return nameBasedFakerMap[normalized];
  }

  // Fuzzy match
  for (const [k, fn] of Object.entries(nameBasedFakerMap)) {
    if (normalized.includes(k)) return fn;
  }

  return undefined;
}

export const generateMockDataFromTS = (
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
    return generateMockDataFromTS(refSchema, definitions, propName);
  }

  // 2. Enums
  if (schema.enum && schema.enum.length > 0) {
    return faker.helpers.arrayElement(schema.enum);
  }

  // 3. Handle types
  switch (schema.type) {
    case "string":
      const guess = guessFakerByKey(propName);
      if (guess) return guess();
    case "number":
    case "integer":
      return faker.number.int({ min: 1, max: 100 });
    case "boolean":
      return faker.datatype.boolean();
    case "array":
      return [
        generateMockDataFromTS(schema.items ?? {}, definitions, propName),
      ];
    case "object":
      const result: Record<string, any> = {};
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        result[key] = generateMockDataFromTS(propSchema, definitions, key);
      }
      return result;
    default:
      return null;
  }
};

export const generateMockDataFromZod = (schema: ZodTypeAny, keyName: string = ""): any => {
  // Try name-based guess first
  if (keyName) {
    const guess = guessFakerByKey(keyName);
    if (guess) return guess();
  }

  if (schema instanceof z.ZodString) {
    for (const check of schema._def.checks) {
      if (check.kind === "uuid") return faker.string.uuid();
      if (check.kind === "email") return faker.internet.email();
      if (check.kind === "url") return faker.internet.url();
    }

    return faker.lorem.word();
  }

  if (schema instanceof z.ZodNumber) return faker.number.int({ min: 1, max: 100 });
  if (schema instanceof z.ZodBoolean) return faker.datatype.boolean();

  if (schema instanceof z.ZodEnum) {
    const values = schema._def.values;
    return faker.helpers.arrayElement(values);
  }

  if (schema instanceof z.ZodArray) {
    return [generateMockDataFromZod(schema._def.type)];
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const result: Record<string, any> = {};

    for (const key in shape) {
      result[key] = generateMockDataFromZod(shape[key], key);
    }

    return result;
  }

  return null; // default fallback
}