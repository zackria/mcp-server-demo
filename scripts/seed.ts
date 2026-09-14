import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface Vendor {
  vendorId: string;
  vendorName: string;
  category: string;
  contactEmail: string;
  accreditationStatus: 'Active' | 'Expired' | 'Suspended';
  accreditationExpiryDate: Date;
  auditLog: Array<{
    timestamp: Date;
    previousStatus: string;
    newStatus: string;
    reason: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    logger.info({ event: 'connected_to_mongodb' });

    const db = client.db();
    const col = db.collection<Vendor>('vendors');

    // Create collection if it doesn't exist
    await db.createCollection('vendors').catch(() => {
      // Collection already exists
    });

    // Create indexes
    await col.createIndex({ vendorId: 1 }, { unique: true });
    await col.createIndex({ accreditationStatus: 1, accreditationExpiryDate: 1 });
    await col.createIndex({ category: 1 });
    logger.info({ event: 'indexes_created' });

    // Sample vendors
    const now = new Date();
    const vendors: Vendor[] = [
      {
        vendorId: randomUUID(),
        vendorName: 'TechCorp Solutions',
        category: 'Software & IT Services',
        contactEmail: 'vendor1@techcorp.com',
        accreditationStatus: 'Active',
        accreditationExpiryDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        auditLog: [
          {
            timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            previousStatus: 'Suspended',
            newStatus: 'Active',
            reason: 'Reaccredited after compliance review',
          },
        ],
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        vendorId: randomUUID(),
        vendorName: 'Global Supplies Inc',
        category: 'Office Supplies',
        contactEmail: 'vendor2@globalsupplies.com',
        accreditationStatus: 'Active',
        accreditationExpiryDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
        auditLog: [
          {
            timestamp: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
            previousStatus: 'Expired',
            newStatus: 'Active',
            reason: 'Renewed accreditation',
          },
        ],
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      },
      {
        vendorId: randomUUID(),
        vendorName: 'BuildRight Construction',
        category: 'Construction & Materials',
        contactEmail: 'vendor3@buildright.com',
        accreditationStatus: 'Active',
        accreditationExpiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        auditLog: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        vendorId: randomUUID(),
        vendorName: 'ProServices Ltd',
        category: 'Professional Services',
        contactEmail: 'vendor4@proservices.com',
        accreditationStatus: 'Expired',
        accreditationExpiryDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        auditLog: [
          {
            timestamp: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            previousStatus: 'Active',
            newStatus: 'Expired',
            reason: 'Accreditation expired',
          },
        ],
        createdAt: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      },
      {
        vendorId: randomUUID(),
        vendorName: 'SafeGuard Industries',
        category: 'Safety & Compliance',
        contactEmail: 'vendor5@safeguard.com',
        accreditationStatus: 'Suspended',
        accreditationExpiryDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        auditLog: [
          {
            timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            previousStatus: 'Active',
            newStatus: 'Suspended',
            reason: 'Pending investigation of compliance violation',
          },
        ],
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        vendorId: randomUUID(),
        vendorName: 'QuickShip Logistics',
        category: 'Logistics & Transportation',
        contactEmail: 'vendor6@quickship.com',
        accreditationStatus: 'Active',
        accreditationExpiryDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        auditLog: [
          {
            timestamp: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
            previousStatus: 'Expired',
            newStatus: 'Active',
            reason: 'Reaccreditation processed',
          },
        ],
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    ];

    await col.deleteMany({});
    const result = await col.insertMany(vendors);
    logger.info({
      event: 'seed_complete',
      inserted: result.insertedCount,
      indexes: ['vendorId (unique)', 'accreditationStatus+accreditationExpiryDate', 'category'],
    });
  } catch (error) {
    logger.error({
      event: 'seed_error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
