import type { Faker } from "@faker-js/faker";

import type { PropertySpec, VoroMetadata } from "../types";
import { getFakerForLocale, resolveFakerLocaleKey } from "./fakerLocale.js";
import { primaryCountryForLocaleKey } from "./localePrimaryCountry.js";
import {
  getKeyFromName,
  resolveArrayLength,
  resolveUnionOrNullable,
  isValidMockValue,
  warnInvalidFakerData,
  getFallbackValue,
} from "./propertySpecUtils.js";

type GeneratorOpts = {
  min?: number;
  max?: number;
  type?: string;
};

type GeneratorSpec = Record<string, (opts: GeneratorOpts) => boolean | number | string | (() => void)>;

export const hashStringToNumber = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export class TypeMocker {
  private readonly fk: Faker;
  private readonly localeKey: ReturnType<typeof resolveFakerLocaleKey>;
  private readonly mockGenerators: GeneratorSpec;

  constructor(
    private schema: Record<string, PropertySpec>,
    private seed?: string | number,
    fakerLocale?: string
  ) {
    this.localeKey = fakerLocale?.trim()
      ? resolveFakerLocaleKey(fakerLocale)
      : "en_US";
    this.fk = getFakerForLocale(fakerLocale);
    if (this.seed !== undefined) {
      const seedNumber = typeof this.seed === "string" ? hashStringToNumber(this.seed) : this.seed;
      this.fk.seed(seedNumber);
    }
    const f = this.fk;
    this.mockGenerators = {
      address: () => f.location.streetAddress(),
      boolean: () => f.datatype.boolean(),
      city: () => f.location.city(),
      company: () => f.company.name(),
      country: () => primaryCountryForLocaleKey(this.localeKey) ?? f.location.country(),
      date: ({ type = "" }) => {
        switch (type) {
          case "future":
            return f.date.future().toISOString();
          case "recent":
            return f.date.recent().toISOString();
          default:
            return f.date.past().toISOString();
        }
      },
      description: () => f.lorem.paragraph(),
      email: () => f.internet.email(),
      function: () => () => {},
      image: () => f.image.url(),
      firstName: () => f.person.firstName(),
      lastName: () => f.person.lastName(),
      name: () => f.person.fullName(),
      number: ({ min = 1, max = 100 }) => f.number.int({ min, max }),
      paragraph: () => f.lorem.paragraph(),
      password: () => f.internet.password(),
      phone: () => f.phone.number(),
      state: () => f.location.state(),
      string: () => f.lorem.word(),
      url: () => f.internet.url(),
      username: () => f.internet.username(),
      uuid: () => f.string.uuid(),
      zip: () => f.location.zipCode(),
    };
  }

  mock() {
    const result: Record<string, any> = {};

    for (const [key, prop] of Object.entries(this.schema)) {
      if (prop.optional && Math.random() < 0.5) continue;
      result[key] = this.mockProperty(prop, key);
    }

    return result;
  }

  private mockFromMetadata(type: string, metadata: VoroMetadata, fieldName?: string): any {
    const f = this.fk;
    if (metadata.value !== undefined) return metadata.value;

    if (metadata.enum && Array.isArray(metadata.enum)) {
      return f.helpers.arrayElement(metadata.enum);
    }
    if (Array.isArray(type) && type.every((v) => typeof v !== "object")) {
      return f.helpers.arrayElement(type);
    }

    if (type === "string") {
      if (metadata.format === "uuid") return f.string.uuid();
      if (metadata.format === "iso.datetime") return f.date.past().toISOString();
      if (metadata.format === "iso.date") return f.date.past().toISOString().slice(0, 10);
      if (metadata.format === "email") return f.internet.email();
      if (metadata.format === "name") return f.person.fullName();
      if (metadata.format === "paragraph") return f.lorem.paragraph();
      if (metadata.format === "word") return f.lorem.word();
      const nameForHint = (metadata as any).fieldName ?? fieldName;
      const dateHint =
        (metadata as any).date ?? (getKeyFromName(nameForHint as string) === "date" ? "past" : undefined);
      if (dateHint === "future") return f.date.future().toISOString();
      if (dateHint === "recent") return f.date.recent().toISOString();
      if (dateHint === "past") return f.date.past().toISOString();
      const hasLengthConstraint = metadata.minLength !== undefined || metadata.maxLength !== undefined;
      if (hasLengthConstraint) {
        const minLength = metadata.minLength ? Number(metadata.minLength) : 1;
        const maxLength = metadata.maxLength ? Number(metadata.maxLength) : 16;
        if (!isNaN(minLength) && !isNaN(maxLength)) {
          const len = f.number.int({ min: minLength, max: maxLength });
          return f.string.alphanumeric({ length: len });
        }
      }
      const key = getKeyFromName(nameForHint as string);
      if (key === "date") return f.date.past().toISOString();
      if (key && this.mockGenerators[key]) {
        let value = this.mockGenerators[key]({});
        if (!isValidMockValue(value, type)) {
          warnInvalidFakerData(nameForHint as string, type, value);
          value = getFallbackValue(type);
        }
        return value;
      }
      return f.lorem.word();
    }

    if (type === "number") {
      let min = 1,
        max = 100;
      const range = metadata.range;
      if (
        typeof range === "object" &&
        range !== null &&
        !Array.isArray(range) &&
        "min" in range &&
        "max" in range
      ) {
        min = Number(range.min);
        max = Number(range.max);
      } else {
        if (metadata.min !== undefined) min = Number(metadata.min);
        if (metadata.max !== undefined) max = Number(metadata.max);
      }
      if (!isNaN(min) && !isNaN(max)) {
        return f.number.int({ min, max });
      }
      return f.number.int();
    }

    if (type === "boolean" && metadata.value !== undefined) {
      return Boolean(metadata.value);
    }
    if (type === "boolean") {
      return f.datatype.boolean();
    }

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
    const f = this.fk;

    if (metadata && metadata.nullable === "true") {
      if (Math.random() < 0.5) return null;
    }

    if (metadata && Array.isArray((metadata as any).enum)) {
      return f.helpers.arrayElement((metadata as any).enum as any[]);
    }

    if (Array.isArray(type)) {
      if (
        type.length > 1 &&
        type.every((t) => typeof t === "string" || typeof t === "number" || typeof t === "boolean")
      ) {
        return f.helpers.arrayElement(type as (string | number | boolean)[]);
      }
      if (type.length === 1) {
        let count = 1;
        if (metadata.length !== undefined) {
          count = Number(metadata.length);
        } else if (metadata["@voro.length"] !== undefined) {
          count = Number(metadata["@voro.length"]);
        } else if (metadata.minLength || metadata.maxLength) {
          const min = metadata.minLength ? Number(metadata.minLength) : 1;
          const max = metadata.maxLength ? Number(metadata.maxLength) : 5;
          count = f.number.int({ min, max });
        } else {
          count = resolveArrayLength(undefined, f);
        }
        return Array.from({ length: count }, () => {
          const propType: PropertySpec =
            typeof type[0] === "string"
              ? { type: type[0], optional: false, metadata: {} }
              : type[0];
          return this.mockProperty(propType, name);
        });
      }
      return resolveUnionOrNullable(type, name, metadata, (p, n) => this.mockProperty(p, n), f);
    }

    if (typeof type === "object" && type !== null) {
      const nestedLocale =
        typeof metadata.locale === "string" ? metadata.locale.trim() : "";
      if (nestedLocale) {
        return new TypeMocker(
          type as Record<string, PropertySpec>,
          this.seed,
          nestedLocale
        ).mock();
      }
      const result: Record<string, unknown> = {};
      for (const key in type) {
        const value = type[key as keyof typeof type];
        result[key] = this.mockProperty(value, key);
      }
      return result;
    }

    const metaVal = this.mockFromMetadata(type, metadata, name);
    if (metaVal !== undefined) return metaVal;

    if (type === "unknown") {
      // eslint-disable-next-line no-console
      console.warn(`[voro] Warning: mockProperty received unknown type for field '${name}'.`);
    }

    return this.getDefaultMockValue(name, type);
  }
}
