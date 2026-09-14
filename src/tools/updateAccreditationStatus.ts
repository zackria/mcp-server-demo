import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger';
import { updateVendorStatus } from '../db';
import { AccreditationStatus, serializeVendor } from '../types';

export const updateAccreditationStatusSchema = {
  vendorId: z.string().min(1).describe('Stable external vendor identifier'),
  status: z
    .enum(['Active', 'Expired', 'Suspended'])
    .describe('New accreditation status'),
  reason: z
    .string()
    .min(3)
    .max(500)
    .describe('Justification recorded in the audit log'),
};

export async function updateAccreditationStatusHandler(args: {
  vendorId: string;
  status: AccreditationStatus;
  reason: string;
}): Promise<CallToolResult> {
  const start = Date.now();
  try {
    const result = await updateVendorStatus(args.vendorId, args.status, args.reason);
    const duration = Date.now() - start;

    if (!result.ok) {
      logger.warn({
        event: 'update_accreditation_status_rejected',
        vendorId: args.vendorId,
        requestedStatus: args.status,
        code: result.code,
        durationMs: duration,
      });

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: result.message,
          },
        ],
      };
    }

    logger.info({
      event: 'update_accreditation_status_success',
      vendorId: args.vendorId,
      newStatus: args.status,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(serializeVendor(result.vendor), null, 2),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - start;
    logger.error({
      event: 'update_accreditation_status_error',
      vendorId: args.vendorId,
      requestedStatus: args.status,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      durationMs: duration,
    });

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Failed to update accreditation status due to an internal error.',
        },
      ],
    };
  }
}
