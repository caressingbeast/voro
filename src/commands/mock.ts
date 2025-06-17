import { Command } from "commander";
import { writeFile } from "fs/promises";

import { TypeMocker } from "../utils/mock.js";
import { TypeParser } from "../utils/tsParser.js";

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
      const mockData = new TypeMocker(schema).mock();
      if (options.output) {
        try {
          await writeFile(options.output, JSON.stringify(mockData, null, 2), { encoding: 'utf-8' });
          console.log(`Data written to ${options.output}`);
        } catch (error) {
          console.error(`Failed to write file: ${error}`);
        }
      } else {
        console.log(JSON.stringify(mockData, null, 2));
      }
    } catch (err) {
      console.error("Error parsing file:", err);
      process.exit(1);
    }
  });
