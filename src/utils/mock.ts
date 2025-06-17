import { faker } from '@faker-js/faker';

import type { VoroMetadata } from '../types';

type PropertySpec = {
  type:
  | string
  | string[]
  | Record<string, PropertySpec>
  | { arrayOf: PropertySpec };
  optional: boolean;
  metadata: Record<string, any>;
};

export class TypeMocker {
  constructor(private schema: Record<string, PropertySpec>) { }

  mock() {
    const result: Record<string, any> = {};

    for (const [key, prop] of Object.entries(this.schema)) {
      if (prop.optional && Math.random() < 0.5) continue;
      result[key] = this.mockProperty(prop, key);
    }

    return result;
  }

  private resolveArrayLength(input: unknown): number {
    if (typeof input === "number") return input;

    if (typeof input === "string") {
      const num = parseInt(input, 10);
      if (!isNaN(num)) return num;
    }

    return faker.number.int({ min: 1, max: 5 }); // fallback
  }

  private mockFromMetadata(type: string, metadata: VoroMetadata): any {
    if (metadata.value) return metadata.value;

    if (type === "string") {
      if (metadata.format === "name") return faker.person.fullName();
      if (metadata.format === "email") return faker.internet.email();
      if (metadata.format === "uuid") return faker.string.uuid();
      if (metadata.format === "paragraph") return faker.lorem.paragraph();
      if (metadata.format === "address") return faker.location.streetAddress();
      if (metadata.format === "city") return faker.location.city();
      if (metadata.format === "state") return faker.location.state();
      if (metadata.format === "postalCode") return faker.location.zipCode();
      if (metadata.format === "country") return faker.location.country();
      if (metadata.date === "past") return faker.date.past().toISOString();
      if (metadata.date === "future") return faker.date.future().toISOString();
      if (metadata.date === "recent") return faker.date.recent().toISOString();
    }

    if (type === 'number') {
      const range = metadata.range;
      if (range && typeof range === "object" && "min" in range && "max" in range) {
        return faker.number.int({ min: range.min, max: range.max });
      }
    }

    return undefined;
  }

  private genericFallback(type: string): any {
    switch (type) {
      case 'string':
        return faker.lorem.word();
      case 'number':
        return faker.number.int();
      case 'boolean':
        return faker.datatype.boolean();
      default:
        return null;
    }
  }

  private getDefaultMockValue(name: string, type: string): any {
    if (type === 'string') {
      if (/id$/i.test(name)) return faker.string.uuid();
      if (/email/i.test(name)) return faker.internet.email();
      if (/name/i.test(name)) return faker.person.fullName();
      if (/title/i.test(name)) return faker.lorem.words(3);
      if (/description/i.test(name)) return faker.lorem.paragraph();
      if (/url/i.test(name)) return faker.internet.url();
      if (/phone/i.test(name)) return faker.phone.number();
      if (/address/i.test(name)) return faker.location.streetAddress();
      if (/city/i.test(name)) return faker.location.city();
      if (/state/i.test(name)) return faker.location.state();
      if (/zip/i.test(name)) return faker.location.zipCode();
      if (/country/i.test(name)) return faker.location.country();
      return faker.lorem.word(); // fallback string
    }

    if (type === 'number') {
      if (/age|count|total|amount|quantity|score/i.test(name)) {
        return faker.number.int({ min: 1, max: 100 });
      }
      return faker.number.float({ min: 0, max: 1000 });
    }

    if (type === 'boolean') {
      return faker.datatype.boolean();
    }

    if (type === 'function') {
      return () => { };
    }

    return null;
  }


  private mockProperty(prop: PropertySpec, name: string = ""): any {
    const { type, metadata } = prop;

    if (Array.isArray(type)) {
      if (type.length === 1) {
        // It's an array type
        const count = this.resolveArrayLength(metadata.length);
        return Array.from({ length: count }, () =>
          this.mockProperty({ type: type[0], optional: false, metadata: {} }, name)
        );
      } else {
        // It's a union
        return faker.helpers.arrayElement(type);
      }
    }

    // Handle nested objects
    if (typeof type === 'object' && type !== null) {
      const result: Record<string, unknown> = {};
      for (const key in type) {
        const value = type[key as keyof typeof type];
        result[key] = this.mockProperty(value, key);
      }
      return result;
    }

    // Handle functions
    if (type === 'function') {
      return () => { };
    }

    // 🧠 Use metadata first
    const metaVal = this.mockFromMetadata(type, metadata);
    if (metaVal !== undefined) return metaVal;

    // 🤖 Fallback to smart default
    const defaultVal = this.getDefaultMockValue(name, type);
    if (defaultVal !== null) return defaultVal;

    // 🫣 Absolute fallback
    return this.genericFallback(type);
  }
}
