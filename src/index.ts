import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';
import { drizzle } from 'drizzle-orm/d1';
import { users } from './db/schema';

// NOTE: We do not redefine `interface Env` or import it.
// `Env` is automatically sourced from the globally generated `worker-configuration.d.ts`
const app = new OpenAPIHono<{ Bindings: Env }>();

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Colby Application API',
    version: '1.0.0',
  },
});

app.get('/swagger', swaggerUI({ url: '/openapi.json' }));
app.get('/scalar', apiReference({ spec: { url: '/openapi.json' } }));

app.get('/api/health', async (c) => {
  const db = drizzle(c.env.DB);

  // Verify D1 binding and query execution
  const dbCheck = await db.select().from(users).limit(1);

  return c.json({
    status: 'ok',
    edge_network: 'Cloudflare',
    d1_connected: true
  });
});

export default app;
