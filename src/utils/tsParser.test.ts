import path from "path";
import { describe, expect, test } from "vitest";

import { TypeParser } from "./tsParser";

describe("TypeParser", () => {
  const typesDir = path.join(__dirname, "../examples");
  const testFile = path.join(typesDir, "tests.ts");

  describe("parse()", () => {
    test("throws when the file is not found", () => {
      const parser = new TypeParser(path.join(typesDir, "notFound.ts"));
      expect(() => parser.parse("BasicUser")).toThrowError("notFound.ts not found");
    });

    test("throws when the type is not found", () => {
      const parser = new TypeParser(testFile);
      expect(() => parser.parse("NotFoundUser")).toThrowError("Type NotFoundUser not found");
    });

    test("parses a basic type", () => {
      const parser = new TypeParser(testFile);
      const mocks = parser.parse("BasicUser");

      expect(mocks.id.type).toEqual("string");
      expect(mocks.age.type).toEqual("number");
      expect(mocks.isAdmin.type).toEqual("boolean");
      expect(mocks.name.type).toEqual("string");
      expect(mocks.status.type).toEqual(["active", "inactive", "pending"]);
      expect(mocks.tags.type).toEqual(["string"]);
    });

    test("parses metadata", () => {
      const parser = new TypeParser(testFile);
      const mocks = parser.parse("MetadataUser");

      expect(mocks.id.metadata.format).toEqual("uuid");
      expect(mocks.age.metadata.range).toEqual({ min: 18, max: 30 });
      expect(mocks.name.metadata.format).toEqual("name");
      expect(mocks.tags.metadata.length).toEqual("3");
      expect(mocks.createdAt.metadata.date).toEqual("past");
    });

    test("parses nested types", () => {
      const parser = new TypeParser(testFile);
      const mocks = parser.parse("NestedUser");

      const address = mocks.address.type;
      expect(typeof address).toEqual("object");
      expect(typeof address.address1.type).toEqual("string");
      expect(typeof address.city.type).toEqual("string");
      expect(typeof address.state.type).toEqual("string");
      expect(typeof address.zip.type).toEqual("string");
      expect(typeof address.country.type).toEqual("string");
    });
  });
});