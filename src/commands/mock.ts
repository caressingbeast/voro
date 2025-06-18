import chalk from "chalk";
import { Command } from "commander";
import { writeFile } from "fs/promises";

import { TypeMocker } from "../utils/mock.js";
import { TypeParser } from "../utils/tsParser.js";
import { ZodParser } from "../utils/zodParser.js";

export const mockCommand = new Command("mock")
  .description("Generate mock data from TypeScript types or Zod schemas")
  .option("-f, --file <fileName>", "Input file path with types or schemas")
  .option("-t, --type <typeName>", "Name of TypeScript type")
  .option("-s, --schema <schemaName>", "Name of Zod schema")
  .option("-o, --output <fileName>", "Output JSON file (optional)")
  .action(async (options) => {
    if (!options.file) {
      console.error(chalk.bold.red("You must specify a file (-f)"));
      process.exit(1);
    }

    if (!options.schema && !options.type) {
      console.error(chalk.bold.red("You must specify a type or schema name (-t or -s)"));
      process.exit(1);
    }

    try {
      const name = options.schema ? options.schema : options.type;
      const Parser = options.schema ? ZodParser : TypeParser;
      const p = new Parser(options.file);
      const schema = await p.parse(name);
      console.log(schema);
      const mock = new TypeMocker(schema).mock();
      const mockData = JSON.stringify(mock, null, 2);

      if (options.output) {
        try {
          await writeFile(options.output, mockData, { encoding: 'utf-8' });
          console.log(chalk.bold.green(`✔ "${options.output}" has been successfully created!`));
        } catch (error) {
          console.error(chalk.bold.red(`✖ Failed to write file: ${error}`));
        }
      } else {
        console.log(mockData);
        console.log(chalk.bold.green(`✔ "${name}" has been successfully mocked!`));
      }
    } catch (error) {
      console.error(chalk.bold.red(`✖ Error generating mock data => ${error}`));
      process.exit(1);
    }
  });
