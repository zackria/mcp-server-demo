import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger';
import { findExpiringVendors } from '../db';

export const listExpiringVendorsSchema = {
  daysAhead: z.number().int().positive().max(3650),
} as any;

export async function listExpiringVendorsHandler(args: {
  daysAhead: number;
}): Promise<CallToolResult> {
  const start = Date.now();
  try {
    const vendors = await findExpiringVendors(args.daysAhead);
    const duration = Date.now() - start;

    logger.info({
      event: 'list_expiring_vendors',
      daysAhead: args.daysAhead,
      resultCount: vendors.length,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(vendors, null, 2),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({
      event: 'list_expiring_vendors_error',
      daysAhead: args.daysAhead,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      durationMs: duration,
    });

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Failed to list expiring vendors due to an internal error.',
        },
      ],
    };
  }
}
