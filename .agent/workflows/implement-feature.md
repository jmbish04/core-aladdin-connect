# Feature Implementation Workflow

1. **Schema Definition**: Define new SQLite tables in `src/db/schema.ts` utilizing Drizzle ORM primitives.
2. **Type Generation**: Run `npm run cf-typegen` to emit the latest bindings to `worker-configuration.d.ts`. Ensure `tsconfig.json` consumes this so no local `Env` interface is ever written.
3. **API Routing**: Scaffold standard `@hono/zod-openapi` routes leveraging `c.env.DB` mapping to the newly structured Drizzle operations.
4. **Deploy & Migrate**: Execute `npm run deploy`. This triggers the full pipeline:
   - Builds TypeScript.
   - Generates raw Drizzle `.sql` output.
   - Intercepts `.sql` via `migrate-remote.mjs` to inject `IF NOT EXISTS`.
   - Executes remote Wrangler D1 migration.
   - Pushes the Cloudflare Worker to the edge.
