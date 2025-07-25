# Voro

`voro` is a CLI tool to generate mock data from TypeScript types or Zod schemas, designed to help developers quickly create realistic test data for frontend and backend development. It aims to eventually provide a fast Rust-based server to serve mocks over HTTP.

---

## Features (Current)

- Parses TypeScript files to extract a specific type or interface you specify
- Parses schema files to extract a specific schema you specify
- Supports complex TypeScript constructs like interfaces, type aliases, enums, unions, arrays, and nested types
- Supports complex Zod constructs (see above)
- Reads custom `@voro.*` metadata tags in JSDoc comments to control mock data generation, including:
  - `@voro.format` (e.g., uuid, paragraph)
  - `@voro.date` (e.g., past, future)
  - `@voro.range` (number ranges)
  - `@voro.length` (array lengths)
  - `@voro.value` (a specific mock value)
- Generates mock data in JSON format, either printed to the console or output to a file
- Uses `faker` library for realistic data generation
- Handles optional properties and recursive types with cycle protection

---

## Planned Features

- `voro serve`: a Rust-based HTTP server that serves the generated mock data dynamically via API endpoints
- Advanced metadata and customization options for more sophisticated mocking scenarios
- `voro clean`: remove `voro`-specific JSDoc comments

---

## Installation

```bash
npm install -g voro
```

Or use `npx` without installing globally:

```bash
npx voro mock -f ./src/ExampleInterface.ts -t ExampleInterface
```

---

## Usage

Generate mock data from a TypeScript type:

```bash
voro mock -f path/to/type.ts -t YourTypeName -o output.json
```

- `-f` or `--file`: path to the TypeScript file containing the type
- `-t` or `--type`: name of the type to generate mock data for
- `-o` or `--output`: name of the file to save mock data to (optional)

Gnerate mock data from a Zod schema:

```bash
voro mock -f path/to/schema.ts -s YourSchemaName -o output.json
```

- `-f` or `--file`: path to the TypeScript file containing the schema
- `-s` or `--schema`: name of the schema to generate mock data for
- `-o` or `--output`: name of the file to save mock data to (optional)

Example output:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "John Doe",
  "status": "active",
  "createdAt": "2022-01-01T12:00:00Z"
}
```

---

Example TypeScript schema with metadata:

```ts
export interface User {
  /** @voro.format uuid */
  id: string;
  name: string;
  status: "active" | "pending";
  /** @voro.length 3 */
  tags: string[];
  /** @voro.date past */
  createdAt: string;
}
```

Example Zod schema with metadata:

```ts
export const User = z.object({
  id: z.uuid({ version: "v4" }),
  name: z.string().describe(`@voro.format name`),
  status: z.enum(["active", "inactive", "pending"]),
  tags: z.array(z.string()).describe(`@voro.length 3`),
  createdAt: z.iso.datetime().describe(`@voro.date past`)
});
```

Running `voro mock` on `User` will generate realistic mock values respecting formats, enums, dates, and array lengths.

---

## Development

The core of `voro` is:

- **TypeScript parser**: Uses TypeScript Compiler API to parse and extract type information and custom metadata.
- **Zod schema parser**: Uses Zod's internal structure to parse and extract type information and custom metadata.
- **Mock data generator**: Recursively generates mock data from parsed schema using `faker`.
- **CLI commands**: Currently supports `mock`; `serve` coming soon.

---

## License

MIT