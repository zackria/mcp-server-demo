import { MongoClient, Db, Filter } from 'mongodb';
import { logger } from './logger';
import { VendorDocument, AccreditationStatus, UpdateVendorStatusResult, ExpiringVendorSummary } from './types';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db();
  logger.info({ event: 'mongodb_connected' });
  return db;
}

export async function pingDb(): Promise<boolean> {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    logger.warn({ event: 'mongodb_ping_failed' });
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info({ event: 'mongodb_closed' });
  }
}

export async function findExpiringVendors(daysAhead: number): Promise<ExpiringVendorSummary[]> {
  const database = await getDb();
  const col = database.collection<VendorDocument>('vendors');

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const results = await col
    .find(
      {
        accreditationStatus: 'Active',
        accreditationExpiryDate: { $gte: now, $lte: until },
      },
      {
        projection: {
          vendorId: 1,
          vendorName: 1,
          accreditationExpiryDate: 1,
          contactEmail: 1,
          _id: 0,
        },
      }
    )
    .sort({ accreditationExpiryDate: 1 })
    .toArray();

  return results.map((doc) => ({
    vendorId: doc.vendorId,
    vendorName: doc.vendorName,
    accreditationExpiryDate: doc.accreditationExpiryDate.toISOString(),
    contactEmail: doc.contactEmail,
  }));
}

export async function findVendorById(vendorId: string): Promise<VendorDocument | null> {
  const database = await getDb();
  const col = database.collection<VendorDocument>('vendors');
  return col.findOne({ vendorId });
}

export async function searchVendors(query: string, category?: string): Promise<VendorDocument[]> {
  const database = await getDb();
  const col = database.collection<VendorDocument>('vendors');

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQuery = escape(query);

  const filter: Filter<VendorDocument> = {
    $or: [
      { vendorName: { $regex: escapedQuery, $options: 'i' } },
      { category: { $regex: escapedQuery, $options: 'i' } },
    ],
  };

  if (category) {
    filter.category = { $regex: escape(category), $options: 'i' };
  }

  return col.find(filter).limit(50).toArray();
}

export async function updateVendorStatus(
  vendorId: string,
  newStatus: AccreditationStatus,
  reason: string
): Promise<UpdateVendorStatusResult> {
  const database = await getDb();
  const col = database.collection<VendorDocument>('vendors');
  const now = new Date();

  // Step 1: Check if vendor exists
  const existing = await col.findOne({ vendorId });
  if (!existing) {
    return { ok: false, code: 'NOT_FOUND', message: `Vendor not found: ${vendorId}` };
  }

  // Step 2: Business rule - check expiry if transitioning to Active
  if (newStatus === 'Active') {
    if (!existing.accreditationExpiryDate || existing.accreditationExpiryDate <= now) {
      const expiryStr = existing.accreditationExpiryDate
        ? existing.accreditationExpiryDate.toISOString()
        : 'unset';
      return {
        ok: false,
        code: 'EXPIRY_NOT_FUTURE',
        message: `Cannot set vendor ${vendorId} to 'Active': accreditationExpiryDate (${expiryStr}) is not in the future. This tool does not accept a new expiry date as a parameter — update accreditationExpiryDate to a future date first, then retry update_accreditation_status.`,
      };
    }
  }

  // Step 3: Perform atomic update with condition re-assertion to close the race window
  const matchFilter: Filter<VendorDocument> =
    newStatus === 'Active' ? { vendorId, accreditationExpiryDate: { $gt: now } } : { vendorId };

  const updated = await col.findOneAndUpdate(
    matchFilter,
    {
      $set: { accreditationStatus: newStatus, updatedAt: now },
      $push: {
        auditLog: {
          timestamp: now,
          previousStatus: existing.accreditationStatus,
          newStatus,
          reason,
        },
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `Vendor ${vendorId} changed concurrently; retry the request.`,
    };
  }

  logger.info({
    event: 'vendor_status_updated',
    vendorId,
    previousStatus: existing.accreditationStatus,
    newStatus,
  });

  return { ok: true, vendor: updated };
}
