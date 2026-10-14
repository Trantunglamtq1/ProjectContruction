export type InspectionStatus = 
  | 'Draft' 
  | 'Submitted' 
  | 'UnderReview' 
  | 'Reviewed' 
  | 'Approved' 
  | 'Rejected';

export interface InspectionDto {
  id: string;
  objectId: string;
  objectName: string;
  drawingFileId: string;
  drawingFileName: string;
  drawingPageNumber: number;
  formSchemaId: string;
  formDataJson: string;
  status: InspectionStatus;
  workflowInstanceId?: string | null;
  
  submittedById?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  
  reviewedById?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  
  approvedById?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  
  rejectReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  linkedChecklistItemsCount: number;
  attachments?: InspectionAttachmentDto[];
}

export interface InspectionAttachmentDto {
  originalName: string;
  storedFileName: string;
  fileUrl: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface InspectionAuditHistoryDto {
  id: string;
  inspectionId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  comment?: string | null;
  createdAt: string;
}

export interface FormSchemaItemDto {
  id: string;
  name: string;
  description: string;
  category: string;
  componentsCount: number;
}

export interface ConstructionObjectDto {
  id: string;
  name: string;
  drawingFileId: string;
  drawingFileName?: string;
  pageNumber: number;
  markerCoordinates: string;
  createdById?: string;
  createdAt: string;
}

// FormIO JSON Schema types
export interface FormIoComponentValue {
  label: string;
  value: string;
}

export interface FormIoComponent {
  key: string;
  label: string;
  type: string;
  input?: boolean;
  placeholder?: string;
  defaultValue?: any;
  validate?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  values?: FormIoComponentValue[];
  data?: {
    values?: FormIoComponentValue[];
  };
  components?: FormIoComponent[];
  columns?: Array<{
    components: FormIoComponent[];
    width?: number;
    offset?: number;
    push?: number;
    pull?: number;
    size?: string;
  }>;
  rows?: number;
  format?: string;
  suffix?: string;
  prefix?: string;
  description?: string;
  tooltip?: string;
  disabled?: boolean;
}

export interface FormIoSchema {
  display?: string;
  title?: string;
  name?: string;
  components: FormIoComponent[];
}
