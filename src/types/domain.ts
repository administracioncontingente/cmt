import type { FinancialSummary } from '@/lib/finance';

export type EventRole = 'EVENT_ADMIN' | 'TREASURER' | 'COORDINATOR' | 'MEDICAL_STAFF' | 'VIEWER';
export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type DetailTab = 'finance' | 'profile' | 'logistics' | 'medical' | 'communications' | 'incidents';

export interface EventPermissions {
  isSuperAdmin: boolean;
  isEventAdmin: boolean;
  canManageFinance: boolean;
  canManageMedical: boolean;
  canEditParticipants: boolean;
  canManageCrm: boolean;
  canDeleteParticipants: boolean;
  canView: boolean;
  role: 'SUPER_ADMIN' | EventRole | 'NONE';
  title: string;
}

export interface EventRoleInfoDTO {
  eventId: string;
  eventCode: string;
  eventName: string;
  shortName?: string | null;
  flagEmoji?: string | null;
  role: string;
  title?: string | null;
}

export interface UserSessionDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  eventRoles?: EventRoleInfoDTO[];
}

export interface EventSummary {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  type?: string;
  description?: string | null;
  country?: string | null;
  city?: string | null;
  flagEmoji?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  currency: string;
  isActive?: boolean;
  isDefault?: boolean;
  themeColor?: string | null;
  accentColor?: string | null;
  bannerUrl?: string | null;
  userRole?: string;
  userTitle?: string;
  isActiveSelection?: boolean;
  _count?: {
    participants?: number;
    memberships?: number;
    plans?: number;
  };
}

