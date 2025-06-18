import path from "path";
import { describe, expect, test } from "vitest";

import { ZodParser } from "./zodParser";

import { PropertySpec } from "../types";

describe("ZodParser", () => {
  const typesDir = path.join(__dirname, "../examples");
  const testFile = path.join(typesDir, "tests.ts");

  describe("parse()", () => {
    test("throws when the file is not found", async () => {
      const parser = new ZodParser(path.join(typesDir, "notFound.ts"));
      await expect(parser.parse("BasicUserSchema")).rejects.toThrowError("notFound.ts not found");
    });

    test("throws when the type is not found", async () => {
      const parser = new ZodParser(testFile);
      await expect(parser.parse("NotFoundUserSchema")).rejects.toThrowError(`Schema "NotFoundUserSchema" not found`);
    });

    test("parses a basic type", async () => {
      const parser = new ZodParser(testFile);
      const mocks = await parser.parse("BasicUserSchema");

      expect(mocks.id.type).toEqual("string");
      expect(mocks.age.type).toEqual("number");
      expect(mocks.isAdmin.type).toEqual("boolean");
      expect(mocks.name.type).toEqual("string");
      expect(mocks.status.type).toEqual(["active", "inactive", "pending"]);
      expect(mocks.tags.type).toEqual(["string"]);
    });

    test("parses metadata", async () => {
      const parser = new ZodParser(testFile);
      const mocks = await parser.parse("MetadataUserSchema");

      expect(mocks.id.metadata.format).toEqual("uuid");
      expect(mocks.age.metadata.range).toEqual({ min: 18, max: 30 });
      expect(mocks.name.metadata.format).toEqual("name");
      expect(mocks.tags.metadata.length).toEqual("3");
      expect(mocks.createdAt.metadata.date).toEqual("past");
    });

    test("parses nested types", async () => {
      const parser = new ZodParser(testFile);
      const mocks = await parser.parse("NestedUserSchema");

      const address = mocks.address.type as Record<string, PropertySpec>;
      expect(typeof address).toEqual("object");
      expect(typeof address.address1.type).toEqual("string");
      expect(typeof address.city.type).toEqual("string");
      expect(typeof address.state.type).toEqual("string");
      expect(typeof address.zip.type).toEqual("string");
      expect(typeof address.country.type).toEqual("string");
    });
  });
});