# Voro

A CLI tool for generating mock data from TypeScript types or Zod schemas. Perfect for creating realistic test data and running live development servers with mock APIs.

---

## Features (Current)

- Parse TypeScript files to extract types and interfaces
- Parse Zod schema files to extract schema definitions
- Support complex TypeScript constructs: interfaces, type aliases, enums, unions, arrays, and nested types
- Support complex Zod constructs with full schema validation
- Read custom `@voro.*` metadata tags in JSDoc comments to control mock generation:
  - `@voro.format` (e.g., uuid, paragraph)
  - `@voro.date` (e.g., past, future)
  - `@voro.range` (number ranges)
  - `@voro.length` (array lengths)
  - `@voro.value` (a specific mock value)
- Generate mock data in JSON format to console or file
- Use `faker` library for realistic data generation
- Handle optional properties and recursive types with cycle protection

---

## Planned Features

- Seed option for reproducible mock data generation (e.g., `--seed 123` for consistent results)
- `voro share`: create cloud-hosted API endpoints for sharing mock APIs across teams or for development
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

### Generate Mock Data

Generate mock data from a TypeScript type:

```bash
voro mock -f path/to/type.ts -t YourTypeName -o output.json
```

- `-f` or `--file`: path to the TypeScript file containing the type
- `-t` or `--type`: name of the type to generate mock data for
- `-o` or `--output`: name of the file to save mock data to (optional)

Generate mock data from a Zod schema:

```bash
voro mock -f path/to/schema.ts -s YourSchemaName -o output.json
```

- `-f` or `--file`: path to the TypeScript file containing the schema
- `-s` or `--schema`: name of the schema to generate mock data for
- `-o` or `--output`: name of the file to save mock data to (optional)

### Run Development Server

Start a live development server that serves mock endpoints:

```bash
voro dev -f path/to/schema.ts -p 4010
```

- `-f` or `--file`: path to a single schema file (TypeScript or Zod)
- `-d` or `--dir`: path to a directory containing schema files
- `-p` or `--port`: port to listen on (default: 4010)

The server automatically:
- Creates RESTful endpoints by pluralizing schema names (e.g., `User` → `/users`)
- Supports `GET /resource` for lists and `GET /resource/:id` for individual items
- Enables CORS for browser-based development
- Hot reloads when schema files change
- Returns JSON responses with realistic mock data

Example endpoints for a `User` schema:
- `GET /` - lists all available endpoints
- `GET /users` - returns array of user objects
- `GET /users/123` - returns single user with id=123
- `GET /users?count=10` - returns 10 user objects

Example output from `GET /`:

```json
{
  "endpoints": [
    {"list": "/users", "item": "/users/:id"},
    {"list": "/posts", "item": "/posts/:id"}
  ]
}
```

---

## Schema Examples

### TypeScript Schema with Metadata

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

### Zod Schema with Metadata

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

- **Schema loader**: Unified parsing system that extracts type information from both TypeScript types and Zod schemas
- **TypeScript parser**: Uses TypeScript Compiler API to parse and extract type information and custom metadata
- **Zod schema parser**: Uses Zod's internal structure to parse and extract type information and custom metadata
- **Mock data generator**: Recursively generates mock data from parsed schema using `faker`
- **CLI commands**:
  - `mock`: Generate one-off mock data from schemas
  - `dev`: Run a live HTTP server with hot-reload for serving mock APIs
- **HTTP server**: Fastify-based server with CORS support and automatic endpoint generation

---

## License

MIT