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

type GeneratorOpts = {
  min?: number,
  max?: number,
  type?: string;
};
type GeneratorSpec = Record<string, (opts: GeneratorOpts) => boolean | number | string | (() => void)>;

export class TypeMocker {
  constructor(private schema: Record<string, PropertySpec>) { }

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

  private resolveArrayLength(input: unknown): number {
    if (typeof input === "number") return input;

    if (typeof input === "string") {
      const num = parseInt(input, 10);
      if (!isNaN(num)) return num;
    }

    return faker.number.int({ min: 1, max: 5 }); // fallback
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
        console.log(metadata.format, type);
        if (this.mockGenerators[metadata.format]) {
          return this.mockGenerators[metadata.format]({});
        }
      }
    }

    return undefined;
  }

  private getKeyFromName(name: string): string | null {
    if (/address/i.test(name)) return "address";
    if (/city/i.test(name)) return "city";
    if (/country/i.test(name)) return "country";
    if (/description/i.test(name)) return "paragraph";
    if (/email/i.test(name)) return "email";
    if (/id$/i.test(name)) return "uuid";
    if (/name/i.test(name)) return "name";
    if (/phone/i.test(name)) return "phone";
    if (/state/i.test(name)) return "state";
    if (/title/i.test(name)) return "title";
    if (/zip/i.test(name)) return "zip";
    if (/url/i.test(name)) return "url";
    return null;
  }

  private getDefaultMockValue(name: string, type: string): any {
    if (type === "string") {
      const key = this.getKeyFromName(name);

      if (key && this.mockGenerators[key]) {
        return this.mockGenerators[key]({});
      }
    }

    if (this.mockGenerators[type]) {
      return this.mockGenerators[type]({});
    }

    return undefined;
  }


  private mockProperty(prop: PropertySpec, name: string = ""): any {
    const { metadata, type } = prop;

    if (Array.isArray(type)) {
      if (type.length === 1) {
        // It's an array type (e.g. ["string"])
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
    if (typeof type === "object" && type !== null) {
      const result: Record<string, unknown> = {};
      for (const key in type) {
        const value = type[key as keyof typeof type];
        result[key] = this.mockProperty(value, key);
      }
      return result;
    }

    // Handle functions
    if (type === "function") {
      return () => { };
    }

    // Use metadata first
    const metaVal = this.mockFromMetadata(type, metadata);
    if (metaVal !== undefined) return metaVal;

    // Fallback to smart default
    return this.getDefaultMockValue(name, type);
  }
}
