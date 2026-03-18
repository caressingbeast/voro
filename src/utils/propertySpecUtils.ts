import chalk from "chalk";
import { allFakers, type Faker } from "@faker-js/faker";

import type { PropertySpec, VoroMetadata } from "../types";

// --- Validation ---

export function isValidMockValue(value: any, type: string): boolean {
  if (value === undefined || value === null) return false;
  switch (type) {
    case "string":
      return typeof value === "string" && value.length > 0;
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return true;
  }
}

export function warnInvalidFakerData(name: string, type: string, value: any) {
  // eslint-disable-next-line no-console
  console.warn(
    chalk.yellow.bold("[voro] Warning:") +
      ` Faker returned invalid data for property ` +
      chalk.yellow(`'${name}'`) +
      ` (type: ${type}):`,
    value,
    chalk.yellow("- using fallback value.")
  );
}

// --- Fallbacks ---

export function getFallbackValue(type: string): any {
  switch (type) {
    case "string":
      return "example";
    case "number":
      return 42;
    case "boolean":
      return true;
    default:
      return null;
  }
}

// --- Union / array helpers ---

export function resolveUnionOrNullable(
  type: any[],
  name: string,
  metadata: VoroMetadata,
  mockProperty: (prop: PropertySpec, name: string) => any,
  fk: Faker = allFakers.en_US
): any {
  const hasNull = type.includes("null");
  const nonNullTypes = type.filter((t) => t !== "null");

  if (hasNull && nonNullTypes.length > 0) {
    if (Math.random() < 0.5) return null;
    if (nonNullTypes.length === 1) {
      const t = nonNullTypes[0];
      if (typeof t === "string") {
        return mockProperty({ type: t, optional: false, metadata: {} }, name);
      }
      if (typeof t === "object" && t !== null && "type" in t) {
        return mockProperty(t, name);
      }
    }
    const t = fk.helpers.arrayElement(nonNullTypes);
    if (typeof t === "string") {
      return mockProperty({ type: t, optional: false, metadata: {} }, name);
    }
    if (typeof t === "object" && t !== null && "type" in t) {
      return mockProperty(t, name);
    }
  }

  const allPropertySpecs = type.every(
    (t) => typeof t === "object" && t !== null && "type" in t
  );
  if (allPropertySpecs) {
    return (type as PropertySpec[]).map((spec, idx) =>
      mockProperty(spec, `${name}[${idx}]`)
    );
  }

  const t = fk.helpers.arrayElement(type as string[]);
  if (typeof t === "string") {
    return mockProperty({ type: t, optional: false, metadata: {} }, name);
  }
  if (typeof t === "object" && t !== null && "type" in t) {
    return mockProperty(t, name);
  }
  return t;
}

export function resolveArrayLength(input: unknown, fk: Faker = allFakers.en_US): number {
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    const num = parseInt(input, 10);
    if (!isNaN(num)) return num;
  }
  return fk.number.int({ min: 1, max: 5 });
}

// --- Field name → generator hint ---

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
  if (/first[_]?name|firstname/i.test(name)) return "firstName";
  if (/last[_]?name|lastname|surname/i.test(name)) return "lastName";
  if (
    /user[_]?name/i.test(name) ||
    /^login$/i.test(name) ||
    /handle$/i.test(name)
  ) {
    return "username";
  }
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
