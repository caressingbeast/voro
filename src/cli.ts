#!/usr/bin/env node
import { Command } from "commander";

import { mockCommand } from "./commands/mock.js";
import { devCommand } from "./commands/dev.js";

const program = new Command();

program
  .name("voro")
  .description("Generate mock APIs from TypeScript & Zod schemas.")
  .version("1.5.0");

program.addCommand(mockCommand);
program.addCommand(devCommand);

program.parse(process.argv);
