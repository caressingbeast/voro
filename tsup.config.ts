import { defineConfig } from "tsup";

export default defineConfig({
  bundle: false,
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  splitting: false,
  target: "es2020",
});