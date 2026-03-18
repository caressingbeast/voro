import path from "path";
import ts from "typescript";

import type { PropertySpec, VoroMetadata } from "../types";
import { finalizePropertySpec } from "./propertySpecCore.js";

export class TypeParser {
  private program: ts.Program;
  private resolvedPath: string;

  constructor(filePath: string) {
    this.resolvedPath = path.resolve(filePath);
    const configPath = ts.findConfigFile(this.resolvedPath, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) throw new Error("tsconfig.json not found");

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");

    this.program = ts.createProgram([this.resolvedPath], parsed.options);
  }

  public parse(typeName: string): { schema: Record<string, PropertySpec>; fakerLocale: string } {
    const source = this.getSource();
    if (!source) throw new Error(`${this.resolvedPath} not found`);

    let targetNode: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined;

    ts.forEachChild(source, (node) => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === typeName) {
        targetNode = node;
      }
    });

    if (!targetNode) throw new Error(`Type ${typeName} not found`);

    const rootMeta = this.extractDeclarationVoroMetadata(targetNode);
    const fakerLocale =
      typeof rootMeta.locale === "string" && rootMeta.locale.trim()
        ? rootMeta.locale.trim()
        : "en_US";

    const members =
      ts.isInterfaceDeclaration(targetNode) && targetNode.members
        ? targetNode.members
        : ts.isTypeAliasDeclaration(targetNode) &&
          ts.isTypeLiteralNode(targetNode.type)
          ? targetNode.type.members
          : ([] as unknown as ts.NodeArray<ts.TypeElement>);

    const schema = this.extractProperties(members, new Set(), source);
    return { schema, fakerLocale };
  }

  private extractProperties(
    members: ts.NodeArray<ts.TypeElement>,
    visited: Set<string>,
    source?: ts.SourceFile
  ): Record<string, PropertySpec> {
    const result: Record<string, PropertySpec> = {};

    for (const member of members) {
      if (ts.isPropertySignature(member) && member.type && ts.isIdentifier(member.name)) {
        const name = member.name.text;
        const optional = !!member.questionToken;
        let metadata = this.extractVoroMetadata(member, source);
        const type = this.extractTypeNode(member.type, visited, source);
        const refLocale = this.extractLocaleFromReferencedType(member.type, source);
        if (refLocale && !metadata.locale) {
          metadata = { ...metadata, locale: refLocale };
        }

        // Detect nullable: union containing null
        let isNullable = false;
        if (Array.isArray(type)) {
          if (type.includes("null")) {
            isNullable = true;
          }
        } else if (typeof type === "string" && type === "null") {
          isNullable = true;
        }
        if (isNullable) {
          metadata = { ...metadata, nullable: "true" };
        }

        result[name] = finalizePropertySpec(name, { type, optional, metadata }, metadata);
      }
    }

    return result;
  }

  private extractTypeNode(typeNode: ts.TypeNode, visited: Set<string>, source?: ts.SourceFile): any {
    if (!typeNode) return "unknown";
    if (ts.isTypeReferenceNode(typeNode)) {
      try {
        if (!typeNode.typeName) return "unknown";
        const src = source ?? typeNode.getSourceFile();
        const typeName = (src ? typeNode.typeName.getText(src) : typeNode.typeName.getText()).trim();
      if (visited.has(typeName)) return "any"; // recursion protection
      visited.add(typeName);

      // Special-case common utility types
      if (typeName === "Record" && typeNode.typeArguments?.length === 2) {
        const keyType = this.extractTypeNode(typeNode.typeArguments[0], visited, source);
        const valueType = this.extractTypeNode(typeNode.typeArguments[1], visited, source);
        return { record: { key: keyType, value: valueType } };
      }

      if (typeName === "Partial" && typeNode.typeArguments?.[0]) {
        return this.extractTypeNode(typeNode.typeArguments[0], visited, source);
      }

      const decl = this.findTypeDeclaration(typeName);
      if (decl) {
        const declSource = decl.getSourceFile();
        if (ts.isInterfaceDeclaration(decl)) {
          return this.extractProperties(decl.members, new Set(visited), declSource);
        }

        if (ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)) {
          return this.extractProperties(decl.type.members, new Set(visited), declSource);
        }
      }

      return typeName;
      } catch {
        try {
          return (source ? typeNode.getText(source) : typeNode.getText()).trim();
        } catch {
          return "unknown";
        }
      }
    }

    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((t) => {
        const val = this.extractTypeNode(t, visited, source);
        // Strip quotes from string literals in unions
        if (typeof val === "string" && /^".*"$/.test(val)) return val.slice(1, -1);
        return val;
      });
    }

    if (ts.isIntersectionTypeNode(typeNode)) {
      const parts = typeNode.types.map((t) => this.extractTypeNode(t, visited, source));
      // If all parts are objects, merge them
      const merged = parts.reduce((acc, cur) => {
        if (typeof acc === "object" && acc !== null && typeof cur === "object" && cur !== null) {
          return { ...acc, ...cur };
        }
        return "intersection";
      }, {} as any);
      return merged;
    }

    if (ts.isArrayTypeNode(typeNode)) {
      return [this.extractTypeNode(typeNode.elementType, visited, source)];
    }

    if (ts.isTupleTypeNode(typeNode)) {
      return typeNode.elements.map((el) => this.extractTypeNode(el, visited, source));
    }

    if (ts.isTypeLiteralNode(typeNode)) {
      return this.extractProperties(typeNode.members, visited, source);
    }

    if (ts.isFunctionTypeNode(typeNode)) {
      return "function";
    }

    if (ts.isLiteralTypeNode(typeNode)) {
      try {
        const text = source ? typeNode.getText(source) : typeNode.getText();
        return text.replace(/^"|"$/g, "").trim();
      } catch {
        return "unknown";
      }
    }

    try {
      const text = source ? typeNode.getText(source) : typeNode.getText();
      return text.trim();
    } catch {
      return "unknown";
    }
  }

  private getTagCommentText(
    comment: string | ts.NodeArray<ts.JSDocComment> | undefined
  ): string {
    if (!comment) return "";
    if (typeof comment === "string") return comment;
    return comment.map(c => c.getText()).join(" ");
  }

  private extractVoroMetadata(member: ts.PropertySignature, source?: ts.SourceFile): VoroMetadata {
    let tags = ts.getJSDocTags(member);
    const memberWithJSDoc = member as { jsDoc?: Array<{ tags?: ts.JSDocTag[] }> };
    if (tags.length === 0 && memberWithJSDoc.jsDoc) {
      tags = memberWithJSDoc.jsDoc.flatMap((d) => d.tags ?? []);
    }
    return this.parseVoroJSDocTags(tags, source ?? member.getSourceFile());
  }

  /** @voro.* on an interface or type alias (e.g. root locale or Address block). */
  private extractDeclarationVoroMetadata(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): VoroMetadata {
    let tags = ts.getJSDocTags(node);
    const withJsDoc = node as { jsDoc?: Array<{ tags?: ts.JSDocTag[] }> };
    if (tags.length === 0 && withJsDoc.jsDoc) {
      tags = withJsDoc.jsDoc.flatMap((d) => d.tags ?? []);
    }
    return this.parseVoroJSDocTags(tags, node.getSourceFile());
  }

  private parseVoroJSDocTags(tags: readonly ts.JSDocTag[], _source: ts.SourceFile): VoroMetadata {
    const metadata: VoroMetadata = {};
    for (const tag of tags) {
      if (!tag.tagName || !ts.isIdentifier(tag.tagName)) continue;
      const tagText = tag.tagName.escapedText.toString();
      const rawComment = this.getTagCommentText(tag.comment).trim();

      let key: string | undefined;
      let value: string;

      if (tagText === "voro") {
        const parts = rawComment.split(/\s+/);
        key = parts.shift()?.replace(/^\./, "");
        value = parts.join(" ");
      } else if (tagText.startsWith("voro.")) {
        key = tagText.replace(/^voro\./, "");
        value = rawComment;
      } else {
        continue;
      }

      if (!key) continue;

      if (key === "range") {
        const nums = value.split(/\s+/).map(Number);
        if (nums.length === 2 && nums.every((n) => !isNaN(n))) {
          metadata.range = { min: nums[0], max: nums[1] };
        }
      } else {
        metadata[key] = value;
      }
    }
    return metadata;
  }

  /** Inherit @voro.locale from a referenced interface / type alias (nested object). */
  private extractLocaleFromReferencedType(typeNode: ts.TypeNode, source?: ts.SourceFile): string | undefined {
    const src = source ?? typeNode.getSourceFile();
    let node: ts.TypeNode = typeNode;
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText(src).trim();
      if (typeName === "Partial" && node.typeArguments?.[0]) {
        return this.extractLocaleFromReferencedType(node.typeArguments[0], src);
      }
      if (
        typeName === "Record" ||
        typeName === "Pick" ||
        typeName === "Omit" ||
        typeName === "Required" ||
        typeName === "Readonly"
      ) {
        return undefined;
      }
      const decl = this.findTypeDeclaration(typeName);
      if (decl && (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl))) {
        const m = this.extractDeclarationVoroMetadata(decl);
        if (typeof m.locale === "string" && m.locale.trim()) return m.locale.trim();
      }
    }
    return undefined;
  }


  private getSource(): ts.SourceFile | undefined {
    const exact = this.program.getSourceFile(this.resolvedPath);
    if (exact) return exact;
    return this.program.getSourceFiles().find(
      (sf) => path.resolve(sf.fileName) === this.resolvedPath
    );
  }

  private findTypeDeclaration(name: string): ts.Declaration | undefined {
    const source = this.getSource();
    if (!source) return;

    let found: ts.Declaration | undefined;
    ts.forEachChild(source, (node) => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === name) {
        found = node;
      }
    });

    return found;
  }
}
