import { describe, expect, test } from "vitest";

import { createSchemaHandlers, parseCount } from "../src/commands/dev";
import type { SchemaBundle } from "../src/utils/schemaLoader";

describe("dev command utilities", () => {
  describe("parseCount", () => {
    test("returns 5 for undefined", () => {
      expect(parseCount()).toBe(5);
    });

    test("returns 5 for invalid values", () => {
      expect(parseCount("0")).toBe(5);
      expect(parseCount("-1")).toBe(5);
      expect(parseCount("abc")).toBe(5);
      expect(parseCount("")).toBe(5);
    });

    test("returns parsed number for valid values", () => {
      expect(parseCount("3")).toBe(3);
      expect(parseCount("10")).toBe(10);
      expect(parseCount("100")).toBe(100);
    });
  });

  describe("createSchemaHandlers", () => {
    test("creates handlers for schema bundles", () => {
      const bundles: SchemaBundle[] = [
        {
          name: "User",
          schema: { 
            id: { type: "string", optional: false, metadata: {} }, 
            name: { type: "string", optional: false, metadata: {} } 
          },
          kind: "ts",
          filePath: "/test/user.ts"
        },
        {
          name: "Post",
          schema: { 
            id: { type: "number", optional: false, metadata: {} }, 
            title: { type: "string", optional: false, metadata: {} } 
          },
          kind: "zod",
          filePath: "/test/post.ts"
        }
      ];

      const handlers = createSchemaHandlers(bundles);

      expect(handlers.size).toBe(2);
      expect(handlers.has("users")).toBe(true);
      expect(handlers.has("posts")).toBe(true);

      const userHandler = handlers.get("users")!;
      expect(userHandler.schemaName).toBe("User");
      expect(userHandler.idKey).toBe("id");
      expect(typeof userHandler.generator).toBe("function");

      const postHandler = handlers.get("posts")!;
      expect(postHandler.schemaName).toBe("Post");
      expect(postHandler.idKey).toBe("id");
    });

    test("handles schemas without id field", () => {
      const bundles: SchemaBundle[] = [
        {
          name: "Tag",
          schema: { name: { type: "string", optional: false, metadata: {} } },
          kind: "ts",
          filePath: "/test/tag.ts"
        }
      ];

      const handlers = createSchemaHandlers(bundles);
      const tagHandler = handlers.get("tags")!;
      expect(tagHandler.idKey).toBe(null);
    });

    test("pluralizes schema names correctly", () => {
      const bundles: SchemaBundle[] = [
        {
          name: "Person",
          schema: { id: { type: "string", optional: false, metadata: {} } },
          kind: "ts",
          filePath: "/test/person.ts"
        },
        {
          name: "Category",
          schema: { id: { type: "string", optional: false, metadata: {} } },
          kind: "ts",
          filePath: "/test/category.ts"
        }
      ];

      const handlers = createSchemaHandlers(bundles);
      expect(handlers.has("people")).toBe(true);
      expect(handlers.has("categories")).toBe(true);
    });
  });
});