export interface TeamMemberDTO {
  id: string;
  userId: string;
  eventId: string;
  role: string;
  title?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface InstallmentDTO {
  id: string;
  planId?: string;
  installmentNumber: number;
  title: string;
  dueDate: string | Date;
  amount: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface PaymentPlanDTO {
  id: string;
  eventId?: string | null;
  roleKey: string;
  name: string;
  totalAmount: number;
  currency: string;
  description?: string | null;
  installments?: InstallmentDTO[];
  _count?: {
    participants?: number;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface EventDetail extends EventSummary {
  plans?: PaymentPlanDTO[];
  memberships?: TeamMemberDTO[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface PaymentDTO {
  id: string;
  participantId: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: string;
  transactionReference?: string | null;
  receiptUrl?: string | null;
  filloutSubmissionId?: string | null;
  source?: string | null;
  notes?: string | null;
  registeredById?: string | null;
  registeredBy?: {
    id?: string;
    name: string;
    email: string;
  } | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface MedicalRecordDTO {
  id?: string;
  participantId?: string;
  qrAccessCode?: string;
  bloodType?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactEmail?: string | null;
  insuranceCompany?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceEmergencyPhone?: string | null;
  hasSevereAllergies?: boolean;
  carriesEpiPen?: boolean;
  allergiesES?: string | null;
  allergiesEN?: string | null;
  allergiesPL?: string | null;
  hasChronicConditions?: boolean;
  chronicConditionsES?: string | null;
  chronicConditionsEN?: string | null;
  chronicConditionsPL?: string | null;
  takesRegularMedication?: boolean;
  requiresColdChainMedication?: boolean;
  currentMedicationsES?: string | null;
  currentMedicationsEN?: string | null;
  currentMedicationsPL?: string | null;
  dietaryRestrictionsES?: string | null;
  dietaryRestrictionsEN?: string | null;
  dietaryRestrictionsPL?: string | null;
  tetanusLastDoseYear?: string | null;
  vaccinationRecordsES?: string | null;
  vaccinationRecordsEN?: string | null;
  vaccinationRecordsPL?: string | null;
  pastSurgeriesInjuriesES?: string | null;
  pastSurgeriesInjuriesEN?: string | null;
  pastSurgeriesInjuriesPL?: string | null;
  devicesImplantsES?: string | null;
  devicesImplantsEN?: string | null;
  devicesImplantsPL?: string | null;
  physicalLimitationsES?: string | null;
  physicalLimitationsEN?: string | null;
  physicalLimitationsPL?: string | null;
  emergencyTreatmentConsent?: boolean;
  declaredByName?: string | null;
  declaredByRut?: string | null;
  declaredByRole?: string | null;
  declaredAt?: string | Date | null;
  completionStatus: string;
  lastUpdatedIp?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ParticipantReferenceDTO {
  id: string;
  rut: string;
  firstName: string;
  lastName: string;
  contingentRole?: string;
  unitName?: string | null;
  cupoCode?: string | null;
  email?: string;
  phone?: string | null;
}

export interface IncidentReferenceDTO {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
}

export interface EmailMessageDTO {
  id: string;
  eventId?: string;
  accountId?: string | null;
  googleMessageId?: string | null;
  googleThreadId?: string | null;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail?: string | null;
  subject: string;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  date: string | Date;
  hasAttachments: boolean;
  labels?: string | null;
  participantId?: string | null;
  participant?: ParticipantReferenceDTO | null;
  matchMethod?: string | null;
  ticketId?: string | null;
  ticket?: IncidentReferenceDTO | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IncidentCommentDTO {
  id: string;
  incidentId?: string;
  userId?: string | null;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: string | Date;
}

export interface IncidentDTO {
  id: string;
  ticketNumber: string;
  eventId: string;
  participantId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdById?: string | null;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  participant?: ParticipantReferenceDTO;
  comments?: IncidentCommentDTO[];
  messages?: EmailMessageDTO[];
  _count?: {
    messages?: number;
    comments?: number;
  };
}

export interface ParticipantDTO {
  id: string;
  eventId?: string | null;
  rut: string;
  rutClean?: string | null;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  email?: string;
  phone?: string | null;
  birthDate?: string | Date | null;
  gender?: string | null;
  address?: string | null;
  commune?: string | null;
  city?: string | null;
  nationality?: string | null;
  secondNationality?: string | null;
  idCardUrl?: string | null;
  previousEvents?: string | null;
  dietaryRestrictions?: string | null;
  medicalNotes?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  scoutZone?: string | null;
  scoutDistrict?: string | null;
  scoutGroup?: string | null;
  scoutCurrentRole?: string | null;
  scoutTrainingLevel?: string | null;
  scoutMemberNumber?: string | null;
  groupLeaderName?: string | null;
  groupLeaderEmail?: string | null;
  groupLeaderPhone?: string | null;
  activeRegistrations?: string | null;
  contingentRole?: string;
  status?: string;
  unitOrPatrol?: string | null;
  cupoCode?: string | null;
  territorium?: string | null;
  unit?: string | null;
  unitName?: string | null;
  patrol?: string | null;
  patrolName?: string | null;
  patrolCode?: string | null;
  uniformSize?: string | null;
  polandRegistered?: string | null;
  feeType?: string | null;
  feeEnrollmentType?: string | null;
  calendarUrl?: string | null;
  totalPaidSheet?: number | null;
  targetFeeUSD?: number | null;
  dueToDateUSD?: number | null;
  debtFinalUSD?: number | null;
  debtToDateUSD?: number | null;
  overpaymentUSD?: number | null;
  financialStatusSheet?: string | null;
  planId?: string | null;
  plan?: PaymentPlanDTO | null;
  payments?: PaymentDTO[];
  medicalRecord?: MedicalRecordDTO | null;
  emailMessages?: EmailMessageDTO[];
  incidents?: IncidentDTO[];
  kitSizes?: ParticipantKitSizeDTO[];
  financial?: FinancialSummary;
  notes?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface DashboardStatsDTO {
  summary: {
    totalParticipants: number;
    totalRegistered?: number;
    totalProjectedUSD: number;
    totalCollectedUSD: number;
    bajaCollectedUSD?: number;
    totalOutstandingUSD: number;
    totalOverdueUSD: number;
    countAlDia: number;
    countEnMora: number;
    countCompletado: number;
    countBaja: number;
    roleCounts: Record<string, number>;
    statusCounts: Record<string, number>;
  };
  event: EventSummary | null;
  permissions: EventPermissions | null;
  totalParticipants: number;
  totalProjectedUSD: number;
  totalCollectedUSD: number;
  totalOutstandingUSD: number;
  totalOverdueUSD: number;
  collectionPercentage: number;
  currency: string;
  financialSummary: {
    completado: number;
    alDia: number;
    enMora: number;
    baja: number;
  };
  roleBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  medicalSummary: {
    completadas: number;
    pendientes: number;
    alergiasSeveras: number;
    portaEpiPen: number;
    cadenaFrio: number;
  };
}

export interface ImportErrorRow {
  row: number;
  rut?: string;
  reason: string;
}

export interface ImportResultDTO {
  success: boolean;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  errorsCount: number;
  errors: ImportErrorRow[];
}

export interface PaymentLedgerItemDTO extends PaymentDTO {
  participant: ParticipantReferenceDTO;
}

export interface PaymentsLedgerSummaryDTO {
  totalAmount: number;
  totalCount: number;
  filloutCount: number;
  portalCount?: number;
  withReceiptCount: number;
  last30DaysAmount: number;
  sourceCounts: Record<string, number>;
}

export interface PublicEventDTO {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  flagEmoji?: string | null;
  currency: string;
  country?: string | null;
  city?: string | null;
  isDefault?: boolean;
}

export interface PublicParticipantLookupDTO {
  found: boolean;
  maskedName?: string;
  scoutGroup?: string | null;
  unitName?: string | null;
  cupoCode?: string | null;
  roleLabel?: string;
  error?: string;
}

export interface GroupAllocationInputDTO {
  rut: string;
  participantId?: string;
  amount: number;
  groupName?: string;
}

export interface PaymentsLedgerResponseDTO {
  payments: PaymentLedgerItemDTO[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: PaymentsLedgerSummaryDTO;
  currency: string;
}

export interface ParticipantsListResponseDTO {
  participants: ParticipantDTO[];
  count: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KitSizeGuideRow {
  size: string;
  chestCm?: string;
  lengthCm?: string;
  waistCm?: string;
  hipCm?: string;
  sleeveCm?: string;
  headCm?: string;
  neckCm?: string;
  note?: string;
}

export interface EventKitItemDTO {
  id: string;
  eventId: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  availableSizes: string[];
  availableFits: string[];
  sizeGuide: KitSizeGuideRow[];
  includedQuantity: number;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ParticipantKitSizeDTO {
  id?: string;
  kitItemId: string;
  size: string;
  fit?: string | null;
  notes?: string | null;
  confirmedAt?: string | Date;
  updatedAt?: string | Date;
  kitItem?: {
    id: string;
    code: string;
    name: string;
    category: string;
    includedQuantity: number;
  };
}

export interface PortalHouseholdMemberDTO {
  id: string;
  rut: string;
  firstName: string;
  lastName: string;
  contingentRole: string;
  eventName?: string | null;
  eventCode?: string | null;
}

export interface PortalMeResponseDTO {
  participant: ParticipantDTO;
  event: PublicEventDTO | null;
  household: PortalHouseholdMemberDTO[];
  kitItems: EventKitItemDTO[];
  kitSizes: ParticipantKitSizeDTO[];
  qrEmergencyUrl?: string | null;
  qrDataUrl?: string | null;
  sessionEmail: string;
}

export interface KitMatrixCellDTO {
  size: string;
  fit: string;
  count: number;
  units: number;
}

export interface KitItemSummaryDTO {
  item: EventKitItemDTO;
  totalConfirmedParticipants: number;
  totalUnits: number;
  breakdown: KitMatrixCellDTO[];
}

export interface KitParticipantRowDTO {
  id: string;
  rut: string;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  contingentRole: string;
  scoutGroup?: string | null;
  unitName?: string | null;
  cupoCode?: string | null;
  uniformSize?: string | null;
  kitStatus: 'COMPLETED' | 'PARTIAL' | 'PENDING';
  selections: ParticipantKitSizeDTO[];
}

export interface KitMatrixSummaryDTO {
  items: EventKitItemDTO[];
  totalsByItem: KitItemSummaryDTO[];
  completedParticipants: number;
  partialParticipants: number;
  pendingParticipants: number;
  totalActiveParticipants: number;
  participants: KitParticipantRowDTO[];
}
