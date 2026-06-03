import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';

export interface Env {
  DB: any;
  WORKER_API_KEY: {
    get: () => Promise<string>;
  };
}

const app = new OpenAPIHono<{ Bindings: Env }>();

// 1. D1 Logging Middleware
app.use('*', async (c, next) => {
  await next();
  const statusCode = c.res.status;
  const endpoint = c.req.path;
  const timestamp = new Date().toISOString();

  // Execute logging asynchronously
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'INSERT INTO request_logs (endpoint, timestamp, status_code) VALUES (?1, ?2, ?3)'
    )
      .bind(endpoint, timestamp, statusCode)
      .run()
  );
});

// 2. Strict Security Authentication Middleware
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const targetSecret = await c.env.WORKER_API_KEY.get();

  if (!authHeader || authHeader !== `Bearer ${targetSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

app.use('/api/*', authMiddleware);
app.use('/mcp', authMiddleware);

// 3. Dynamic On-Demand API Documentation
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Aladdin Connect API Worker',
    version: '1.0.0',
  },
});

app.get('/swagger', swaggerUI({ url: '/openapi.json' }));

app.get(
  '/scalar',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
  })
);

// Internal Aladdin Connect Client maintaining AWS API Gateway config mapping
class AladdinConnectClient {
  private static readonly API_HOST = 'pxdqkls7aj.execute-api.us-east-1.amazonaws.com';

  static async initiateAuth(username: string, passwordHash: string) {
    const url = `https://${this.API_HOST}/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthParameters: {
          USERNAME: username,
          PASSWORD: passwordHash,
        },
      }),
    });
    return response.json();
  }

  static async getDevices(accessToken: string) {
    const url = `https://${this.API_HOST}/devices`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.json();
  }
}

// Routes
const aladdinAuthRoute = createRoute({
  method: 'post',
  path: '/api/aladdin/auth',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string().min(1),
            passwordHash: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'Aladdin Connect Authentication Result',
    },
  },
});

app.openapi(aladdinAuthRoute, async (c) => {
  const { username, passwordHash } = c.req.valid('json');

  try {
    const data = await AladdinConnectClient.initiateAuth(username, passwordHash);
    return c.json({ success: true, data }, 200);
  } catch (error) {
    return c.json({ success: false, data: String(error) }, 200);
  }
});

const aladdinDevicesRoute = createRoute({
  method: 'get',
  path: '/api/aladdin/devices',
  request: {
    headers: z.object({
      'aladdin-access-token': z.string().min(1),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'Aladdin Connect Devices List',
    },
  },
});

app.openapi(aladdinDevicesRoute, async (c) => {
  const { 'aladdin-access-token': accessToken } = c.req.valid('header');

  try {
    const data = await AladdinConnectClient.getDevices(accessToken);
    return c.json({ success: true, data }, 200);
  } catch (error) {
    return c.json({ success: false, data: String(error) }, 200);
  }
});

const mcpRoute = createRoute({
  method: 'get',
  path: '/mcp',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
          }),
        },
      },
      description: 'MCP Status',
    },
  },
});

app.openapi(mcpRoute, (c) => {
  return c.json({ status: 'ok' }, 200);
});

export default app;
