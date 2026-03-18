import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateMock } from "../src/generateMock";

describe("generateMock", () => {
  const userSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(["active", "inactive"]),
    age: z.number(),
  });

  it("returns one mock object matching the schema shape", () => {
    const mock = generateMock(userSchema);
    expect(mock).toHaveProperty("id");
    expect(mock).toHaveProperty("name");
    expect(mock).toHaveProperty("status");
    expect(mock).toHaveProperty("age");
    expect(typeof mock.name).toBe("string");
    expect(typeof mock.age).toBe("number");
    expect(["active", "inactive"]).toContain(mock.status);
  });

  it("with seed returns deterministic result", () => {
    const a = generateMock(userSchema, "seed-1");
    const b = generateMock(userSchema, "seed-1");
    expect(a).toEqual(b);
  });
});
