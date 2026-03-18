import { describe, expect, test, vi } from "vitest";

import {
  getFallbackValue,
  getKeyFromName,
  isValidMockValue,
  resolveArrayLength,
  resolveUnionOrNullable,
} from "../src/utils/propertySpecUtils";

describe("propertySpecUtils", () => {
  describe("isValidMockValue", () => {
    test("returns false for null and undefined", () => {
      expect(isValidMockValue(null, "string")).toBe(false);
      expect(isValidMockValue(undefined, "number")).toBe(false);
    });

    test("validates string (non-empty)", () => {
      expect(isValidMockValue("ok", "string")).toBe(true);
      expect(isValidMockValue("", "string")).toBe(false);
    });

    test("validates number (not NaN)", () => {
      expect(isValidMockValue(42, "number")).toBe(true);
      expect(isValidMockValue(NaN, "number")).toBe(false);
    });

    test("validates boolean", () => {
      expect(isValidMockValue(true, "boolean")).toBe(true);
      expect(isValidMockValue(false, "boolean")).toBe(true);
      expect(isValidMockValue(1, "boolean")).toBe(false);
    });

    test("returns true for other types (default)", () => {
      expect(isValidMockValue({}, "object")).toBe(true);
      expect(isValidMockValue([], "array")).toBe(true);
    });
  });

  describe("getFallbackValue", () => {
    test("returns fallbacks for string, number, boolean", () => {
      expect(getFallbackValue("string")).toBe("example");
      expect(getFallbackValue("number")).toBe(42);
      expect(getFallbackValue("boolean")).toBe(true);
    });

    test("returns null for unknown type", () => {
      expect(getFallbackValue("unknown")).toBe(null);
      expect(getFallbackValue("object")).toBe(null);
    });
  });

  describe("resolveArrayLength", () => {
    test("returns number as-is when valid", () => {
      expect(resolveArrayLength(3)).toBe(3);
      expect(resolveArrayLength(1)).toBe(1);
    });

    test("parses numeric string", () => {
      expect(resolveArrayLength("5")).toBe(5);
      expect(resolveArrayLength("10")).toBe(10);
    });

    test("returns 1–5 for invalid or missing input", () => {
      const n = resolveArrayLength(undefined);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
      const n2 = resolveArrayLength("x");
      expect(n2).toBeGreaterThanOrEqual(1);
      expect(n2).toBeLessThanOrEqual(5);
    });
  });

  describe("getKeyFromName", () => {
    test("maps known field names to generator keys", () => {
      expect(getKeyFromName("address")).toBe("address");
      expect(getKeyFromName("billingAddress")).toBe("address");
      expect(getKeyFromName("city")).toBe("city");
      expect(getKeyFromName("company")).toBe("company");
      expect(getKeyFromName("createdAt")).toBe("date");
      expect(getKeyFromName("updatedAt")).toBe("date");
      expect(getKeyFromName("date")).toBe("date");
      expect(getKeyFromName("description")).toBe("paragraph");
      expect(getKeyFromName("email")).toBe("email");
      expect(getKeyFromName("id")).toBe("uuid");
      expect(getKeyFromName("userId")).toBe("uuid");
      expect(getKeyFromName("name")).toBe("name");
      expect(getKeyFromName("firstName")).toBe("firstName");
      expect(getKeyFromName("firstname")).toBe("firstName");
      expect(getKeyFromName("lastName")).toBe("lastName");
      expect(getKeyFromName("surname")).toBe("lastName");
      expect(getKeyFromName("username")).toBe("username");
      expect(getKeyFromName("login")).toBe("username");
      expect(getKeyFromName("twitterHandle")).toBe("username");
      expect(getKeyFromName("password")).toBe("password");
      expect(getKeyFromName("state")).toBe("state");
      expect(getKeyFromName("url")).toBe("url");
      expect(getKeyFromName("zip")).toBe("zip");
    });

    test("returns null for unknown names", () => {
      expect(getKeyFromName("foo")).toBe(null);
      expect(getKeyFromName("x")).toBe(null);
    });
  });

  describe("resolveUnionOrNullable", () => {
    test("returns value from mockProperty for union of primitives", () => {
      const mockProperty = vi.fn((prop: { type: string }) => {
        if (prop.type === "string") return "a";
        if (prop.type === "number") return 1;
        return null;
      });
      const result = resolveUnionOrNullable(
        ["string", "number"],
        "field",
        {},
        mockProperty as any
      );
      expect(["a", 1]).toContain(result);
      expect(mockProperty).toHaveBeenCalled();
    });

    test("can return null when null is in union", () => {
      const mockProperty = vi.fn((prop: { type: string }) => (prop.type === "string" ? "x" : null));
      const results = new Set<string | null>();
      for (let i = 0; i < 30; i++) {
        results.add(
          resolveUnionOrNullable(["string", "null"], "field", {}, mockProperty as any)
        );
      }
      expect(results.has(null)).toBe(true);
      expect(results.has("x")).toBe(true);
    });

    test("returns array when type is array of PropertySpec-like objects", () => {
      const mockProperty = vi.fn((_prop: any, name: string) => name);
      const type = [
        { type: "string", optional: false, metadata: {} },
        { type: "number", optional: false, metadata: {} },
      ];
      const result = resolveUnionOrNullable(type as any, "field", {}, mockProperty as any);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockProperty).toHaveBeenCalledTimes(2);
    });
  });
});
