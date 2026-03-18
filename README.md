# Voro

Turn your TypeScript types or Zod schemas into a live REST API in seconds.

```bash
npx voro dev -g "src/**/*.ts"
```

- Instant mock API from your real schemas  
- Deterministic data with seeding  
- Auto-generated OpenAPI docs  
- Hot reload on file changes  

---

## Example

Define a schema:

```ts
export interface User {
  id: string;
  name: string;
  status: "active" | "pending";
}
```

Start the server:

```bash
voro dev -g "src/**/*.ts"
```

Now you have a working API:

- `GET /users`
- `GET /users/1`

### Example response (`GET /users?limit=1`)

```json
{
  "data": [
    {
      "id": "e22f8169-c8cc-4326-a335-e4715f48822b",
      "name": "Alice",
      "status": "active"
    }
  ],
  "count": 1,
  "limit": 1,
  "offset": 0,
  "total": 1
}
```

### Example response (`GET /users/1`)

```json
{
  "data": {
    "id": "123",
    "name": "Bob",
    "status": "pending"
  }
}
```

Explore your API in the browser:

```
http://localhost:4010/docs
```

---

## Why Voro?

Most mock tools require manually writing JSON or maintaining fake data.

Voro works differently:

- Uses your real TypeScript types or Zod schemas  
- No manual data setup  
- Always stays in sync with your code  
- Generates a real API, not just static data  

---

## Features

- Parse TypeScript types and interfaces
- Parse Zod schemas (Zod v3 and v4 supported)
- Support complex constructs:
  - unions, enums, arrays, nested types
- Deterministic mock generation with `--seed`
- Custom `@voro.*` metadata via JSDoc (and Zod `.describe()`):
  - **`@voro.format`** – `uuid`, `email`, `name`, `word`, `paragraph`, `iso.datetime`, `iso.date` (YYYY-MM-DD). For arrays, you can put format on the element: `z.array(z.string().describe("@voro.format word"))`.
  - **`@voro.date`** – `past`, `future`, `recent`
  - **`@voro.range`** – number ranges (e.g. `18 99`)
  - **`@voro.length`** – array length (e.g. on the array: `.describe("@voro.length 3")`)
  - **`@voro.value`** – fixed value for a field
- Realistic data powered by `faker`
- Recursive type handling with cycle protection
- Live dev server with:
  - RESTful endpoints
  - CORS enabled
  - hot reload
- Auto-generated OpenAPI (Swagger) docs

---

## Installation

Install globally:

```bash
npm install -g voro
```

Or use without installing:

```bash
npx voro dev -g "src/**/*.ts"
```

---

## Usage

### Run Development Server

```bash
voro dev -g "src/**/*.ts" -p 4010
```

Options:

- `-f, --file` Path to a single schema file  
- `-d, --dir` Path to a directory of schema files  
- `-g, --glob` Glob pattern for schema files  
- `-p, --port` Port (default: 4010)  
- `-s, --seed` Seed for deterministic data  

The server automatically:

- Generates endpoints by pluralizing schema names (`User` → `/users`)
- Supports:
  - `GET /resource`
  - `GET /resource/:id`
- Enables CORS for browser use
- Reloads when files change

---

### Generate mock data (CLI)

One-off JSON from a schema file: `voro mock -f path/to/schema.ts -t User` (or `-s SchemaName` for Zod). Add `-o file.json` to write to a file, `--seed` for deterministic output.

### In tests: `generateMock(schema)`

Generate one mock object from a Zod object schema in code (no CLI, no file):

```ts
import { generateMock } from "voro/generate-mock";
import { userSchema } from "./schema";

const mockUser = generateMock(userSchema);
const sameEveryTime = generateMock(userSchema, "seed-123");
```

Useful for fixtures, unit tests, and seeding. Uses the same faker-backed logic as the dev server.

---

## API Behavior

### Collections

```
GET /users
GET /users?limit=10
```

Response:

```json
{
  "data": [...],
  "count": 10,
  "limit": 10,
  "offset": 0,
  "total": 100
}
```

---

### Single Resource

```
GET /users/1
```

Response:

```json
{
  "data": { ... }
}
```

---

## OpenAPI Docs

Available at:

```
http://localhost:4010/docs
```

Use with Swagger UI, Postman, or any OpenAPI-compatible tool.

---

## Schema Examples

### TypeScript with Metadata

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

---

### Zod with Metadata

```ts
export const User = z.object({
  id: z.uuid(),
  name: z.string().describe(`@voro.format name`),
  status: z.enum(["active", "inactive", "pending"]),
  tags: z.array(z.string()).describe(`@voro.length 3`),
  createdAt: z.iso.datetime().describe(`@voro.date past`)
});
```

---

## Development

Core components:

- **Schema loader**: Parses TypeScript and Zod definitions  
- **TypeScript parser**: Uses the TypeScript Compiler API  
- **Zod parser**: Extracts schema structure and metadata  
- **Mock generator**: Recursively generates realistic data using `faker`  
- **CLI commands**:
  - `mock` – generate one-off data  
  - `dev` – run live API server  
- **HTTP server**: Fastify-based with CORS and auto endpoints  

---

## License

MIT