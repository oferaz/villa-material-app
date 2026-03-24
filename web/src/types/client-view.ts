export type ClientViewStatus = 'draft' | 'published' | 'closed' | 'revoked' | 'expired';

export type ClientViewCardMode = 'material_choice' | 'budget_input' | 'scope_confirmation';

export type ClientViewScopeDecision = 'approved' | 'not_needed' | 'needs_revision';

export interface ClientViewItemOption {
  id: string;
  sourceMaterialId?: string;
  name: string;
  supplierName?: string;
  imageUrl?: string;
  price?: number | null;
  description?: string;
  sourceUrl?: string;
  sortOrder: number;
}

export interface ClientViewItem {
  id: string;
  roomObjectId?: string;
  houseName: string;
  roomName: string;
  objectName: string;
  objectCategory: string;
  quantity: number;
  cardMode: ClientViewCardMode;
  promptText?: string;
  showSourceLink: boolean;
  budgetAllowance?: number | null;
  currentSelectedMaterialName?: string;
  currentSelectedPrice?: number | null;
  options: ClientViewItemOption[];
}

export interface ClientViewRecipient {
  id?: string;
  email: string;
}

export interface ClientViewResponse {
  id: string;
  itemId: string;
  publishedVersion: number;
  recipientEmail: string;
  selectedOptionId?: string | null;
  preferredBudget?: number | null;
  scopeDecision?: ClientViewScopeDecision | null;
  comment?: string;
  appliedAt?: string | null;
  updatedAt: string;
  itemLabel?: string;
  selectedOptionName?: string;
}

export interface ClientViewBudgetOverview {
  totalBudget?: number | null;
  allocatedAmount: number;
  remainingAmount?: number | null;
  currency?: string | null;
}

export interface ClientViewProgressOverview {
  totalItems: number;
  completionPercent: number;
  actionsCompleted: number;
  actionsTotal: number;
  actionsRemaining: number;
  stages: {
    materialMissing: number;
    materialAssigned: number;
    poApproved: number;
    ordered: number;
    installed: number;
  };
}

export interface ClientViewProjectOverview {
  projectName: string;
  housesCount: number;
  roomsCount: number;
  itemsCount: number;
  budget: ClientViewBudgetOverview;
  progress: ClientViewProgressOverview;
}

export interface ClientViewHouseOverview {
  houseId?: string;
  houseName: string;
  roomsCount: number;
  itemsCount: number;
  budget: ClientViewBudgetOverview;
  progress: ClientViewProgressOverview;
}

export interface ClientViewSummary {
  id: string;
  projectId: string;
  title: string;
  status: ClientViewStatus;
  publishedVersion: number;
  publishedAt?: string | null;
  expiresAt?: string | null;
  showProjectOverview: boolean;
  showHouseOverviews: boolean;
  projectOverview?: ClientViewProjectOverview | null;
  houseOverviews: ClientViewHouseOverview[];
}

export interface ClientViewDetail extends ClientViewSummary {
  recipients: ClientViewRecipient[];
  items: ClientViewItem[];
}

export interface ClientViewPublishItemInput {
  roomObjectId: string;
  cardMode: ClientViewCardMode;
  promptText?: string;
  showSourceLink?: boolean;
  optionMaterialIds?: string[];
}

export interface ClientViewPublishInput {
  title: string;
  expiresAt?: string | null;
  recipientEmails: string[];
  showProjectOverview?: boolean;
  showHouseOverviews?: boolean;
  items: ClientViewPublishItemInput[];
}

export interface ClientViewApplyResult {
  responseId: string;
  itemId: string;
  action: string;
  appliedAt: string;
}

export interface ClientViewSubmissionContextResponse {
  id: string;
  itemId: string;
  publishedVersion: number;
  selectedOptionId?: string | null;
  preferredBudget?: number | null;
  scopeDecision?: ClientViewScopeDecision | null;
  comment?: string;
  appliedAt?: string | null;
  updatedAt: string;
}

export interface ClientViewSubmissionContext {
  clientViewId: string;
  publishedVersion: number;
  userEmail: string;
  canSubmit: boolean;
  responses: ClientViewSubmissionContextResponse[];
}
