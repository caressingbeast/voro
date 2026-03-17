import fsPromises from "fs/promises";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import chalk from "chalk";
import chokidar from "chokidar";
import pluralize from "pluralize";
import { Command } from "commander";
import supportsHyperlinks from "supports-hyperlinks";
// import supportsHyperlinks from "supports-hyperlinks";

import { TypeMocker, hashStringToNumber } from "../utils/mock.js";
import * as z from "zod";
import { loadSchemas, type SchemaBundle } from "../utils/schemaLoader.js";
import type { PropertySpec } from "../types.js";

const fastify = Fastify();

// Enable CORS so that browser-based frontends can call the mock API.
fastify.register(cors, {
  origin: true,
});

fastify.setErrorHandler((error, request, reply) => {
  console.error(chalk.red("[voro] Internal server error:"), error);
  reply.status(500).send({ error: "Internal server error" });
});

// Helper to get endpoint name from schema name
const getEndpointName = (rawName: string) => {
  // Remove 'Schema' suffix (case-insensitive)
  let name = rawName.replace(/schema$/i, "");
  // Capitalize first letter for consistency
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return pluralize(name).toLowerCase();
};

// Helper to retry Zod validation up to 3 times
const generateValidMock = (mocker: TypeMocker, zodSchema: z.ZodTypeAny, schemaName: string) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const mock = mocker.mock();
    const result = zodSchema.safeParse(mock);
    if (result.success) return mock;
  }
  const lastMock = mocker.mock();
  console.warn(
    `[voro] Warning: Generated mock for schema "${schemaName}" did not pass Zod validation after 3 attempts.`
  );
  return lastMock;
};


const getSeedForId = (baseSeed: string | number | undefined, id: string | number) => {
  const base = baseSeed !== undefined
    ? typeof baseSeed === "string"
      ? hashStringToNumber(baseSeed)
      : baseSeed
    : 0;
  const idHash = hashStringToNumber(String(id));
  return base ^ idHash;
};

type SchemaHandler = {
  schemaName: string;
  generator: (id?: string | number) => any;
  idKey: string | null;
};


export const parseLimit = (limit?: string): number => {
  const parsed = Number(limit);
  if (!parsed || parsed <= 0 || Number.isNaN(parsed)) return 5;
  return Math.min(parsed, 100); // Max 100 items
};

// Helper to load the original Zod schema for validation
async function getZodSchema(filePath: string, schemaName: string): Promise<import("zod").ZodTypeAny | undefined> {
  try {
    const absPath = path.resolve(filePath);
    const fileUrl = pathToFileURL(absPath).href;
    const moduleUrl = `${fileUrl}?cacheBust=${Date.now()}`;
    const moduleExports = await import(moduleUrl);
    return moduleExports[schemaName];
  } catch {
    return undefined;
  }
}


export const createSchemaHandlers = async (bundles: SchemaBundle[], seed?: string | number) => {
  const handlers: Map<string, SchemaHandler> = new Map();

  for (const bundle of bundles) {
    const endpoint = getEndpointName(bundle.name);
    const hasId = bundle.schema.hasOwnProperty("id");
    let zodSchema: import("zod").ZodTypeAny | undefined = undefined;
    if (bundle.kind === "zod") {
      zodSchema = await getZodSchema(bundle.filePath, bundle.name);
    }
    handlers.set(endpoint, {
      schemaName: bundle.name,
      generator: (id?: string | number) => {
        const seedToUse = id !== undefined ? getSeedForId(seed, id) : seed;
        const mocker = new TypeMocker(bundle.schema, seedToUse);
        if (zodSchema) {
          return generateValidMock(mocker, zodSchema, bundle.name);
        } else {
          return mocker.mock();
        }
      },
      idKey: hasId ? "id" : null,
    });
  }

  return handlers;
};


let schemaHandlers: Map<string, SchemaHandler> = new Map();
let openApiSpec: any = null;
let watching = false;


