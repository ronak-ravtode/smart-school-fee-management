import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  timestamp: Date;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    timestamp: { type: Date, default: Date.now },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    reason: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: false }
);

auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
