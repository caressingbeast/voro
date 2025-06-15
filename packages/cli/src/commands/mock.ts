import chalk from "chalk";
import { writeFileSync } from "fs";
import tsj from "ts-json-schema-generator";

import { generateMockData } from "../faker.js";

import type { JSONSchema, Options } from "../types";

export const mock = (opts: Options) => {
  if (!opts.name && !opts.type) {
    console.error(`${chalk.red("You must specify an interface/type name or schema name.")}`);
  }

  if (opts.name) {
    console.log("RUNNING A ZOD FILE", opts);
  }

  if (opts.type) {
    const schema = tsj.createGenerator({ path: opts.file, type: opts.type }).createSchema(opts.type);
    const typedSchema = schema.definitions?.[opts.type];

    if (typedSchema) {
      const data = generateMockData(typedSchema as JSONSchema, schema.definitions as JSONSchema);

      if (opts.out) {
        writeFileSync(opts.out, JSON.stringify(data), "utf-8");
      } else {
        console.log(data);
      }
    } else {
      console.error(`Error`);
    }
  }
}