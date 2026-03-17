import { defineConfig } from "tsup";

export default defineConfig({
  entry: undefined,
  bundle: false,
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  splitting: false,
  target: "es2020",
});