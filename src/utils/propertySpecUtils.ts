// Shared utilities for property spec handling, type hints, and mock helpers
import type { PropertySpec, VoroMetadata } from "../types";
import { faker } from '@faker-js/faker';

export function getKeyFromName(name: string): string | null {
  if (/address/i.test(name)) return "address";
  if (/city/i.test(name)) return "city";
  if (/created/i.test(name)) return "date";
  if (/country/i.test(name)) return "country";
  if (/date/i.test(name)) return "date";
  if (/description/i.test(name)) return "paragraph";
  if (/email/i.test(name)) return "email";
  if (/id$/i.test(name)) return "uuid";
  if (/name/i.test(name)) return "name";
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
