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
- Automatically generate and serve an OpenAPI (Swagger) spec for all mock endpoints

---

## Planned Features

- `voro cloud`: create cloud-hosted API endpoints for sharing mock APIs across teams or for development
- Advanced metadata and customization options for more sophisticated mocking scenarios
- `voro clean`: remove `voro`-specific JSDoc comments

---

## Installation

```bash
npm install -g voro
```

Or use `npx` without installing globally:

```bash
npx voro dev -f ./src/ExampleInterface.ts
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
- `--seed`: seed for reproducible mock data generation (optional)

Generate mock data from a Zod schema:

```bash
voro mock -f path/to/schema.ts -s YourSchemaName -o output.json
```

- `-f` or `--file`: path to the TypeScript file containing the schema
- `-s` or `--schema`: name of the schema to generate mock data for
- `-o` or `--output`: name of the file to save mock data to (optional)

### Run Development Server

Start a live development server that serves mock endpoints and an OpenAPI spec:

```bash
voro dev -f path/to/schema.ts -p 4010
```

- `-f` or `--file`: path to a single schema file (TypeScript or Zod)
- `-d` or `--dir`: path to a directory containing schema files
- `-g` or `--glob`: glob pattern matching schema files (e.g., `src/**/*.ts` to match all TypeScript files in `src` and subfolders)
- `-p` or `--port`: port to listen on (default: 4010)
- `-s` or `--seed`: seed for deterministic mock data (the same `id` will always produce the same object)

**Example usage:**

```bash
voro dev -g "src/**/*.ts" -p 4010
```

This will load all TypeScript files under the `src` directory (including subdirectories) as potential schema files.

The server automatically:
- Creates RESTful endpoints by pluralizing schema names (e.g., `User` → `/users`)
- Supports `GET /resource` for lists and `GET /resource/:id` for individual items
- Enables CORS for browser-based development
- Hot reloads when schema files change
- Returns JSON responses with realistic mock data

When the dev server is running, the OpenAPI 3.0 spec for all endpoints is available at:

```
http://localhost:4010/openapi.json
```

You can use this with Swagger UI, Postman, or other tools to explore and test your mock API.

Example endpoints for a `User` schema:
- `GET /` - lists all available endpoints
- `GET /users` - returns array of user objects (default 5, max 100)
- `GET /users?limit=10` - returns 10 user objects
- `GET /users/123` - returns single user with id=123

Example output from `GET /users?limit=1`:

```json
{
  "data": [
    {
      "id": "e22f8169-c8cc-4326-a335-e4715f48822b",
      "address": {
        "address1": "2225 Grove Road",
        "address2": "49504 Schamberger Junction",
        "city": "East Buck",
        "state": "Arizona",
        "zip": "89124",
        "country": "Turks and Caicos Islands"
      },
      "age": 71,
      "email": "Savion.McGlynn@yahoo.com",
      "isAdmin": false,
      "name": "Casey Langosh I",
      "status": "active",
      "createdAt": "2026-01-17T18:31:23.811Z"
    }
  ],
  "count": 1,
  "limit": 1,
  "offset": 0,
  "total": 1
}
```

Example output from `GET /users/123`:

```json
{
  "id": "123",
  "address": {
    "address1": "92839 Mill Lane",
    "address2": "175 Heathcote Rapid",
    "city": "Columbus",
    "state": "Arizona",
    "zip": "28896-3736",
    "country": "Mali"
  },
  "age": 66,
  "email": "Jessy.Roob@yahoo.com",
  "isAdmin": true,
  "name": "Kari Fahey",
  "status": "pending",
  "createdAt": "2026-01-03T01:40:54.042Z"
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