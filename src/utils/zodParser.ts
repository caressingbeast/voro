import { finalizePropertySpec } from "./propertySpecCore.js";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { z, ZodObject, ZodTypeAny } from "zod";
import type { PropertySpec, VoroMetadata } from "../types";
import {
  getZodArrayElementSchema,
  getZodDef,
  getZodDescription,
  getZodEnumValues,
  getZodNumberRange,
  getZodStringFormat,
  getZodStringLengthMeta,
  getZodTypeName,
  isZodObjectLike,
} from "./zodCompat.js";

export class ZodParser {
  private sawRefinement = false;

  constructor(private filePath: string) {}

  async parse(schemaName: string): Promise<Record<string, PropertySpec>> {
    const absPath = path.resolve(this.filePath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`${this.filePath} not found`);
    }

    const fileUrl = pathToFileURL(absPath).href;
    const moduleUrl = `${fileUrl}?cacheBust=${Date.now()}`;
    let moduleExports: any;
    try {
      moduleExports = await import(moduleUrl);
    } catch (err) {
      throw new Error(`Could not import file: ${err}`);
    }

    let schema = moduleExports[schemaName];
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found in module ${this.filePath}`);
    }

    // For our purposes (mock generation) refinements are not needed, so unwrap them.
    schema = this.unwrapRefinements(schema);

    if (this.sawRefinement) {
      // eslint-disable-next-line no-console
      console.warn(
        `[voro] Warning: schema "${schemaName}" in ${this.filePath} uses refinements (refine/superRefine/transform/etc.). ` +
          "Generated mocks may not satisfy those runtime constraints.",
      );
    }

    if (!this.isZodObject(schema)) {
      throw new Error(`Schema ${schemaName} is not valid Zod schema`);
    }

    return this.extractProperties(schema);
  }

  // Note: kept public-ish semantics for tests (they access it via ts-ignore)
  extractProperties(schema: ZodObject<any>): Record<string, PropertySpec> {
    const result: Record<string, PropertySpec> = {};
    const def = getZodDef(schema);
    let shape = def?.shape;

    // Zod v4 often stores `def.shape` as a function returning the shape object.
    if (typeof shape === "function") {
      shape = shape();
    }

    // Support both function-and-object shape definitions across Zod versions
    if (!shape) {
      if (typeof (schema as any).shape === "function") {
        shape = (schema as any).shape();
      } else if (typeof (schema as any).shape === "object") {
        shape = (schema as any).shape;
      } else if (schema && (schema as any)._def && typeof (schema as any)._def.shape === "function") {
        shape = (schema as any)._def.shape();
      }
    }

    if (!shape || typeof shape !== "object") {
      return result;
    }

    for (const key in shape) {
      const field: ZodTypeAny = shape[key];
      const raw = this.parseField(field);
      const propMeta = this.extractVoroMetadata(getZodDescription(field));

      result[key] = finalizePropertySpec(key, raw, propMeta);
    }

    return result;
  }

  private unwrapRefinements(schema: any): any {
    const def = getZodDef(schema);
    const typeName = this.getTypeName(schema);

    if (typeName === "ZodEffects") {
      this.sawRefinement = true;
      return this.unwrapRefinements(def.schema);
    }

    if (typeName === "ZodPipeline") {
      this.sawRefinement = true;
      return this.unwrapRefinements(def.in);
    }

    return schema;
  }

  private getTypeName(schema: any): string {
    return getZodTypeName(schema);
  }

  private isZodStringTypeName(name: string): boolean {
    return (
      name === "ZodString" ||
      name === "string" ||
      name === (z as any).ZodFirstPartyTypeKind?.ZodString
    );
  }

  private parseConvenienceString(baseTypeName: string, optional: boolean): PropertySpec | null {
    const formatMap: Record<string, string> = {
      ZodUUID: "uuid",
      ZodUuid: "uuid",
      ZodEmail: "email",
      email: "email",
      ZodISODateTime: "iso.datetime",
      "iso.datetime": "iso.datetime",
      ZodISODate: "iso.date",
      "iso.date": "iso.date",
      ZodISOTime: "iso.time",
      "iso.time": "iso.time",
      ZodISODuration: "iso.duration",
      "iso.duration": "iso.duration",
    };
    const format = formatMap[baseTypeName];
    if (!format) return null;
    return { type: "string", optional, metadata: { format } };
  }

  private parseObjectField(baseType: any, optional: boolean, metadata: Record<string, any>): PropertySpec {
    const shape = this.extractProperties(baseType as ZodObject<any>);
    return { type: shape, optional, metadata };
  }

  private parseEnumField(values: string[], optional: boolean): PropertySpec {
    return { type: values, optional, metadata: { enum: values } };
  }

  private parseStringField(baseType: any, optional: boolean): PropertySpec {
    const meta: Record<string, any> = {};
    const format = getZodStringFormat(baseType);
    if (format === "uuid") meta.format = "uuid";
    if (format === "email") meta.format = "email";
    if (format === "datetime") meta.format = "iso.datetime";
    if (format === "date") meta.format = "iso.date";
    if (format === "time") meta.format = "iso.time";
    if (format === "duration") meta.format = "iso.duration";
    const lengthMeta = getZodStringLengthMeta(baseType);
    if (lengthMeta.minLength !== undefined) meta.minLength = lengthMeta.minLength;
    if (lengthMeta.maxLength !== undefined) meta.maxLength = lengthMeta.maxLength;
    return { type: "string", optional, metadata: meta };
  }

  private parseNumberField(baseType: any, optional: boolean, metadata: Record<string, any>): PropertySpec {
    const range = getZodNumberRange(baseType);
    if (range) metadata.range = { ...(metadata.range || {}), ...range };
    if (!metadata.range) metadata.range = { min: 1, max: 100 };
    return { type: "number", optional, metadata };
  }

  private parseBooleanField(optional: boolean, metadata: Record<string, any>): PropertySpec {
    return { type: "boolean", optional, metadata };
  }

  private parseFunctionField(optional: boolean, metadata: Record<string, any>): PropertySpec {
    return { type: "function", optional, metadata };
  }

  private parseArrayField(baseType: any, optional: boolean): PropertySpec {
    const def = getZodDef(baseType);
    let arrMeta: Record<string, any> = {};
    let elementType: string | PropertySpec = "string";
    const elementSchema = getZodArrayElementSchema(baseType);

    if (elementSchema) {
      const parsed = this.parseField(elementSchema as ZodTypeAny);
      const elementMeta = this.extractVoroMetadata(getZodDescription(elementSchema));
      const meaningfulMetaKeys = (obj: Record<string, any>) =>
        Object.keys(obj || {}).filter(k => k !== "fieldName" && k !== "warning");
      const hasElementMeta = meaningfulMetaKeys(elementMeta).length > 0 ||
        meaningfulMetaKeys(parsed.metadata).length > 0;
      if (hasElementMeta) {
        const fullSpec = finalizePropertySpec("", parsed, elementMeta);
        if (fullSpec.type === "unknown") fullSpec.type = "string";
        if (Array.isArray(fullSpec.type)) {
          fullSpec.type = fullSpec.type.flat() as PropertySpec["type"];
        }
        elementType = fullSpec;
      } else {
        const t = parsed.type;
        elementType = (
          t === "unknown" ? "string" : Array.isArray(t) ? t.flat() : t
        ) as string | PropertySpec;
      }
      for (const check of def?.checks || []) {
        const c = check as any;
        if (c.kind === "min") arrMeta.minLength = c.value;
        if (c.kind === "max") arrMeta.maxLength = c.value;
        if (c.kind === "length") arrMeta.length = c.value;
      }
    }
    arrMeta = { ...arrMeta, ...this.extractVoroMetadata(getZodDescription(baseType)) };
    return {
      type: [elementType] as PropertySpec["type"],
      optional,
      metadata: arrMeta,
    };
  }

  private parseField(schema: ZodTypeAny): PropertySpec {
    const unwrapped = this.unwrapRefinements(schema);
    let baseType = unwrapped;
    let optional = false;
    const metadata: Record<string, any> = {};

    const unwrappedTypeName = this.getTypeName(unwrapped);
    const unwrappedDef = getZodDef(unwrapped);

    // Zod v3: ZodOptional / ZodDefault; Zod v4: def.type "optional" / "default"
    if (
      unwrappedTypeName === "ZodDefault" ||
      unwrappedTypeName === "ZodOptional" ||
      unwrappedTypeName === "optional" ||
      unwrappedTypeName === "default"
    ) {
      optional = unwrappedTypeName !== "default" ? true : optional;
      if (unwrappedTypeName === "default") {
        baseType = unwrappedDef?.innerType ?? unwrappedDef?.schema ?? baseType;
      } else {
        baseType = unwrappedDef?.innerType ?? baseType;
      }
    }

    const nullableTypeName = this.getTypeName(baseType);
    if (nullableTypeName === "ZodNullable" || nullableTypeName === "nullable") {
      const nullableDef = getZodDef(baseType);
      const inner = nullableDef?.innerType ?? (baseType as any)._def?.innerType;
      const innerParsed = this.parseField(inner as unknown as ZodTypeAny);
      return {
        ...innerParsed,
        optional,
        metadata: { ...innerParsed.metadata, nullable: "true" },
      };
    }

    const baseTypeName = this.getTypeName(baseType);
    const def = getZodDef(baseType);

    const convenience = this.parseConvenienceString(baseTypeName, optional);
    if (convenience) return convenience;

    if (baseTypeName === "ZodObject" || baseTypeName === "object") {
      return this.parseObjectField(baseType, optional, metadata);
    }

    const enumValues = getZodEnumValues(baseType);
    if (enumValues) return this.parseEnumField(enumValues, optional);

    if (this.isZodStringTypeName(baseTypeName)) return this.parseStringField(baseType, optional);
    if (
      baseTypeName === "ZodNumber" ||
      baseTypeName === "number" ||
      baseTypeName === (z as any).ZodFirstPartyTypeKind?.ZodNumber
    ) {
      return this.parseNumberField(baseType, optional, metadata);
    }
    if (
      baseTypeName === "ZodBoolean" ||
      baseTypeName === "boolean" ||
      baseTypeName === (z as any).ZodFirstPartyTypeKind?.ZodBoolean
    ) {
      return this.parseBooleanField(optional, metadata);
    }
    if (baseTypeName === "ZodFunction" || baseTypeName === "function") {
      return this.parseFunctionField(optional, metadata);
    }
    if (
      baseTypeName === "ZodArray" ||
      baseTypeName === "array" ||
      baseTypeName === (z as any).ZodFirstPartyTypeKind?.ZodArray
    ) {
      return this.parseArrayField(baseType, optional);
    }

    return {
      type: "unknown",
      optional,
      metadata: { ...metadata, warning: "Unknown or unsupported Zod type" },
    };
  }

  private isZodObject(schema: unknown): schema is ZodObject<any> {
    if (typeof schema !== "object" || schema === null) return false;
    return isZodObjectLike(schema);
  }

  private extractVoroMetadata(description?: string): VoroMetadata {
    if (!description) return {};

    const tagRegex =
      /@voro\.(\w+)\s+(?:(?:"([^"]+)")|([^\s"]+)(?:\s+([^\s"]+))?)/g;
    const meta: VoroMetadata = {};
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(description)) !== null) {
      const [, key, quotedValue, val1, val2] = match;

      if (key === "range") {
        const min = Number(val1);
        const max = Number(val2);
        if (!isNaN(min) && !isNaN(max)) {
          meta[key] = { min, max };
        }
      } else {
        const value = quotedValue ?? val1 ?? "";
        if (typeof value === "string") {
          meta[key] = value as string;
        }
      }
    }

    return meta;
  }
}

