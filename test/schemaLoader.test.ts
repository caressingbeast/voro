import path from "path";
import { describe, expect, test } from "vitest";

import { loadSchemas, loadSchemasFromFile } from "../src/utils/schemaLoader";

describe("schemaLoader", () => {
  const examplesDir = path.join(__dirname, "./examples");
  const schemaFile = path.join(examplesDir, "schema.ts");
  const userFile = path.join(examplesDir, "user.ts");

  describe("loadSchemasFromFile()", () => {
    test("throws when file does not exist", async () => {
      await expect(loadSchemasFromFile("nonexistent.ts")).rejects.toThrow("File not found");
    });

    test("loads Zod schemas from schema.ts", async () => {
      const bundles = await loadSchemasFromFile(schemaFile);

      expect(bundles).toHaveLength(2);
      expect(bundles.map(b => b.name)).toEqual(expect.arrayContaining(["User", "Message"]));
      expect(bundles.every(b => b.kind === "zod")).toBe(true);
      expect(bundles.every(b => b.filePath === path.resolve(schemaFile))).toBe(true);
      expect(bundles.every(b => typeof b.schema === "object")).toBe(true);
    });

    test("loads TypeScript types from user.ts", async () => {
      const bundles = await loadSchemasFromFile(userFile);

      expect(bundles).toHaveLength(2);
      expect(bundles.map(b => b.name)).toEqual(expect.arrayContaining(["User", "Message"]));
      expect(bundles.every(b => b.kind === "ts")).toBe(true);
      expect(bundles.every(b => b.filePath === path.resolve(userFile))).toBe(true);
      expect(bundles.every(b => typeof b.schema === "object")).toBe(true);
    });
  });

  describe("loadSchemas()", () => {
    test("loads all schemas from directory", async () => {
      const bundles = await loadSchemas(examplesDir);

      expect(bundles.length).toBeGreaterThanOrEqual(4); // At least 2 from each file
      const names = bundles.map(b => b.name);
      expect(names).toEqual(expect.arrayContaining(["User", "Message"]));
      const kinds = bundles.map(b => b.kind);
      expect(kinds).toEqual(expect.arrayContaining(["zod", "ts"]));
    });

    test("loads schemas from single file", async () => {
      const bundles = await loadSchemas(schemaFile);

      expect(bundles).toHaveLength(2);
      expect(bundles.map(b => b.name)).toEqual(expect.arrayContaining(["User", "Message"]));
      expect(bundles.every(b => b.kind === "zod")).toBe(true);
    });
  });
});