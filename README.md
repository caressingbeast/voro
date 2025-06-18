# Voro

`voro` is a CLI tool to generate mock data from TypeScript types or Zod schemas, designed to help developers quickly create realistic test data for frontend and backend development. It aims to eventually provide a fast Rust-based server to serve mocks over HTTP.

---

## Features (Current)

- Parses TypeScript files to extract a specific type or interface you specify
- Supports complex TypeScript constructs like interfaces, type aliases, enums, unions, arrays, and nested types
- Reads custom `@voro.*` metadata tags in JSDoc comments to control mock data generation, including:
  - `@voro.format` (e.g., uuid, paragraph)
  - `@voro.date` (e.g., past, future)
  - `@voro.range` (number ranges)
  - `@voro.length` (array lengths)
- Generates mock data in JSON format, either printed to the console or output to a file
- Uses `faker` library for realistic data generation
- Handles optional properties and recursive types with cycle protection

---

## Planned Features

- `voro serve`: a Rust-based HTTP server that serves the generated mock data dynamically via API endpoints
- Support for live reload and schema watching to regenerate mocks on schema changes
- Advanced metadata and customization options for more sophisticated mocking scenarios

---

## Installation

```bash
npm install -g voro
```

---

## Usage

Generate mock data from a TypeScript type:

```bash
voro mock -f path/to/types.ts -t YourTypeName
```

- `-f` or `--file`: path to the TypeScript file containing the type/interface
- `-t` or `--type`: name of the type or interface to generate mock data for

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
  /** @voro.date past */
  createdAt: string;
  tags: string[];
}
```

Running `voro mock` on `User` will generate realistic mock values respecting formats, enums, dates, and array lengths.

---

## Development

The core of `voro` is:

- **TypeScript parser**: Uses TypeScript Compiler API to parse and extract type information and custom metadata.
- **Mock data generator**: Recursively generates mock data from parsed schema using `faker`.
- **CLI commands**: Currently supports `mock`; `serve` coming soon.

---

## License

MIT