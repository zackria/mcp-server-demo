import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger';
import { findVendorById } from '../db';
import { serializeVendor } from '../types';

export const getVendorSchema = {
  vendorId: z.string().min(1).describe("Stable external vendor identifier (not MongoDB's ObjectId)"),
};

export async function getVendorHandler(args: { vendorId: string }): Promise<CallToolResult> {
  const start = Date.now();
  try {
    const vendor = await findVendorById(args.vendorId);
    const duration = Date.now() - start;

    if (!vendor) {
      logger.info({
        event: 'get_vendor_not_found',
        vendorId: args.vendorId,
        durationMs: duration,
      });

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Vendor not found: ${args.vendorId}`,
          },
        ],
      };
    }

    logger.info({
      event: 'get_vendor_success',
      vendorId: args.vendorId,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(serializeVendor(vendor), null, 2),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({
      event: 'get_vendor_error',
      vendorId: args.vendorId,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      durationMs: duration,
    });

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Failed to retrieve vendor due to an internal error.',
        },
      ],
    };
  }
}
