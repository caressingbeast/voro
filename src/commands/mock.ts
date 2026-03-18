import chalk from "chalk";
import { Command } from "commander";
import { writeFile } from "fs/promises";

import { TypeMocker } from "../utils/mock.js";
import { loadSchemasFromFile, type SchemaBundle } from "../utils/schemaLoader.js";

export type RunMockOptions = {
  file?: string;
  type?: string;
  schema?: string;
  output?: string;
  seed?: string;
};

export type RunMockResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

/**
 * Run the mock command logic. Returns exit code and output for CLI or tests.
 * Does not call process.exit or console; use the returned stdout/stderr.
 */
export async function runMock(options: RunMockOptions): Promise<RunMockResult> {
  if (!options.file) {
    return { exitCode: 1, stderr: chalk.bold.red("You must specify a file (-f)") };
  }

  if (!options.schema && !options.type) {
    return { exitCode: 1, stderr: chalk.bold.red("You must specify a type or schema name (-t or -s)") };
  }

  const name = options.schema || options.type!;
  const kind: SchemaBundle["kind"] = options.schema ? "zod" : "ts";

  try {
    const schemas = await loadSchemasFromFile(options.file);
    const schemaBundle = schemas.find((s) => s.name === name && s.kind === kind);

    if (!schemaBundle) {
      throw new Error(`${kind === "zod" ? "Schema" : "Type"} ${name} not found`);
    }

    const mock = new TypeMocker(schemaBundle.schema, options.seed, schemaBundle.fakerLocale).mock();
    const mockData = JSON.stringify(mock, null, 2);

    if (options.output) {
      try {
        await writeFile(options.output, mockData, { encoding: "utf-8" });
        return { exitCode: 0, stdout: chalk.bold.green(`✔ "${options.output}" has been successfully created!`) };
      } catch (error) {
        return { exitCode: 1, stderr: chalk.bold.red(`✖ Failed to write file: ${error}`) };
    }
    }

    return {
      exitCode: 0,
      stdout: mockData + "\n" + chalk.bold.green(`✔ "${name}" has been successfully mocked!`),
    };
  } catch (error) {
    return {
      exitCode: 1,
      stderr: chalk.bold.red(`✖ Error generating mock data => ${error}`),
    };
  }
}

export const mockCommand = new Command("mock")
  .description("Generate mock data from TypeScript types or Zod schemas")
  .option("-f, --file <fileName>", "Input file path with types or schemas")
  .option("-t, --type <typeName>", "Name of TypeScript type")
  .option("-s, --schema <schemaName>", "Name of Zod schema")
  .option("-o, --output <fileName>", "Output JSON file (optional)")
  .option("--seed <seed>", "Seed for reproducible mock data generation")
  .action(async (options) => {
    const result = await runMock(options);
    if (result.stderr) console.error(result.stderr);
    if (result.stdout) console.log(result.stdout);
    process.exit(result.exitCode);
  });
