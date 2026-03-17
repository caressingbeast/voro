// Shared utility to validate and fix PropertySpec for required fields
export function validateAndFixPropertySpec(key: string, prop: PropertySpec): PropertySpec {
  // Only fix required fields
  if (prop.optional) return prop;
  const { type, metadata } = prop;
  if (type === "number") {
    // Ensure a valid range
    let range = metadata.range;
    if (typeof range !== "object" || range === null || typeof (range as any).min !== "number" || typeof (range as any).max !== "number") {
      range = { min: 1, max: 100 };
    }
    return { ...prop, metadata: { ...metadata, range } };
  }
  if (type === "string") {
    // No-op for now, but could add format fallback
    return prop;
  }
  if (type === "boolean") {
    return prop;
  }
  // For arrays, objects, etc., recurse if needed (not implemented here)
  return prop;
}
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import fg from "fast-glob";
import { ProgressBar } from "./progressBar.js";
import ts from "typescript";
import { TypeParser } from "./tsParser.js";
import { ZodParser } from "./zodParser.js";
import { getEndpointName } from "../commands/dev.js";
import type { PropertySpec } from "../types.js";

export type SchemaKind = "zod" | "ts";

export type SchemaBundle = {
  // The name of the schema/type (e.g. "User")
  name: string;
  // The canonical schema produced by TypeParser or ZodParser
  schema: Record<string, PropertySpec>;
  // A hint for where it came from
  kind: SchemaKind;
  // The source file where it was found
  filePath: string;
};

const parseZodFile = async (filePath: string): Promise<Record<string, Record<string, PropertySpec>>> => {
  const result: Record<string, Record<string, PropertySpec>> = {};
  const absPath = path.resolve(filePath);
  const fileUrl = pathToFileURL(absPath).href;

  const module = await import(`${fileUrl}?cacheBust=${Date.now()}`);
  const parser = new ZodParser(absPath);

  for (const exportName of Object.keys(module)) {
    const exported = module[exportName];
    // Only try to parse if it's a Zod schema (object, union, etc.)
    if (exported && typeof exported === "object" && exported._def && typeof exported._def === "object") {
      try {
        const schema = await parser.parse(exportName);
        result[exportName] = schema;
      } catch {
        // ignore exports that are not Zod schemas
      }
    }
  }

  return result;
};

const parseTsFile = async (filePath: string): Promise<Record<string, Record<string, PropertySpec>>> => {
  const absPath = path.resolve(filePath);
  const typeNames = getExportedTypeNames(absPath);

  const result: Record<string, Record<string, PropertySpec>> = {};
  if (typeNames.length === 0) return result;

  const parser = new TypeParser(absPath);
  for (const name of typeNames) {
    try {
      result[name] = parser.parse(name);
    } catch {
      // ignore unsupported types
    }
  }

  return result;
};

const getExportedTypeNames = (filePath: string): string[] => {
  const content = fs.readFileSync(filePath, "utf-8");
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  ts.forEachChild(source, (node) => {
    // Only include exported interfaces and type aliases (not variables, functions, etc.)
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
      const modifiers = ts.getCombinedModifierFlags(node);
      const isExported = Boolean(modifiers & ts.ModifierFlags.Export) ||
        (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

      if (isExported) {
        names.push(node.name.text);
      }
    }
  });

  return names;
};

export const loadSchemasFromFile = async (filePath: string): Promise<SchemaBundle[]> => {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) throw new Error(`File not found: ${filePath}`);

  const ext = path.extname(absPath).toLowerCase();
  const bundles: SchemaBundle[] = [];

  // Try Zod parsing (runtime import)
  let zodSchemas: Record<string, Record<string, PropertySpec>> = {};
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(ext)) {
    try {
      zodSchemas = await parseZodFile(absPath);
    } catch (err) {
      // ignore import errors
    }
  }

  // TS type parsing
  let tsSchemas: Record<string, Record<string, PropertySpec>> = {};
  if ([".ts", ".tsx"].includes(ext)) {
    try {
      tsSchemas = await parseTsFile(absPath);
    } catch {
      // ignore parsing errors
    }
  }

  // Deduplicate by endpoint name, prefer Zod, skip TS z.infer aliases
  const endpointMap: Map<string, SchemaBundle> = new Map();

  // Helper to detect z.infer aliases (very basic: type alias with 'z.infer')
  const isZodInferAlias = (name: string, filePath: string): boolean => {
    const content = fs.readFileSync(filePath, "utf-8");
    const regex = new RegExp(`export\\s+type\\s+${name}\\s*=\\s*z\\.infer`, "i");
    return regex.test(content);
  };

  // Add Zod schemas first
  for (const name of Object.keys(zodSchemas)) {
    const endpoint = getEndpointName(name);
    endpointMap.set(endpoint, { name, schema: zodSchemas[name], kind: "zod", filePath: absPath });
  }

  // Add TS schemas if not z.infer alias and endpoint not already present
  for (const name of Object.keys(tsSchemas)) {
    const endpoint = getEndpointName(name);
    if (!endpointMap.has(endpoint) && !isZodInferAlias(name, absPath)) {
      endpointMap.set(endpoint, { name, schema: tsSchemas[name], kind: "ts", filePath: absPath });
    }
  }

  return Array.from(endpointMap.values());
}

const SCHEMA_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const isSchemaFile = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  return SCHEMA_FILE_EXTENSIONS.has(ext);
};

const collectSchemaFiles = async (inputPath: string): Promise<string[]> => {
  // If the input is a glob pattern, resolve it immediately.
  const defaultIgnores = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/coverage/**",
    "**/.next/**",
    "**/out/**",
    "**/.turbo/**",
    "**/.cache/**",
    "**/.vercel/**",
    "**/.idea/**",
    "**/.vscode/**",
    "**/tmp/**",
    "**/temp/**",
    "**/logs/**",
    "**/*.log",
    "**/bower_components/**",
    "**/.yarn/**",
    "**/.pnp/**",
    "**/.expo/**",
    "**/.firebase/**",
    "**/.sass-cache/**",
    "**/jspm_packages/**",
    "**/.parcel-cache/**",
    "**/.eslintcache"
  ];
  if (fg.isDynamicPattern(inputPath)) {
    const matches = await fg(inputPath, {
      dot: true,
      absolute: true,
      onlyFiles: true,
      ignore: defaultIgnores,
    });
    return matches.filter(isSchemaFile);
  }

  const fullPath = path.resolve(inputPath);
  const stats = fs.statSync(fullPath);

  if (stats.isFile()) {
    return isSchemaFile(fullPath) ? [fullPath] : [];
  }

  // Directory: collect all files recursively (skip node_modules)
  const pattern = `${fullPath.replace(/\\/g, "/")}/**/*.{ts,tsx,js,mjs,cjs}`;
  return fg(pattern, {
    dot: true,
    absolute: true,
    onlyFiles: true,
    ignore: defaultIgnores,
  });
};

export const loadSchemas = async (inputPath: string): Promise<SchemaBundle[]> => {
  const results: SchemaBundle[] = [];
  const files = await collectSchemaFiles(inputPath);

  let progress: ProgressBar | null = null;
  if (files.length > 1) {
    progress = new ProgressBar(files.length, "Loading schemas");
  }

  for (const filePath of files) {
    try {
      const bundles = await loadSchemasFromFile(filePath);
      results.push(...bundles);
    } catch {
      // ignore non-schema files / parse errors
    }
    if (progress) progress.tick();
  }

  return results;
};
