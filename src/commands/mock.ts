import { Command } from "commander";
import { writeFile } from "fs/promises";

import { TypeMocker } from "../utils/mock.js";
import { TypeParser } from "../utils/tsParser.js";
import chalk from "chalk";

export const mockCommand = new Command("mock")
  .description("Generate mock data from TypeScript types or Zod schemas")
  .option("-f, --file <fileName>", "Input file path with types or schemas")
  .option("-t, --type <typeName>", "Name of TypeScript type")
  .option("-s, --schema <schemaName>", "Name of Zod schema")
  .option("-o, --output <fileName>", "Output JSON file (optional)")
  .action(async (options) => {
    if (!options.file) {
      console.error("Please specify a TypeScript file with -f");
      process.exit(1);
    }

    try {
      const parser = new TypeParser(options.file);
      const schema = parser.parse(options.type);
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
        console.log(chalk.bold.green(`✔ "${options.type}" has been succesfully mocked!`));
      }
    } catch (error) {
      console.error(chalk.bold.red(`✖ Error parsing file: ${error}`));
      process.exit(1);
    }
  });
