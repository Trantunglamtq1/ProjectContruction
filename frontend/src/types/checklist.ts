export type ChecklistStatus =
  | 'Draft'
  | 'PendingSupervisor'
  | 'Approved'
  | 'Rejected'
  | 'InProgress'
  | 'Completed';

export type ChecklistItemStatus = 'Pending' | 'Done';

export interface ChecklistItemDto {
  id: string;
  checklistId: string;
  name: string;
  orderIndex: number;
  isRequired: boolean;
  formSchemaJson: string;
  linkedInspectionId: string | null;
  linkedInspectionStatus?: string | null;
  status: ChecklistItemStatus;
  rowVersion?: string;
}

export interface ChecklistAuditHistoryDto {
  id: string;
  checklistId: string;
  action: string;
  actorName: string;
  actorRole: string;
  fromStatus: string;
  toStatus: string;
  comment?: string;
  timestamp: string;
}

export interface ChecklistDto {
  id: string;
  objectId: string;
  objectName: string;
  objectCode: string;
  name: string;
  description?: string;
  status: ChecklistStatus;
  workflowInstanceId?: string;
  rejectReason?: string;
  createdById?: string;
  createdBy: string;
  createdAt: string;
  reviewedById?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  canFillInspection: boolean;
  itemsCount: number;
  itemsCompletedCount: number;
  progressPercentage: number;
  items: ChecklistItemDto[];
  auditHistories: ChecklistAuditHistoryDto[];
  rowVersion?: string;
}

export interface ChecklistSummaryDto {
  objectId: string;
  objectName: string;
  objectCode: string;
  totalChecklists: number;
  approvedChecklists: number;
  totalItems: number;
  completedItems: number;
  overallProgressPercentage: number;
  checklists: ChecklistDto[];
}

export interface CreateChecklistPayload {
  objectId: string;
  name: string;
  description?: string;
  items?: Array<{
    name: string;
    orderIndex?: number;
    isRequired?: boolean;
    formSchemaJson?: string;
  }>;
}

export interface SubmitChecklistPayload {
  comment?: string;
}

export interface SupervisorApprovePayload {
  comment?: string;
}

export interface SupervisorRejectPayload {
  reason: string;
}

export interface SupervisorModifyPayload {
  name?: string;
  description?: string;
  comment?: string;
  items?: Array<{
    id?: string;
    name: string;
    orderIndex?: number;
    isRequired?: boolean;
    formSchemaJson?: string;
  }>;
}

export interface AddChecklistItemPayload {
  name: string;
  orderIndex?: number;
  isRequired?: boolean;
  formSchemaJson?: string;
}

export interface UpdateChecklistItemPayload {
  name: string;
  orderIndex?: number;
  isRequired?: boolean;
  formSchemaJson?: string;
}

export interface LinkInspectionPayload {
  inspectionId: string;
}
