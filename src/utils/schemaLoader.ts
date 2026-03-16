import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import ts from "typescript";
import { TypeParser } from "./tsParser.js";
import { ZodParser } from "./zodParser.js";
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
    try {
      const schema = await parser.parse(exportName);
      result[exportName] = schema;
    } catch {
      // ignore exports that are not Zod schemas
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
  if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(ext)) {
    try {
      const schemas = await parseZodFile(absPath);
      for (const name of Object.keys(schemas)) {
        bundles.push({ name, schema: schemas[name], kind: "zod", filePath: absPath });
      }
    } catch (err) {
      // ignore import errors
    }
  }

  // TS type parsing
  if ([".ts", ".tsx"].includes(ext)) {
    try {
      const schemas = await parseTsFile(absPath);
      for (const name of Object.keys(schemas)) {
        bundles.push({ name, schema: schemas[name], kind: "ts", filePath: absPath });
      }
    } catch {
      // ignore parsing errors
    }
  }

  return bundles;
};

export const loadSchemas = async (inputPath: string): Promise<SchemaBundle[]> => {
  const fullPath = path.resolve(inputPath);
  const stats = fs.statSync(fullPath);
  const results: SchemaBundle[] = [];

  if (stats.isFile()) {
    return await loadSchemasFromFile(fullPath);
  }

  if (stats.isDirectory()) {
    const entries = await fs.promises.readdir(fullPath);
    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry);
      try {
        const bundles = await loadSchemasFromFile(entryPath);
        results.push(...bundles);
      } catch {
        // ignore non-schema files
      }
    }
  }

  return results;
};
