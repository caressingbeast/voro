import chalk from "chalk";
import { writeFileSync } from "fs";
import tsj from "ts-json-schema-generator";
import { zodToJsonSchema } from "zod-to-json-schema";
import { pathToFileURL } from "url";

import { generateMockDataFromTS, generateMockDataFromZod } from "../faker.js";

import type { JSONSchema, Options } from "../types";

export const mock = async (opts: Options) => {
  if (!opts.name && !opts.type) {
    console.error(`${chalk.red("You must specify an interface/type name or schema name.")}`);
  }

  if (opts.name) {
    const fileUrl = pathToFileURL(opts.file).href;
    const mod = await import(fileUrl);
    const schema = mod[opts.name];
    const generated = generateMockDataFromZod(schema);
    console.log(generated);
  }

  if (opts.type) {
    const schema = tsj.createGenerator({ path: opts.file, type: opts.type }).createSchema(opts.type);
    const typedSchema = schema.definitions?.[opts.type];

    if (typedSchema) {
      const data = generateMockDataFromTS(typedSchema as JSONSchema, schema.definitions as JSONSchema);

      if (opts.out) {
        writeFileSync(opts.out, JSON.stringify(data), "utf-8");
        console.log()
      } else {
        console.log(data);
      }
    } else {
      console.error(`Error`);
    }
  }
}