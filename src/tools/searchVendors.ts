import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger';
import { searchVendors } from '../db';
import { serializeVendor } from '../types';

export const searchVendorsSchema = {
  query: z
    .string()
    .min(1)
    .max(200)
    .describe('Free-text term matched against vendor name and category'),
  category: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional additional category filter (partial, case-insensitive)'),
};

export async function searchVendorsHandler(args: {
  query: string;
  category?: string;
}): Promise<CallToolResult> {
  const start = Date.now();
  try {
    const vendors = await searchVendors(args.query, args.category);
    const duration = Date.now() - start;

    logger.info({
      event: 'search_vendors',
      queryLength: args.query.length,
      hasCategoryFilter: !!args.category,
      resultCount: vendors.length,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(vendors.map(serializeVendor), null, 2),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({
      event: 'search_vendors_error',
      queryLength: args.query.length,
      hasCategoryFilter: !!args.category,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      durationMs: duration,
    });

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Failed to search vendors due to an internal error.',
        },
      ],
    };
  }
}
