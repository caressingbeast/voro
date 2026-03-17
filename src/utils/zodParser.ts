import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { z, ZodObject, ZodTypeAny } from "zod";
import {
  ZodArray,
  ZodDefault,
  ZodOptional,
  ZodNullable,
  ZodRecord,
  ZodMap,
  ZodTuple,
  ZodDate,
} from "zod/v4";

import { PropertySpec, VoroMetadata } from "../types";

export class ZodParser {
  private sawRefinement = false;

  constructor(private filePath: string) { }

  async parse(schemaName: string) {
    const absPath = path.resolve(this.filePath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`${this.filePath} not found`);
    }

    const fileUrl = pathToFileURL(absPath).href;
    // Force a fresh import during hot-reload by appending a cache-busting query.
    const moduleUrl = `${fileUrl}?cacheBust=${Date.now()}`;
    let moduleExports: any;
    try {
      moduleExports = await import(moduleUrl);
    } catch (err) {
      throw new Error(`Could not import file: ${err}`);
    }

    let schema = moduleExports[schemaName];
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found`);
    }

    this.sawRefinement = false;
    // If the schema has refinements (e.g. superRefine), the exported schema will be
    // wrapped in an effect/pipeline type. We only need the underlying shape for
    // mocking purposes, so unwrap it.
    schema = this.unwrapRefinements(schema);

    if (this.sawRefinement) {
      console.warn(
        `[voro] Warning: schema "${schemaName}" in ${this.filePath} uses refinements (refine/superRefine/transform/etc.). ` +
        "Generated mocks may not satisfy those runtime constraints."
      );
    }

    if (this.isZodObject(schema)) {
      throw new Error(`Schema ${schemaName} is not valid Zod schema`);
    }

    return this.extractProperties(schema);
  }

  private extractProperties(schema: ZodObject<any>): Record<string, PropertySpec> {
    const result: Record<string, PropertySpec> = {};
    const shape = schema.shape;

    for (const key in shape) {
      result[key] = this.parseField(shape[key]);
    }

    return result;
  }

  private unwrapRefinements(schema: any): any {
    // Zod's `superRefine` / `refine` / `transform` create effect/pipeline wrappers
    // around the underlying schema. For our purposes we only need the base shape.
    const typeName = this.getTypeName(schema);

    if (typeName === "ZodEffects") {
      this.sawRefinement = true;
      return this.unwrapRefinements(schema._def.schema);
    }

    if (typeName === "ZodPipeline") {
      this.sawRefinement = true;
      return this.unwrapRefinements(schema._def.in);
    }

    return schema;
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

  private parseField(schema: ZodTypeAny): PropertySpec {
    // Handle schemas wrapped by refinements (e.g. superRefine/refine).
    const unwrapped = this.unwrapRefinements(schema);

    let baseType = unwrapped;
    let optional = false;
    let metadata: Record<string, any> = {};

    if (unwrapped instanceof ZodDefault || unwrapped instanceof ZodOptional) {
      optional = true;
      baseType = unwrapped._def.innerType;
    }

    // Nullable should be represented as a nullable field.
    if (baseType instanceof ZodNullable) {
      const inner = baseType._def.innerType;
      const innerParsed = this.parseField(inner as unknown as ZodTypeAny);
      return {
        ...innerParsed,
        optional,
        metadata: { ...innerParsed.metadata, nullable: "true" },
      };
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

        const specificMeta = this.extractVoroMetadata(schema.description);

        return { type: "string", optional, metadata: Object.keys(specificMeta).length ? specificMeta : metadata };
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

      case "array":
      case z.ZodFirstPartyTypeKind.ZodArray: {
        let arrayType: any = "string";

        if (baseType instanceof ZodArray) {
          arrayType = this.getTypeName(baseType.element);
        }

        return {
          type: [arrayType],
          optional,
          metadata: this.extractVoroMetadata(baseType.description)
        };
      }

      case "tuple":
      case z.ZodFirstPartyTypeKind.ZodTuple: {
        if (baseType instanceof ZodTuple) {
          return {
            type: baseType._def.items.map((item: any) => ({
              type: this.getTypeName(item),
              optional: false,
              metadata: this.extractVoroMetadata(item.description),
            })),
            optional,
            metadata: this.extractVoroMetadata(baseType.description),
          };
        }
        return { type: "tuple", optional, metadata };
      }

      case "record":
      case z.ZodFirstPartyTypeKind.ZodRecord: {
        if (baseType instanceof ZodRecord) {
          const valueSpec: PropertySpec = {
            type: this.getTypeName(baseType._def.valueType),
            optional: false,
            metadata: this.extractVoroMetadata(baseType.description),
          };
          return {
            type: { ["<key>"]: valueSpec },
            optional,
            metadata: this.extractVoroMetadata(baseType.description),
          };
        }
        return { type: "record", optional, metadata };
      }

      case "map":
      case z.ZodFirstPartyTypeKind.ZodMap: {
        if (baseType instanceof ZodMap) {
          const valueSpec: PropertySpec = {
            type: this.getTypeName(baseType._def.valueType),
            optional: false,
            metadata: this.extractVoroMetadata(baseType.description),
          };
          return {
            type: { ["<key>"]: valueSpec },
            optional,
            metadata: this.extractVoroMetadata(baseType.description),
          };
        }
        return { type: "map", optional, metadata };
      }

      case "date":
      case z.ZodFirstPartyTypeKind.ZodDate: {
        return { type: "string", optional, metadata: { ...metadata, format: "date" } };
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

  private extractVoroMetadata(description?: string): VoroMetadata {
    if (!description) return {};

    const tagRegex = /@voro\.(\w+)\s+(?:(?:"([^"]+)")|([^\s"]+)(?:\s+([^\s"]+))?)/g;
    const meta: VoroMetadata = {};
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(description)) !== null) {
      const [, key, quotedValue, val1, val2] = match;

      if (key === 'range') {
        const min = Number(val1);
        const max = Number(val2);
        if (!isNaN(min) && !isNaN(max)) {
          meta[key] = { min, max };
        }
      } else {
        const value = quotedValue ?? val1 ?? "";
        if (typeof value === 'string') {
          meta[key] = value as string;
        }
      }
    }

    return meta;
  }
}