// Utility: Infer OpenAPI schema from a sample object
function inferOpenApiSchemaFromSample(sample: any): any {
  if (Array.isArray(sample)) {
    return { type: "array", items: sample.length > 0 ? inferOpenApiSchemaFromSample(sample[0]) : { type: "string" } };
  }
  if (sample === null) {
    return { nullable: true };
  }
  if (typeof sample === "object" && sample !== null) {
    const properties: Record<string, any> = {};
    for (const [k, v] of Object.entries(sample)) {
      properties[k] = inferOpenApiSchemaFromSample(v);
    }
    return { type: "object", properties };
  }
  if (typeof sample === "string") return { type: "string" };
  if (typeof sample === "number") return { type: "number" };
  if (typeof sample === "boolean") return { type: "boolean" };
  return { type: "string" };
}


// Generate OpenAPI spec from schemaHandlers using sample mock objects
function generateOpenApiSpec(schemaHandlers: Map<string, SchemaHandler>): any {
  const paths: Record<string, any> = {};
  const components: Record<string, any> = { schemas: {} };
  for (const [endpoint, handler] of schemaHandlers.entries()) {
    // List endpoint
    paths[`/${endpoint}`] = {
      get: {
        summary: `List ${handler.schemaName}`,
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
            required: false,
            description: "Number of items to return (max 100)"
          }
        ],
        responses: {
          200: {
            description: `Array of ${handler.schemaName}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: `#/components/schemas/${handler.schemaName}` } },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    offset: { type: "integer" }
                  }
                }
              }
            }
          }
        }
      }
    };
    // Item endpoint
    paths[`/${endpoint}/{id}`] = {
      get: {
        summary: `Get ${handler.schemaName} by id`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: `${handler.schemaName} object`,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${handler.schemaName}` }
              }
            }
          },
          404: {
            description: "Not found"
          }
        }
      }
    };
    // Add schema definition using a sample mock
    if (!components.schemas[handler.schemaName]) {
      try {
        const sample = handler.generator();
        components.schemas[handler.schemaName] = inferOpenApiSchemaFromSample(sample);
      } catch {
        components.schemas[handler.schemaName] = { type: "object" };
      }
    }
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "Voro Mock API",
      version: "1.0.0"
    },
    paths,
    components
  };
}

const setupRoutes = (server: ReturnType<typeof Fastify>) => {
    // Serve OpenAPI spec at /openapi.json
    server.get("/openapi.json", async (request: FastifyRequest, reply: FastifyReply) => {
      if (!openApiSpec) {
        return reply.status(404).send({ error: "OpenAPI spec not available" });
      }
      reply.type("application/json").send(openApiSpec);
    });
  server.get("/", async () => {
    const endpoints = Array.from(schemaHandlers.keys()).sort();
    return {
      endpoints: endpoints.map((e) => ({
        list: e.startsWith("/") || e.startsWith("*") ? e : `/${e}`,
        item: e.startsWith("/") || e.startsWith("*") ? `${e}/:id` : `/${e}/:id`,
      })),
    };
  });
  // Serve Swagger UI at /docs using CDN
  server.get("/docs", async (request: FastifyRequest, reply: FastifyReply) => {
    const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Voro Mock API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
        <style>body { margin: 0; }</style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: '/openapi.json',
              dom_id: '#swagger-ui',
              presets: [SwaggerUIBundle.presets.apis],
              layout: 'BaseLayout',
              docExpansion: 'none',
              deepLinking: true
            });
          };
        </script>
      </body>
      </html>`;
    reply.type("text/html").send(html);
  });

  type ListRequest = FastifyRequest<{ Params: { endpoint: string }; Querystring: { limit?: string } }>;
  type ItemRequest = FastifyRequest<{ Params: { endpoint: string; id: string } }>;

  server.get("/:endpoint", async (request: ListRequest, reply: FastifyReply) => {
    const { endpoint } = request.params;
    // Case-insensitive lookup
    const handler = Array.from(schemaHandlers.entries()).find(([key]) => key.toLowerCase() === endpoint.toLowerCase())?.[1];
    if (!handler) {
      return reply.status(404).send({ error: `Schema "${endpoint}" not found` });
    }

    const limit = parseLimit(request.query.limit);
    const data = Array.from({ length: limit }).map(() => handler.generator());
    return {
      data,
      count: data.length, // actual number of items returned
      limit, // requested max
      total: data.length, // for now, same as count
      offset: 0
    };
  });

  server.get("/:endpoint/:id", async (request: ItemRequest, reply: FastifyReply) => {
    const { endpoint, id } = request.params;
    // Case-insensitive lookup
    const handler = Array.from(schemaHandlers.entries()).find(([key]) => key.toLowerCase() === endpoint.toLowerCase())?.[1];
    if (!handler) {
      return reply.status(404).send({ error: `Schema "${endpoint}" not found` });
    }

    const result = handler.generator(id);
    if (handler.idKey && typeof result === "object" && result !== null) {
      result[handler.idKey] = id;
    }

    return result;
  });
};

