import ts from "typescript";

import type { VoroMetadata } from "../types";

export class TypeParser {
  private program: ts.Program;

  constructor(private filePath: string) {
    const configPath = ts.findConfigFile(filePath, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) throw new Error("tsconfig.json not found");

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, "./");

    this.program = ts.createProgram([filePath], parsed.options);
  }

  public parse(typeName: string) {
    const source = this.program.getSourceFile(this.filePath);
    if (!source) throw new Error(`${this.filePath} not found`);

    let targetNode: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined;

    ts.forEachChild(source, (node) => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === typeName) {
        targetNode = node;
      }
    });

    if (!targetNode) throw new Error(`Type ${typeName} not found`);

    const members =
      ts.isInterfaceDeclaration(targetNode) && targetNode.members
        ? targetNode.members
        : ts.isTypeAliasDeclaration(targetNode) &&
          ts.isTypeLiteralNode(targetNode.type)
          ? targetNode.type.members
          : ([] as unknown as ts.NodeArray<ts.TypeElement>);

    return this.extractProperties(members, new Set());
  }

  private extractProperties(
    members: ts.NodeArray<ts.TypeElement>,
    visited: Set<string>
  ): Record<string, { type: any; optional: boolean; metadata: VoroMetadata }> {
    const result: Record<string, { type: any; optional: boolean; metadata: VoroMetadata }> = {};

    for (const member of members) {
      if (ts.isPropertySignature(member) && member.type && ts.isIdentifier(member.name)) {
        const name = member.name.text;
        const optional = !!member.questionToken;
        const metadata = this.extractVoroMetadata(member);
        const type = this.extractTypeNode(member.type, visited);

        result[name] = { type, optional, metadata };
      }
    }

    return result;
  }

  private extractTypeNode(typeNode: ts.TypeNode, visited: Set<string>): any {
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();
      if (visited.has(typeName)) return "any"; // recursion protection
      visited.add(typeName);

      const decl = this.findTypeDeclaration(typeName);
      if (decl) {
        if (ts.isInterfaceDeclaration(decl)) {
          return this.extractProperties(decl.members, new Set(visited));
        }

        if (ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)) {
          return this.extractProperties(decl.type.members, new Set(visited));
        }
      }

      return typeName;
    }

    if (ts.isUnionTypeNode(typeNode)) {
      return typeNode.types.map((t) => {
        const val = this.extractTypeNode(t, visited);
        // Strip quotes from string literals in unions
        if (typeof val === "string" && /^".*"$/.test(val)) return val.slice(1, -1);
        return val;
      });
    }

    if (ts.isArrayTypeNode(typeNode)) {
      return [this.extractTypeNode(typeNode.elementType, visited)];
    }

    if (ts.isFunctionTypeNode(typeNode)) {
      return "function";
    }

    if (ts.isLiteralTypeNode(typeNode)) {
      return typeNode.getText().replace(/^"|"$/g, "");
    }

    return typeNode.getText();
  }

  private getTagCommentText(
    comment: string | ts.NodeArray<ts.JSDocComment> | undefined
  ): string {
    if (!comment) return "";
    if (typeof comment === "string") return comment;
    return comment.map(c => c.getText()).join(" ");
  }

  private extractVoroMetadata(member: ts.PropertySignature): VoroMetadata {
    const metadata: VoroMetadata = {};
    const tags = ts.getJSDocTags(member);

    for (const tag of tags) {
      if (tag.tagName.getText() === "voro") {
        const rawComment = this.getTagCommentText(tag.comment);
        const parts = rawComment.trim().split(/\s+/);
        const key = parts.shift()?.replace(/^\./, "");
        const value = parts.join(" ");

        if (!key) continue;

        if (key === "range") {
          // Expect two numbers space separated, e.g. "1 10"
          const nums = value.split(/\s+/).map(Number);
          if (nums.length === 2 && nums.every(n => !isNaN(n))) {
            metadata.range = { min: nums[0], max: nums[1] };
          }
        } else {
          metadata[key] = value;
        }
      }
    }

    return metadata;
  }


  private findTypeDeclaration(name: string): ts.Declaration | undefined {
    const source = this.program.getSourceFile(this.filePath);
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
