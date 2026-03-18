import path from "path";
import { describe, expect, test } from "vitest";

import { runMock } from "../src/commands/mock";

const FIXTURE_PATH = path.resolve(__dirname, "./examples/user.ts");
const INVALID_PATH = path.resolve(__dirname, "./examples/invalid.ts");
const SAVE_PATH = path.resolve(__dirname, "./testOutput.json");

describe("mock", () => {
  test("errors when file option is missing", async () => {
    const result = await runMock({ type: "User" });
    expect(result.exitCode).not.toEqual(0);
    expect(result.stderr).toEqual("You must specify a file (-f)");
  });

  test("errors when type option is missing", async () => {
    const result = await runMock({ file: FIXTURE_PATH });
    expect(result.exitCode).not.toEqual(0);
    expect(result.stderr).toEqual("You must specify a type or schema name (-t or -s)");
  });

  test("passes error up for invalid file", async () => {
    const result = await runMock({ file: INVALID_PATH, type: "User" });
    expect(result.exitCode).not.toEqual(0);
    expect(result.stderr).toContain("Error generating mock data => Error: File not found:");
    expect(result.stderr).toContain("invalid.ts");
  });

  test("passes error up for invalid type", async () => {
    const result = await runMock({ file: FIXTURE_PATH, type: "InvalidUser" });
    expect(result.exitCode).not.toEqual(0);
    expect(result.stderr).toContain("Error generating mock data => Error: Type InvalidUser");
  });

  test("passes error up for invalid schema", async () => {
    const result = await runMock({ file: FIXTURE_PATH, schema: "InvalidUser" });
    expect(result.exitCode).not.toEqual(0);
    expect(result.stderr).toContain("Error generating mock data => Error: Schema InvalidUser");
  });

  test("outputs mock data to console if no -o option", async () => {
    const result = await runMock({ file: FIXTURE_PATH, type: "User" });
    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toContain('"User" has been successfully mocked!');
    expect(result.stdout).toBeDefined();
    expect(result.stdout!.trim().startsWith("{")).toBe(true);
  });

  test("outputs mock data to file if -o option", async () => {
    const result = await runMock({ file: FIXTURE_PATH, type: "User", output: SAVE_PATH });
    expect(result.exitCode).toEqual(0);
    expect(result.stdout).toContain(`"${SAVE_PATH}" has been successfully created!`);
  });
});
