import { Command } from "commander";

export const serveCommand = new Command("serve")
  .description("Serve mock data (in development)")
  .action(() => {
    console.log("Serve command not implemented yet");
  });
