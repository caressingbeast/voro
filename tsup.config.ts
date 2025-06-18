import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts", "!./src/examples/*", "!./ src/**/ *.test.ts"],
  bundle: false,
  clean: true,
  sourcemap: true,
  target: "node16"
});