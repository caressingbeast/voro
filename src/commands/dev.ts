import fs from "fs";
import path from "path";

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import chalk from "chalk";
import chokidar from "chokidar";
import pluralize from "pluralize";
import { Command } from "commander";

import { TypeMocker } from "../utils/mock.js";
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

const createMockGenerator = (schema: Record<string, PropertySpec>) => {
  const mocker = new TypeMocker(schema);
  return () => mocker.mock();
};

type SchemaHandler = {
  schemaName: string;
  generator: () => any;
  idKey: string | null;
};

export const parseCount = (count?: string): number => {
  const parsed = Number(count);
  if (!parsed || parsed <= 0 || Number.isNaN(parsed)) return 5;
  return parsed;
};

export const createSchemaHandlers = (bundles: SchemaBundle[]) => {
  const handlers: Map<string, SchemaHandler> = new Map();

  for (const bundle of bundles) {
    const endpoint = pluralize(bundle.name).toLowerCase();
    const hasId = bundle.schema.hasOwnProperty("id");

    // Prefer later bundles (e.g. later files) to allow overrides.
    handlers.set(endpoint, {
      schemaName: bundle.name,
      generator: createMockGenerator(bundle.schema),
      idKey: hasId ? "id" : null,
    });
  }

  return handlers;
};

let schemaHandlers: Map<string, SchemaHandler> = new Map();
let watching = false;

const setupRoutes = (server: ReturnType<typeof Fastify>) => {
  server.get("/", async () => {
    const endpoints = Array.from(schemaHandlers.keys()).sort();
    return {
      endpoints: endpoints.map((e) => ({
        list: `/${e}`,
        item: `/${e}/:id`,
      })),
    };
  });

  type ListRequest = FastifyRequest<{ Params: { endpoint: string }; Querystring: { count?: string } }>;
  type ItemRequest = FastifyRequest<{ Params: { endpoint: string; id: string } }>;

  server.get("/:endpoint", async (request: ListRequest, reply: FastifyReply) => {
    const { endpoint } = request.params;
    const handler = schemaHandlers.get(endpoint);
    if (!handler) {
      return reply.status(404).send({ error: `Schema "${endpoint}" not found` });
    }

    const count = parseCount(request.query.count);
    return Array.from({ length: count }).map(() => handler.generator());
  });

  server.get("/:endpoint/:id", async (request: ItemRequest, reply: FastifyReply) => {
    const { endpoint, id } = request.params;
    const handler = schemaHandlers.get(endpoint);
    if (!handler) {
      return reply.status(404).send({ error: `Schema "${endpoint}" not found` });
    }

    const result = handler.generator();
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
  .option("-p, --port <port>", "Port to listen on", "4010")
  .action(async (options) => {
    const target = options.file || options.dir;
    if (!target) {
      console.error(chalk.bold.red("You must specify a file (-f) or directory (-d)"));
      process.exit(1);
    }

    const port = Number(options.port || 4010);

    const reloadSchemas = async () => {
      try {
        const schemas = await loadSchemas(target);
        schemaHandlers = createSchemaHandlers(schemas);
        console.log(chalk.green(`Loaded ${schemaHandlers.size} schema(s)`));
      } catch (error) {
        console.error(chalk.red(`Failed to load schemas: ${error}`));
      }
    };

    await reloadSchemas();
    setupRoutes(fastify);
    console.log(chalk.dim("Available endpoints:"));
    for (const endpoint of Array.from(schemaHandlers.keys()).sort()) {
      console.log(chalk.dim(`  GET /${endpoint}`));
      console.log(chalk.dim(`  GET /${endpoint}/:id`));
    }

    setupWatcher(target, async () => {
      console.log(chalk.yellow("Schema change detected, reloading..."));
      await reloadSchemas();
      console.log(chalk.dim("Available endpoints:"));
      for (const endpoint of Array.from(schemaHandlers.keys()).sort()) {
        console.log(chalk.dim(`  GET /${endpoint}`));
        console.log(chalk.dim(`  GET /${endpoint}/:id`));
      }
    });

    try {
      await fastify.listen({ port });
      console.log(chalk.green(`Mock server running at http://localhost:${port}`));
      console.log(chalk.dim("Use /<resource>?count=N to generate multiple items and /<resource>/:id to fetch a single item."));
    } catch (err) {
      console.error(chalk.bold.red(`Failed to start server: ${err}`));
      process.exit(1);
    }
  });

