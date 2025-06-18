import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { z, ZodObject, ZodTypeAny } from "zod";
import { VoroMetadata } from "../types";
import { ZodDefault, ZodOptional } from "zod/v4";

type FieldInfo = {
  type: string | string[] | Record<string, any>;
  optional: boolean;
  metadata: Record<string, VoroMetadata>;
};

export class ZodParser {
  constructor(private filePath: string) { }

  async parse(schemaName: string) {
    const absPath = path.resolve(this.filePath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`${this.filePath} not found`);
    }

    const fileUrl = pathToFileURL(absPath).href;
    let moduleExports: any;
    try {
      moduleExports = await import(fileUrl);
    } catch (err) {
      throw new Error(`Could not import file: ${err}`);
    }

    const schema = moduleExports[schemaName];
    if (!schema) {
      throw new Error(`Schema "${schemaName}" not found`);
    }

    if (this.isZodObject(schema)) {
      throw new Error(`Schema "${schemaName}" is not valid Zod schema`);
    }

    return this.extractProperties(schema);
  }

  private extractProperties(schema: ZodObject<any>): Record<string, FieldInfo> {
    const result: Record<string, FieldInfo> = {};
    const shape = schema.shape;

    for (const key in shape) {
      result[key] = this.parseField(shape[key]);
    }

    return result;
  }

  private getTypeName(schema: any): string {
    if (schema?._def?.type) {
      return schema._def.type;
    }

    if (schema?._def?.typeName) {
      return schema._def.typeName;
    }

    return "unknown";
  }

  private parseField(schema: ZodTypeAny): FieldInfo {
    let baseType = schema;
    let optional = false;
    let metadata: Record<string, any> = {};

    if (schema instanceof ZodDefault || schema instanceof ZodOptional) {
      optional = true;
      baseType = schema._def.innerType;
    }

    const def = baseType._def;
    const typeName = this.getTypeName(baseType);

    switch (typeName) {
      case "string":
      case z.ZodFirstPartyTypeKind.ZodString: {
        for (const check of def.checks || []) {
          if (check.kind === "email") metadata.format = "email";
          if (check.kind === "uuid") metadata.format = "uuid";
        }

        if (def.format) {
          if (def.format === "date" || def.format === "datetime") {
            metadata.date = "past";
          } else {
            metadata.format = def.format;
          }
        }

        return { type: "string", optional, metadata };
      }

      case "number":
      case z.ZodFirstPartyTypeKind.ZodNumber: {
        if ("minValue" in schema && "maxValue" in schema) {
          metadata.range = {
            min: schema.minValue,
            max: schema.maxValue
          }
        }

        for (const check of def.checks || []) {
          if (check.kind === "min") {
            metadata.range = { ...(metadata.range || {}), min: check.value };
          }
          if (check.kind === "max") {
            metadata.range = { ...(metadata.range || {}), max: check.value };
          }
        }

        return { type: "number", optional, metadata };
      }

      case "boolean":
      case z.ZodFirstPartyTypeKind.ZodBoolean:
        return { type: "boolean", optional, metadata };

      case "enum":
      case z.ZodFirstPartyTypeKind.ZodEnum:
        if (def.entries) {
          return { type: Object.keys(def.entries), optional, metadata };
        }

        return { type: def.values, optional, metadata };

      case z.ZodFirstPartyTypeKind.ZodLiteral:
        return { type: [def.value], optional, metadata };

      case z.ZodFirstPartyTypeKind.ZodUnion: {
        const options = def.options;
        const allLiterals = options.every((opt: ZodTypeAny) =>
          opt._def.typeName === "ZodLiteral"
        );
        if (allLiterals) {
          return {
            type: options.map((opt: any) => opt._def.value),
            optional,
            metadata,
          };
        }
        return { type: "union", optional, metadata };
      }

      case "object":
      case z.ZodFirstPartyTypeKind.ZodObject: {
        return {
          type: this.extractProperties(baseType as ZodObject<any>),
          optional,
          metadata: {},
        };
      }

      default:
        return { type: "unknown", optional, metadata };
    }
  }

  private isZodObject(schema: unknown): schema is ZodObject<any> {
    return (
      typeof schema === "object" &&
      schema !== null &&
      "_def" in schema &&
      (schema as any)._def?.typeName === "object" &&
      typeof (schema as any).shape === "object"
    );
  }
}