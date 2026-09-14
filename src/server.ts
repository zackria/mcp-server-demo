import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './logger';
import { getDb, closeDb, pingDb } from './db';
import { listExpiringVendorsSchema, listExpiringVendorsHandler } from './tools/listExpiringVendors';
import { getVendorSchema, getVendorHandler } from './tools/getVendor';
import { updateAccreditationStatusSchema, updateAccreditationStatusHandler } from './tools/updateAccreditationStatus';
import { searchVendorsSchema, searchVendorsHandler } from './tools/searchVendors';

const app: Express = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: 'vendor-accreditation-mcp',
    version: '1.0.0',
  });

  server.registerTool('list_expiring_vendors', { title: 'List Expiring Vendors', description: 'Returns vendors whose accreditation will expire within the next N days' }, listExpiringVendorsSchema, listExpiringVendorsHandler);

  server.registerTool(
    'get_vendor',
    {
      title: 'Get Vendor Details',
      description: 'Retrieves the full vendor record including accreditation status and audit history',
    },
    getVendorSchema,
    getVendorHandler
  );

  server.registerTool(
    'update_accreditation_status',
    {
      title: 'Update Accreditation Status',
      description:
        'Updates a vendor\'s accreditation status and records an audit log entry. Requires accreditationExpiryDate to be in the future if setting status to \'Active\'.',
    },
    updateAccreditationStatusSchema,
    updateAccreditationStatusHandler
  );

  server.registerTool(
    'search_vendors',
    {
      title: 'Search Vendors',
      description: 'Performs free-text search across vendor names and categories',
    },
    searchVendorsSchema,
    searchVendorsHandler
  );

  return server;
}

// Health check endpoint — separate from MCP transport
app.get('/healthz', async (_req: Request, res: Response) => {
  try {
    const isHealthy = await pingDb();
    if (isHealthy) {
      logger.debug({ event: 'healthz_ok' });
      res.status(200).json({ status: 'ok' });
    } else {
      logger.warn({ event: 'healthz_mongodb_unavailable' });
      res.status(503).json({ status: 'error', reason: 'mongodb_unavailable' });
    }
  } catch (error) {
    logger.error({
      event: 'healthz_error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });
    res.status(503).json({ status: 'error' });
  }
});

// MCP HTTP transport endpoint (stateless)
app.post('/mcp', async (req: Request, res: Response) => {
  const start = Date.now();
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    const duration = Date.now() - start;

    logger.info({
      event: 'mcp_request',
      method: 'POST',
      path: '/mcp',
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({
      event: 'mcp_request_error',
      method: 'POST',
      path: '/mcp',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      durationMs: duration,
    });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  } finally {
    try {
      await transport.close();
    } catch {
      // Ignore errors during transport cleanup
    }
  }
});

// Stateless-only: return 405 for other methods
app.get('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Method not allowed. This server is stateless-only; SSE and session resumption are not supported.' });
});

app.delete('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Method not allowed. This server is stateless-only; SSE and session resumption are not supported.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  logger.info({ event: 'server_started', port, environment: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown on SIGTERM (Cloud Run scale-down / deploy)
process.on('SIGTERM', async () => {
  logger.info({ event: 'sigterm_received' });
  await closeDb();
  server.close(() => {
    logger.info({ event: 'server_closed' });
    process.exit(0);
  });
});

// TODO(auth): No request-level authentication is implemented yet.
// Cloud Run IAM (--no-allow-unauthenticated) is the only current perimeter.
// Before this service is exposed to any non-trivial production traffic or if
// --allow-unauthenticated is ever used, add bearer-token or IAM-identity
// validation here, checking the request's Authorization header or Cloud Run
// identity context. See README "Follow-up: Authentication" for details.
