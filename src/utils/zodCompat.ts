import { z } from "zod";

// Zod v3/v4 compatible helpers for inspecting schema defs.

export const getZodDef = (schema: any) => schema?.def || schema?._def || {};

/** Get description string from a schema (Zod v3/v4). Used for @voro metadata in .describe(). */
export const getZodDescription = (schema: any): string | undefined => {
  if (!schema) return undefined;
  const d = typeof schema.description === "string" ? schema.description : undefined;
  if (d) return d;
  const def = getZodDef(schema);
  return typeof def?.description === "string" ? def.description : undefined;
};

export const getZodTypeName = (schema: any): string => {
  const def = getZodDef(schema);
  if (def?.type) return def.type;
  if (def?.typeName) return def.typeName;
  return "unknown";
};

export const getZodStringFormat = (schema: any): string | undefined => {
  const def = getZodDef(schema);
  if (def && typeof def.format === "string") {
    // Zod v4 string_format helpers (uuid, email, datetime, date, time, duration)
    return def.format;
  }

  for (const check of def?.checks || []) {
    if (check.kind === "uuid" || check.constructor?.name === "ZodUUID") return "uuid";
    if (check.kind === "email" || check.constructor?.name === "ZodEmail") return "email";
    if (
      check.kind === "datetime" ||
      check.kind === "date" ||
      check.constructor?.name === "ZodISODateTime"
    )
      return "datetime";
    if (check.constructor?.name === "ZodISODate") return "date";
    if (check.constructor?.name === "ZodISOTime") return "time";
    if (check.constructor?.name === "ZodISODuration") return "duration";
  }

  return undefined;
};

export const getZodStringLengthMeta = (schema: any): { minLength?: number; maxLength?: number } => {
  const def = getZodDef(schema);
  const meta: { minLength?: number; maxLength?: number } = {};
  for (const check of def?.checks || []) {
    if (typeof check.minLength === "number") meta.minLength = check.minLength;
    if (typeof check.maxLength === "number") meta.maxLength = check.maxLength;
    if (check.kind === "min") meta.minLength = check.value;
    if (check.kind === "max") meta.maxLength = check.value;
  }
  return meta;
};

export const getZodNumberRange = (
  schema: any,
): { min?: number; max?: number } | undefined => {
  const def = getZodDef(schema);
  let range: { min?: number; max?: number } = {};

  for (const check of def?.checks || []) {
    // Zod v3: { kind: "min"|"max", value: number }
    if (check.kind === "min") {
      range = { ...range, min: check.value };
      continue;
    }
    if (check.kind === "max") {
      range = { ...range, max: check.value };
      continue;
    }

    // Zod v4: check instances with hidden `_zod.def`
    const v4 = (check as any)?._zod?.def;
    if (v4?.check === "greater_than" && typeof v4.value === "number") {
      range = { ...range, min: v4.value };
      continue;
    }
    if (v4?.check === "less_than" && typeof v4.value === "number") {
      range = { ...range, max: v4.value };
      continue;
    }
  }

  if (range.min === undefined && range.max === undefined) return undefined;
  return range;
};

export const getZodEnumValues = (schema: any): string[] | undefined => {
  const def = getZodDef(schema);
  const typeName = getZodTypeName(schema);

  if (
    typeName === "ZodEnum" ||
    typeName === "enum" ||
    (def && (def.typeName === "ZodEnum" || def.type === "enum"))
  ) {
    const values =
      def?.values ||
      (Array.isArray(def?.options) ? def.options : undefined) ||
      (Array.isArray(def?.values) ? def.values : undefined) ||
      (def?.entries && typeof def.entries === "object" ? Object.keys(def.entries) : undefined) ||
      [];
    return values;
  }

  // Literal unions (e.g. z.union([z.literal("a"), z.literal("b")]))
  if (typeName === "ZodUnion" && Array.isArray(def?.options)) {
    const values: any[] = [];
    for (const option of def.options) {
      const optDef = getZodDef(option);
      if (optDef?.typeName === "ZodLiteral") {
        values.push(optDef.value);
      }
    }
    if (values.length > 0) return values;
  }

  return undefined;
};

export const getZodArrayElementSchema = (schema: any): any | undefined => {
  const def = getZodDef(schema) || {};
  // Zod v4: def.type is "array" (string), element is def.element
  const d = def as any;
  if (d.element) return d.element;
  if (d.innerType) return d.innerType;
  if (d.items) return d.items;
  if (d.item) return d.item;
  if ((schema as any).element) return (schema as any).element;
  // Zod v3: def.type is the element schema (object), not a string
  if (d.type && typeof d.type === "object") return d.type;
  return undefined;
};

export const isZodObjectLike = (schema: any): boolean => {
  const def = getZodDef(schema);
  return (
    !!def &&
    (def.type === "object" || def.typeName === "ZodObject") &&
    (typeof def.shape === "object" || typeof def.shape === "function")
  );
};

