import type { PropertySpec } from "../types.js";

// Shared utility to validate and fix PropertySpec for required fields
export function validateAndFixPropertySpec(key: string, prop: PropertySpec): PropertySpec {
  // Only fix required fields
  if (prop.optional) return prop;
  const { type, metadata } = prop;

  if (type === "number") {
    // Ensure a valid range
    let range = (metadata as any).range;
    if (
      typeof range !== "object" ||
      range === null ||
      typeof (range as any).min !== "number" ||
      typeof (range as any).max !== "number"
    ) {
      range = { min: 1, max: 100 };
    }
    return { ...prop, metadata: { ...metadata, range } };
  }

  if (type === "string" || type === "boolean") {
    // String/boolean currently don't need additional fixing.
    return prop;
  }

  // For arrays, objects, etc., recurse if needed (not implemented here)
  return prop;
}

// Helper to merge parser metadata, voro description metadata, and standard fields,
// then run validation/fixing in one place.
export function finalizePropertySpec(
  key: string,
  base: PropertySpec,
  extraMetadata: Record<string, any> = {},
): PropertySpec {
  const merged: PropertySpec = {
    ...base,
    metadata: {
      ...(base.metadata || {}),
      ...extraMetadata,
      fieldName: key,
    },
  };
  return validateAndFixPropertySpec(key, merged);
}

