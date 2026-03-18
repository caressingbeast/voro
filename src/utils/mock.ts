import { faker } from '@faker-js/faker';
import { z } from 'zod';

import type { PropertySpec, VoroMetadata } from '../types';
import { getKeyFromName, resolveArrayLength, resolveUnionOrNullable, isValidMockValue, warnInvalidFakerData, getFallbackValue } from './propertySpecUtils.js';

type GeneratorOpts = {
  min?: number,
  max?: number,
  type?: string;
};

type GeneratorSpec = Record<string, (opts: GeneratorOpts) => boolean | number | string | (() => void)>;

export const hashStringToNumber = (input: string): number => {
  // Simple deterministic hash (FNV-1a) to convert string seeds to a number.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export class TypeMocker {
  constructor(private schema: Record<string, PropertySpec>, private seed?: string | number) {
    if (this.seed !== undefined) {
      const seedNumber = typeof this.seed === "string" ? hashStringToNumber(this.seed) : this.seed;
      faker.seed(seedNumber);
    }
  }

  private mockGenerators: GeneratorSpec = {
    address: () => faker.location.streetAddress(),
    boolean: () => faker.datatype.boolean(),
    city: () => faker.location.city(),
    company: () => faker.company.name(),
    country: () => faker.location.country(),
    date: ({ type = "" }) => {
      switch (type) {
        case "future":
          return faker.date.future().toISOString();
        case "recent":
          return faker.date.recent().toISOString()
        default:
          return faker.date.past().toISOString();
      }
    },
    description: () => faker.lorem.paragraph(),
    email: () => faker.internet.email(),
    function: () => () => { },
    image: () => faker.image.url(),
    name: () => faker.person.fullName(),
    number: ({ min = 1, max = 100 }) => faker.number.int({ min, max }),
    paragraph: () => faker.lorem.paragraph(),
    password: () => faker.internet.password(),
    state: () => faker.location.state(),
    string: () => faker.lorem.word(),
    url: () => faker.internet.url(),
    username: () => faker.internet.username(),
    uuid: () => faker.string.uuid(),
    zip: () => faker.location.zipCode()
  };

  mock() {
    const result: Record<string, any> = {};

    for (const [key, prop] of Object.entries(this.schema)) {
      if (prop.optional && Math.random() < 0.5) continue;
      result[key] = this.mockProperty(prop, key);
    }

    return result;
  }


  private mockFromMetadata(type: string, metadata: VoroMetadata, fieldName?: string): any {
    // Always use explicit value if present
    if (metadata.value !== undefined) return metadata.value;

    // Handle enums (array of allowed values or metadata.enum)
    if (metadata.enum && Array.isArray(metadata.enum)) {
      return faker.helpers.arrayElement(metadata.enum);
    }
    if (Array.isArray(type) && type.every(v => typeof v !== 'object')) {
      return faker.helpers.arrayElement(type);
    }

    // Zod type/constraint-driven logic only
    if (type === "string") {
      // UUID
      if (metadata.format === "uuid") return faker.string.uuid();
      // ISO datetime (full ISO 8601)
      if (metadata.format === "iso.datetime") return faker.date.past().toISOString();
      // ISO date only (YYYY-MM-DD)
      if (metadata.format === "iso.date") return faker.date.past().toISOString().slice(0, 10);
      // Email
      if (metadata.format === "email") return faker.internet.email();
      // Name
      if (metadata.format === "name") return faker.person.fullName();
      // Paragraph
      if (metadata.format === "paragraph") return faker.lorem.paragraph();
      // Word
      if (metadata.format === "word") return faker.lorem.word();
      // @voro.date or field-name hint for date
      const nameForHint = (metadata as any).fieldName ?? fieldName;
      const dateHint = (metadata as any).date ?? (getKeyFromName(nameForHint as string) === "date" ? "past" : undefined);
      if (dateHint === "future") return faker.date.future().toISOString();
      if (dateHint === "recent") return faker.date.recent().toISOString();
      if (dateHint === "past") return faker.date.past().toISOString();
      // Use minLength/maxLength if present (fallback for generic strings)
      const minLength = metadata.minLength ? Number(metadata.minLength) : 1;
      const maxLength = metadata.maxLength ? Number(metadata.maxLength) : 16;
      if (!isNaN(minLength) && !isNaN(maxLength)) {
        const len = faker.number.int({ min: minLength, max: maxLength });
        return faker.string.alphanumeric({ length: len });
      }
      // Field name hints (e.g. createdAt -> date)
      const key = getKeyFromName(nameForHint as string);
      if (key === "date") return faker.date.past().toISOString();
      // Fallback to lorem word
      return faker.lorem.word();
    }

    if (type === "number") {
      // Prefer metadata.range, but fallback to min/max if present in metadata
      let min = 1, max = 100;
      const range = metadata.range;
      if (typeof range === "object" && range !== null && !Array.isArray(range) && "min" in range && "max" in range) {
        min = Number(range.min);
        max = Number(range.max);
      } else {
        if (metadata.min !== undefined) min = Number(metadata.min);
        if (metadata.max !== undefined) max = Number(metadata.max);
      }
      if (!isNaN(min) && !isNaN(max)) {
        return faker.number.int({ min, max });
      }
      return faker.number.int();
    }

    if (type === "boolean" && metadata.value !== undefined) {
      return Boolean(metadata.value);
    }
    if (type === "boolean") {
      return faker.datatype.boolean();
    }

    // If we reach here, we have no constraints to use. This is a fallback and should be rare.
    return undefined;
  }


  private getDefaultMockValue(name: string, type: string): any {
    let value: any;
    if (type === "string") {
      const key = getKeyFromName(name);
      if (key && this.mockGenerators[key]) {
        value = this.mockGenerators[key]({});
        if (!isValidMockValue(value, type)) {
          warnInvalidFakerData(name, type, value);
          value = getFallbackValue(type);
        }
        return value;
      }
    }

    if (this.mockGenerators[type]) {
      value = this.mockGenerators[type]({});
      if (!isValidMockValue(value, type)) {
        warnInvalidFakerData(name, type, value);
        value = getFallbackValue(type);
      }
      return value;
    }

    return getFallbackValue(type);
  }



  private mockProperty(prop: PropertySpec, name: string = ""): any {
    const { metadata, type } = prop;

    // Handle nullable fields: randomly return null (50% chance), otherwise generate value
    if (metadata && metadata.nullable === "true") {
      if (Math.random() < 0.5) return null;
    }

    // If enum metadata is present, always prefer it (works for both TS and Zod enums)
    if (metadata && Array.isArray((metadata as any).enum)) {
      return faker.helpers.arrayElement((metadata as any).enum as any[]);
    }

    if (Array.isArray(type)) {
      // Enum: array of primitives (e.g. ["active", "inactive", "pending"])
      if (type.length > 1 && type.every((t) => typeof t === "string" || typeof t === "number" || typeof t === "boolean")) {
        return faker.helpers.arrayElement(type as (string | number | boolean)[]);
      }
      if (type.length === 1) {
        // It's an array type (e.g. ["string"])
        let count = 1;
        // Prefer metadata.length, then @voro.length, then minLength/maxLength, then fallback
        if (metadata.length !== undefined) {
          count = Number(metadata.length);
        } else if (metadata["@voro.length"] !== undefined) {
          count = Number(metadata["@voro.length"]);
        } else if (metadata.minLength || metadata.maxLength) {
          const min = metadata.minLength ? Number(metadata.minLength) : 1;
          const max = metadata.maxLength ? Number(metadata.maxLength) : 5;
          count = faker.number.int({ min, max });
        } else {
          count = resolveArrayLength(undefined);
        }
        return Array.from({ length: count }, () => {
          const propType: PropertySpec =
            typeof type[0] === "string"
              ? { type: type[0], optional: false, metadata: {} }
              : type[0]; // if it's already PropertySpec
          return this.mockProperty(propType, name);
        });
      }
      // Use shared union/nullable resolver
      return resolveUnionOrNullable(type, name, metadata, (p, n) => this.mockProperty(p, n));
    }

    // Handle nested objects
    if (typeof type === "object" && type !== null) {
      const result: Record<string, unknown> = {};
      for (const key in type) {
        const value = type[key as keyof typeof type];
        result[key] = this.mockProperty(value, key);
      }
      return result;
    }

    // Use metadata first
    const metaVal = this.mockFromMetadata(type, metadata, name);
    if (metaVal !== undefined) return metaVal;

    // Defensive: warn only for truly unknown types.
    // Empty metadata is normal for enums, booleans, functions, etc.
    if (type === "unknown") {
      // eslint-disable-next-line no-console
      console.warn(`[voro] Warning: mockProperty received unknown type for field '${name}'.`);
    }

    return this.getDefaultMockValue(name, type);
  }

  }
