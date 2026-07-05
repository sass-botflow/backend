import { WhatsAppSessionStatus } from '@prisma/client';

export interface WhatsAppSessionEntity {
  id: string;
  workspaceId: string;
  instanceName: string;
  displayName: string;
  phoneNumber: string | null;
  status: WhatsAppSessionStatus;
  engine: string;
  createdAt: string;
  updatedAt: string;
}

export function toWhatsAppSessionEntity(session: {
  id: string;
  workspaceId: string;
  instanceName: string;
  displayName: string;
  phoneNumber: string | null;
  status: WhatsAppSessionStatus;
  engine: string;
  createdAt: Date;
  updatedAt: Date;
}): WhatsAppSessionEntity {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    instanceName: session.instanceName,
    displayName: session.displayName,
    phoneNumber: session.phoneNumber,
    status: session.status,
    engine: session.engine,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
