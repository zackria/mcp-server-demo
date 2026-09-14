import { ObjectId } from 'mongodb';

export type AccreditationStatus = 'Active' | 'Expired' | 'Suspended';

export interface AuditLogEntry {
  timestamp: Date;
  previousStatus: AccreditationStatus;
  newStatus: AccreditationStatus;
  reason: string;
}

export interface VendorDocument {
  _id?: ObjectId;
  vendorId: string;
  vendorName: string;
  category: string;
  contactEmail: string;
  accreditationStatus: AccreditationStatus;
  accreditationExpiryDate: Date;
  auditLog: AuditLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorResponse {
  vendorId: string;
  vendorName: string;
  category: string;
  contactEmail: string;
  accreditationStatus: AccreditationStatus;
  accreditationExpiryDate: string;
  auditLog: Array<{
    timestamp: string;
    previousStatus: AccreditationStatus;
    newStatus: AccreditationStatus;
    reason: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpiringVendorSummary {
  vendorId: string;
  vendorName: string;
  accreditationExpiryDate: string;
  contactEmail: string;
}

export type UpdateVendorStatusResult =
  | { ok: true; vendor: VendorDocument }
  | { ok: false; code: 'NOT_FOUND' | 'EXPIRY_NOT_FUTURE' | 'CONFLICT'; message: string };

export function serializeVendor(doc: VendorDocument): VendorResponse {
  return {
    vendorId: doc.vendorId,
    vendorName: doc.vendorName,
    category: doc.category,
    contactEmail: doc.contactEmail,
    accreditationStatus: doc.accreditationStatus,
    accreditationExpiryDate: doc.accreditationExpiryDate.toISOString(),
    auditLog: doc.auditLog.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
