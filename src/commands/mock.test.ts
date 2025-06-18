import path from "path";
import { execa } from "execa";
import { describe, expect, test } from "vitest";

const CLI_PATH = path.join(__dirname, "../cli.ts");
const FIXTURE_PATH = path.join(__dirname, "../examples/user.ts");
const SAVE_PATH = path.join(__dirname, "./testOutput.json");

describe("mock", () => {
  test("errors when file option is missing", async () => {
    const { exitCode, stderr } = await execa({ reject: false })`tsx ${CLI_PATH} mock  -f ${FIXTURE_PATH}`;
    expect(exitCode).not.toEqual(0);
    expect(stderr).toEqual("Missing required option: -t");
  });

  test("errors when type option is missing", async () => {
    const { exitCode, stderr } = await execa({ reject: false })`tsx ${CLI_PATH} mock  -t User`;
    expect(exitCode).not.toEqual(0);
    expect(stderr).toEqual("Missing required option: -f");
  });

  test("outputs mock data to console if no -o option", async () => {
    const { exitCode, stdout } = await execa`tsx ${CLI_PATH} mock -f ${FIXTURE_PATH} -t User`;
    expect(exitCode).toEqual(0);
    expect(stdout).toContain('"User" has been successfully mocked!');
  });

  test("outputs mock data to file if -o option", async () => {
    const { exitCode, stdout } = await execa`tsx ${CLI_PATH} mock -f ${FIXTURE_PATH} -t User -o ${SAVE_PATH}`;
    expect(exitCode).toEqual(0);
    expect(stdout).toContain(`"${SAVE_PATH}" has been successfully created!`);
  });
});