import { describe, expect, test } from "vitest";

import { TypeMocker } from "./mock";

function generateProperty(type: string[] | string, metadata = {}) {
  return { type: type, optional: false, metadata };
}

describe("TypeMocker", () => {
  describe("mock()", () => {
    describe("default values", () => {
      test("handles arrays", () => {
        const unionValues = ["active", "inactive", "pending"];
        const schema = {
          numbers: generateProperty(["number"]),
          tags: generateProperty(["string"]),
          union: generateProperty(unionValues)
        };

        const mocks = new TypeMocker(schema).mock();

        expect(Array.isArray(mocks.numbers)).toBe(true);
        expect(typeof mocks.numbers[0]).toEqual("number");
        expect(Array.isArray(mocks.tags)).toBe(true);
        expect(typeof mocks.tags[0]).toEqual("string");
        expect(typeof mocks.union).toEqual("string");
        expect(unionValues.includes(mocks.union)).toBe(true);
      });

      test("handles booleans", () => {
        const schema = {
          isActive: generateProperty("boolean")
        };

        const mocks = new TypeMocker(schema).mock();

        expect(typeof mocks.isActive).toBe("boolean");
      });

      test("handles numbers", () => {
        const schema = {
          id: generateProperty("number")
        };

        const mocks = new TypeMocker(schema).mock();

        expect(typeof mocks.id).toEqual("number");
        expect(mocks.id).toBeGreaterThan(0);
        expect(mocks.id).toBeLessThan(101);
      });

      test("handles objects", () => {
        const schema = {
          user: {
            type: {
              id: generateProperty("string")
            },
            optional: false,
            metadata: {}
          }
        };

        const mocks = new TypeMocker(schema).mock();

        expect(typeof mocks).toEqual("object");
        expect(typeof mocks.user.id).toEqual("string");
      });

      test("handles strings", () => {
        const str = generateProperty("string");
        const schema = {
          id: str,
          name: str,
          createdAt: str
        };

        const mocks = new TypeMocker(schema).mock();

        expect(typeof mocks.id).toEqual("string");
        expect(typeof mocks.name).toEqual("string");
        expect(typeof mocks.createdAt).toEqual("string");
        expect(new Date(mocks.createdAt).getTime()).toBeLessThan(new Date().getTime());
      });
    });
  });

  describe("metadata values", () => {
    test("handles explicit values", () => {
      const schema = {
        id: generateProperty("number", { value: 155 }),
        name: generateProperty("string", { value: "Brando" })
      };

      const mocks = new TypeMocker(schema).mock();

      expect(mocks.id).toEqual(155);
      expect(mocks.name).toEqual("Brando");
    });

    test("handles arrays", () => {
      const schema = {
        numbers: generateProperty(["number"], { length: 3 }),
        tags: generateProperty(["string"], { length: 5 })
      };

      const mocks = new TypeMocker(schema).mock();

      expect(mocks.numbers).toHaveLength(3);
      expect(mocks.numbers.every((t: any) => typeof t === "number")).toBe(true);
      expect(mocks.tags).toHaveLength(5);
      expect(mocks.tags.every((t: any) => typeof t === "string")).toBe(true);
    });

    test("handles numbers", () => {
      const schema = {
        id: generateProperty("number", { range: { min: 50, max: 60 } })
      };

      const mocks = new TypeMocker(schema).mock();

      expect(typeof mocks.id).toEqual("number");
      expect(mocks.id).toBeGreaterThan(49);
      expect(mocks.id).toBeLessThan(61);
    });

    test("handles strings", () => {
      const schema = {
        id: generateProperty("string", { format: "uuid" }),
        name: generateProperty("string", { format: "name" }),
        createdAt: generateProperty("string", { date: "future" })
      };

      const mocks = new TypeMocker(schema).mock();

      expect(typeof mocks.id).toEqual("string");
      expect(typeof mocks.name).toEqual("string");
      expect(typeof mocks.createdAt).toEqual("string");
      expect(new Date(mocks.createdAt).getTime()).toBeGreaterThan(new Date().getTime());
    });
  });
});