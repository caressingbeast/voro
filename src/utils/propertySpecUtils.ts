// Validate if a mock value is valid for a given type
export function isValidMockValue(value: any, type: string): boolean {
  if (value === undefined || value === null) return false;
  switch (type) {
    case "string": return typeof value === "string" && value.length > 0;
    case "number": return typeof value === "number" && !isNaN(value);
    case "boolean": return typeof value === "boolean";
    default: return true;
  }
}

import chalk from 'chalk';

// Warn if faker returns invalid data
export function warnInvalidFakerData(name: string, type: string, value: any) {
  // eslint-disable-next-line no-console
  console.warn(
    chalk.yellow.bold('[voro] Warning:') +
      ` Faker returned invalid data for property ` +
      chalk.yellow(`'${name}'`) +
      ` (type: ${type}):`,
    value,
    chalk.yellow('- using fallback value.')
  );
}

// Provide a fallback value for a given type
export function getFallbackValue(type: string): any {
  switch (type) {
    case "string": return "example";
    case "number": return 42;
    case "boolean": return true;
    default: return null;
  }
}
// Generate a mock value for a union or nullable type (shared for mock/dev)
export function resolveUnionOrNullable(
  type: any[],
  name: string,
  metadata: VoroMetadata,
  mockProperty: (prop: PropertySpec, name: string) => any
): any {
  // Handle union types that include 'null'
  const hasNull = type.includes("null");
  const nonNullTypes = type.filter((t) => t !== "null");
  if (hasNull && nonNullTypes.length > 0) {
    // 50% chance of null, otherwise pick from non-null types
    if (Math.random() < 0.5) return null;
    // If only one non-null type, treat as that type
    if (nonNullTypes.length === 1) {
      const t = nonNullTypes[0];
      if (typeof t === "string") {
        return mockProperty({ type: t, optional: false, metadata: {} }, name);
      } else if (typeof t === "object" && t !== null && "type" in t) {
        return mockProperty(t, name);
      }
    }
    // Otherwise, pick randomly from non-null types
    const t = faker.helpers.arrayElement(nonNullTypes);
    if (typeof t === "string") {
      return mockProperty({ type: t, optional: false, metadata: {} }, name);
    } else if (typeof t === "object" && t !== null && "type" in t) {
      return mockProperty(t, name);
    }
  }

  const allPropertySpecs = type.every(
    (t) => typeof t === "object" && t !== null && "type" in t
  );

  if (allPropertySpecs) {
    // Treat as a tuple
    return (type as PropertySpec[]).map((spec, idx) =>
      mockProperty(spec, `${name}[${idx}]`)
    );
  }

  // It's a union (no null)
  const t = faker.helpers.arrayElement(type as string[]);
  if (typeof t === "string") {
    return mockProperty({ type: t, optional: false, metadata: {} }, name);
  } else if (typeof t === "object" && t !== null && "type" in t) {
    return mockProperty(t, name);
  }
  return t;
}
// Shared utilities for property spec handling, type hints, and mock helpers
import type { PropertySpec, VoroMetadata } from "../types";
import { faker } from '@faker-js/faker';

export function getKeyFromName(name: string): string | null {
  if (/address/i.test(name)) return "address";
  if (/city/i.test(name)) return "city";
  if (/company/i.test(name)) return "company";
  if (/created/i.test(name)) return "date";
  if (/country/i.test(name)) return "country";
  if (/date/i.test(name)) return "date";
  if (/description/i.test(name)) return "paragraph";
  if (/email/i.test(name)) return "email";
  if (/id$/i.test(name)) return "uuid";
  if (/image|photo/i.test(name)) return "image";
  if (/name/i.test(name)) return "name";
  if (/password/i.test(name)) return "password";
  if (/phone/i.test(name)) return "phone";
  if (/state/i.test(name)) return "state";
  if (/title/i.test(name)) return "title";
  if (/updated/i.test(name)) return "date";
  if (/url/i.test(name)) return "url";
  if (/zip/i.test(name)) return "zip";
  return null;
}

export function resolveArrayLength(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    const num = parseInt(input, 10);
    if (!isNaN(num)) return num;
  }
  return faker.number.int({ min: 1, max: 5 }); // fallback
}
