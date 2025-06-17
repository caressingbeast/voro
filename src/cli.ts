#!/usr/bin/env node
import { Command } from "commander";

import { mockCommand } from "./commands/mock.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("voro")
  .description("Mock smarter, not harder.")
  .version("0.1.0");

program.addCommand(mockCommand);
program.addCommand(serveCommand);

program.parse(process.argv);