const setupWatcher = (watchPath: string, onChange: () => void) => {
  if (watching) return;
  watching = true;

  const absolutePath = path.resolve(watchPath);
  const stats = fs.existsSync(absolutePath) ? fs.statSync(absolutePath) : null;
  const watchTarget = stats && stats.isDirectory() ? absolutePath : absolutePath;

  const debounced = (() => {
    let timer: NodeJS.Timeout | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onChange();
      }, 150);
    };
  })();

  chokidar.watch(watchTarget, { ignoreInitial: true, persistent: true })
    .on("add", debounced)
    .on("change", debounced)
    .on("unlink", debounced)
    .on("error", (err) => {
      console.error(chalk.red(`[voro] Watcher error: ${err}`));
    });
};

export const devCommand = new Command("dev")
  .description("Run a development server that serves mock data from schema files")
  .option("-f, --file <file>", "Single schema file (TypeScript or Zod)")
  .option("-d, --dir <dir>", "Directory containing schema files")
  .option("-g, --glob <pattern>", "Glob pattern matching schema files")
  .option("-p, --port <port>", "Port to listen on", "4010")
  .option("-s, --seed <seed>", "Seed for reproducible mock data generation")
  .action(async (options) => {
    const specified = [options.file, options.dir, options.glob].filter(Boolean);
    if (specified.length === 0) {
      console.error(chalk.bold.red("You must specify a file (-f), directory (-d), or glob (-g)"));
      process.exit(1);
    }
    if (specified.length > 1) {
      console.error(chalk.bold.red("Please specify only one of: file (-f), directory (-d), or glob (-g)"));
      process.exit(1);
    }

    const target = options.file || options.dir || options.glob;

    const port = Number(options.port || 4010);


    const reloadSchemas = async () => {
      try {
        const schemas = await loadSchemas(target);
        schemaHandlers = await createSchemaHandlers(schemas, options.seed);
        openApiSpec = generateOpenApiSpec(schemaHandlers);
        const schemaNames = Array.from(schemaHandlers.values()).map(h => h.schemaName).sort();
        console.log(chalk.green(`Loaded ${schemaHandlers.size} schema(s): ${schemaNames.join(', ')}`));
      } catch (error) {
        console.error(chalk.red(`Failed to load schemas: ${error}`));
      }
    };

    await reloadSchemas();
    setupRoutes(fastify);
    const url = `http://localhost:${port}`;
    const labelWidth = 22;
    const serverLabel = chalk.green('Mock server running at:').padEnd(labelWidth);
    const docsLabel = chalk.green('API documentation:').padEnd(labelWidth);
    console.log();
    console.log(chalk.bgGreen.black.bold("  Starting mock API server  "));
    console.log();
    console.log(chalk.bold(`🚀  ${serverLabel} ${chalk.cyan.underline(url)}`));
    console.log(chalk.bold(`📖  ${docsLabel} ${chalk.cyan.underline(url + '/docs')}`));
    console.log();
    console.log(chalk.bold('Available endpoints:'));
    for (const endpoint of Array.from(schemaHandlers.keys()).sort()) {
      console.log(chalk.dim(`  • GET /${endpoint}?limit=N`));
      console.log(chalk.dim(`  • GET /${endpoint}/:id`));
    }
    console.log();

    setupWatcher(target, async () => {
      console.log(chalk.yellow("Schema change detected, reloading..."));
      await reloadSchemas();
      console.log(chalk.bgGreen.black.bold("  Schemas refreshed successfully  "));
    });

    try {
      await fastify.listen({ port });
      console.log(chalk.dim("   Use /<resource>?limit=N to generate multiple items and /<resource>/:id to fetch a single item."));
    } catch (err) {
      console.error(chalk.bold.red(`Failed to start server: ${err}`));
      process.exit(1);
    }
  });

