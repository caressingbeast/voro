import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { TypeParser } from "../src/utils/tsParser";
import { TypeMocker } from "../src/utils/mock";
import { ZodParser } from "../src/utils/zodParser";
import type { PropertySpec } from "../src/types";
import path from "path";

describe("PropertySpec extraction (Zod/TS)", () => {
  // --- Zod schemas ---
  const ZodBasic = z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(["active", "inactive"]),
    tags: z.array(z.string()),
    createdAt: z.string().datetime(),
    age: z.number().min(18).max(99),
    isAdmin: z.boolean(),
  });

  const ZodWithMeta = z.object({
    id: z.string().describe("@voro.format uuid"),
    name: z.string().describe("@voro.format name"),
    status: z.enum(["active", "inactive"]).describe("@voro.enum active inactive"),
    tags: z.array(z.string()).describe("@voro.length 3"),
    createdAt: z.string().describe("@voro.format iso.datetime"),
    age: z.number().describe("@voro.range 18 99"),
    isAdmin: z.boolean(),
  });

  // --- TS schemas ---
  const tsFile = path.resolve(__dirname, "examples", "tests.ts");

  it("extracts all constraints from Zod schema", async () => {
    const parser = new ZodParser("dummy");
    // @ts-ignore: access private
    const props: Record<string, PropertySpec> = parser.extractProperties(ZodBasic);
    expect(props.id.metadata.format).toBe("uuid");
    expect(props.status.type).toEqual(["active", "inactive"]);
    expect(props.tags.type).toEqual(["string"]);
    expect(props.createdAt.metadata.format).toBe("iso.datetime");
    expect(props.age.metadata.range).toEqual({ min: 18, max: 99 });
    expect(props.isAdmin.type).toBe("boolean");
  });

  it("extracts all constraints from Zod schema with @voro metadata", async () => {
    const parser = new ZodParser("dummy");
    // @ts-ignore: access private
    const props: Record<string, PropertySpec> = parser.extractProperties(ZodWithMeta);
    expect(props.id.metadata.format).toBe("uuid");
    expect(props.name.metadata.format).toBe("name");
    expect(props.status.type).toEqual(["active", "inactive"]);
    expect(props.tags.metadata.length).toBe("3");
    expect(props.createdAt.metadata.format).toBe("iso.datetime");
    expect(props.age.metadata.range).toEqual({ min: 18, max: 99 });
  });

  it("extracts all constraints from TS schema", () => {
    const parser = new TypeParser(tsFile);
    const { schema: props } = parser.parse("MetadataUser");
    expect(props.id.metadata.format).toBe("uuid");
    expect(props.status.type).toEqual(["active", "inactive", "pending"]);
    expect(props.tags.metadata.length).toBe("3");
    expect(props.createdAt.metadata.date).toBe("past");
    expect(props.age.metadata.range).toEqual({ min: 18, max: 30 });
  });

  it("nested array metadata: element format + array length", () => {
    const schema = z.object({
      words: z.array(z.string().describe("@voro.format word")).describe("@voro.length 3"),
    });
    const parser = new ZodParser("dummy");
    const props = parser.extractProperties(schema as any);
    const wordsType = props.words.type;
    expect(Array.isArray(wordsType)).toBe(true);
    expect(wordsType).toHaveLength(1);
    const element = (wordsType as PropertySpec[])[0];
    if (typeof element === "object" && element !== null && "metadata" in element) {
      expect((element as any).metadata?.format).toBe("word");
    }
    expect(Number(props.words.metadata.length)).toBe(3);
    const mock = new TypeMocker(props).mock();
    expect(mock.words).toHaveLength(3);
    mock.words.forEach((w: string) => expect(typeof w === "string" && w.length > 0).toBe(true));
  });
});
