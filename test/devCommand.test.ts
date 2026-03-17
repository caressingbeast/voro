import { describe, expect, test } from "vitest";

import { createSchemaHandlers, parseLimit } from "../src/commands/dev";
import type { SchemaBundle } from "../src/utils/schemaLoader";

describe("dev command utilities", () => {
  describe("parseLimit", () => {
    test("returns 5 for undefined", () => {
      expect(parseLimit()).toBe(5);
    });

    test("returns 5 for invalid values", () => {
      expect(parseLimit("0")).toBe(5);
      expect(parseLimit("-1")).toBe(5);
      expect(parseLimit("abc")).toBe(5);
      expect(parseLimit("")).toBe(5);
    });

    test("returns parsed number for valid values", () => {
      expect(parseLimit("3")).toBe(3);
      expect(parseLimit("10")).toBe(10);
      expect(parseLimit("100")).toBe(100);
    });
  });

  describe("createSchemaHandlers", () => {
    test("creates handlers for schema bundles", async () => {
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

      const handlers = await createSchemaHandlers(bundles);

      expect(handlers.size).toBe(2);
      expect(handlers.has("users")).toBe(true);
      expect(handlers.has("posts")).toBe(true);

      const userHandler = handlers.get("users")!;
      expect(typeof userHandler.generator).toBe("function");

      const postHandler = handlers.get("posts")!;
      expect(typeof postHandler.generator).toBe("function");
    });

    test("handles schemas without id field", async () => {
      const bundles: SchemaBundle[] = [
        {
          name: "Tag",
          schema: { name: { type: "string", optional: false, metadata: {} } },
          kind: "ts",
          filePath: "/test/tag.ts"
        }
      ];

      const handlers = await createSchemaHandlers(bundles);
      const tagHandler = handlers.get("tags")!;
      expect(tagHandler.idKey).toBe(null);
    });

    test("pluralizes schema names correctly", async () => {
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

      const handlers = await createSchemaHandlers(bundles);
      expect(handlers.has("people")).toBe(true);
      expect(handlers.has("categories")).toBe(true);
    });

    test("should create handlers for all schemas", async () => {
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
      const handlers = await createSchemaHandlers(bundles, "seed");
      expect(handlers.size).toBe(2);
      expect(handlers.has("users")).toBe(true);
      expect(handlers.has("posts")).toBe(true);
      const userHandler = handlers.get("users")!;
      expect(typeof userHandler.generator).toBe("function");
      const postHandler = handlers.get("posts")!;
      expect(typeof postHandler.generator).toBe("function");
    });
  });
});