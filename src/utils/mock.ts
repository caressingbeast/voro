import { faker } from '@faker-js/faker';
import { z } from 'zod';

import type { PropertySpec, VoroMetadata } from '../types';
import { getKeyFromName, resolveArrayLength } from './propertySpecUtils.js';

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
    name: () => faker.person.fullName(),
    number: ({ min = 1, max = 100 }) => faker.number.int({ min, max }),
    paragraph: () => faker.lorem.paragraph(),
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


  private mockFromMetadata(type: string, metadata: VoroMetadata): any {
    // Return an explicit value
    if (metadata.value) return metadata.value;

    // Check in generator map
    if (type === "number") {
      if (typeof metadata.range === "object") {
        if (this.mockGenerators[type]) {
          return this.mockGenerators[type]({ min: metadata.range.min, max: metadata.range.max });
        }
      }
    }

    if (type === "string") {
      if (typeof metadata.date === "string") {
        if (this.mockGenerators["date"]) {
          return this.mockGenerators["date"]({ type: metadata.date });
        }
      }

      if (typeof metadata.format === "string") {
        if (this.mockGenerators[metadata.format]) {
          return this.mockGenerators[metadata.format]({});
        }
      }
    }

    return undefined;
  }


  private getDefaultMockValue(name: string, type: string): any {
    let value: any;
    if (type === "string") {
      const key = getKeyFromName(name);
      if (key && this.mockGenerators[key]) {
        value = this.mockGenerators[key]({});
        if (!this.isValidMockValue(value, type)) {
          this.warnInvalidFakerData(name, type, value);
          value = this.getFallbackValue(type);
        }
        return value;
      }
    }

    if (this.mockGenerators[type]) {
      value = this.mockGenerators[type]({});
      if (!this.isValidMockValue(value, type)) {
        this.warnInvalidFakerData(name, type, value);
        value = this.getFallbackValue(type);
      }
      return value;
    }

    return this.getFallbackValue(type);
  }

  private isValidMockValue(value: any, type: string): boolean {
    if (value === undefined || value === null) return false;
    switch (type) {
      case "string": return typeof value === "string" && value.length > 0;
      case "number": return typeof value === "number" && !isNaN(value);
      case "boolean": return typeof value === "boolean";
      default: return true;
    }
  }

  private warnInvalidFakerData(name: string, type: string, value: any) {
    // eslint-disable-next-line no-console
    console.warn(
      `[voro:mock] Warning: Faker returned invalid data for property '[33m${name}[0m' (type: ${type}):`,
      value,
      "- using fallback value."
    );
  }

  private getFallbackValue(type: string): any {
    switch (type) {
      case "string": return "example";
      case "number": return 42;
      case "boolean": return true;
      default: return null;
    }
  }


  private mockProperty(prop: PropertySpec, name: string = ""): any {
    const { metadata, type } = prop;

    if (Array.isArray(type)) {
      if (type.length === 1) {
        // It's an array type (e.g. ["string"])
        const count = resolveArrayLength(metadata.length);
        return Array.from({ length: count }, () => {
          const propType: PropertySpec =
            typeof type[0] === "string"
              ? { type: type[0], optional: false, metadata: {} }
              : type[0]; // if it's already PropertySpec
          return this.mockProperty(propType, name);
        });
      }

      const allPropertySpecs = type.every(
        (t) => typeof t === "object" && t !== null && "type" in t
      );

      if (allPropertySpecs) {
        // Treat as a tuple
        return (type as PropertySpec[]).map((spec, idx) =>
          this.mockProperty(spec, `${name}[${idx}]`)
        );
      }

      // It's a union
      return faker.helpers.arrayElement(type as string[]);
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
    const metaVal = this.mockFromMetadata(type, metadata);
    if (metaVal !== undefined) return metaVal;

    return this.getDefaultMockValue(name, type);
  }

  }
