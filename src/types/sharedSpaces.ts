// ─── Shared Spaces — Types & Interfaces ────────────────────────────────────

// ── Enums ───────────────────────────────────────────────────────────────────

export type SpaceType = 'pareja' | 'grupo' | 'viaje' | 'familia' | 'custom';
export type SpaceStatus = 'activo' | 'archivado';
export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'invited' | 'active' | 'left' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';
export type MovementType = 'expense' | 'income' | 'adjustment' | 'planned' | 'recurring' | 'goal_contribution';
export type MovementStatus = 'draft' | 'published' | 'cancelled' | 'corrected';
export type SplitMode = 'equal' | 'percentage' | 'fixed' | 'participants_only' | 'units' | 'custom';
export type Visibility = 'all' | 'admins_only' | 'creator_only';
export type ImpactDestinationType = 'main_account' | 'subaccount';
export type ImpactType = 'income' | 'expense' | 'adjustment';
export type ImpactStatus = 'pending' | 'applied' | 'reverted' | 'failed' | 'outdated';

export type SharedNotificationType =
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_rejected'
  | 'invitation_revoked'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'role_changed'
  | 'movement_created'
  | 'movement_edited'
  | 'movement_cancelled'
  | 'impact_applied'
  | 'impact_reverted'
  | 'impact_failed'
  | 'space_updated'
  | 'space_archived';

// ── Core Models ─────────────────────────────────────────────────────────────

export interface SpaceConfig {
  splitDefaultMode: SplitMode;
  allowAccountImpact: boolean;
  maxMembers: number;
  requireApproval: boolean;
  allowCategories: boolean;
  allowRecurring: boolean;
}

export interface SharedSpace {
  spaceId: string;
  ownerUserId: string;
  nombre: string;
  tipo: SpaceType;
  monedaBase: string;
  estado: SpaceStatus;
  configuracion: SpaceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SharedSpaceMember {
  memberId: string;
  spaceId: string;
  userId: string;
  rol: MemberRole;
  estado: MemberStatus;
  alias: string;
  nombreCompleto?: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface SharedInvitation {
  invitationId: string;
  spaceId: string;
  spaceName?: string;
  invitedUserId?: string;
  email?: string;
  estado: InvitationStatus;
  message?: string;
  expiresAt: string;
  createdAt?: string;
  // Link / QR invitation fields
  invitationType?: 'direct' | 'email' | 'link';
  shareUrl?: string;
  deepLink?: string;
  multiUse?: boolean;
  acceptedCount?: number;
  rol?: string;
}

export interface SharedCategory {
  categoryId: string;
  spaceId: string;
  nombre: string;
  icono: string;
  color: string;
  isSystem?: boolean;
}

export interface SharedMovementContribution {
  contributionId?: string;
  movementId?: string;
  memberId: string;
  userId?: string;
  amountContributed: number;
  contributionType: 'payer' | 'shared_source' | 'manual';
}

export interface SharedMovementSplit {
  splitId?: string;
  movementId?: string;
  memberId: string;
  userId?: string;
  included: boolean;
  amountAssigned?: number;
  percentage?: number;
  units?: number;
  roleInSplit?: 'consumer' | 'beneficiary' | 'participant';
}

export interface AccountImpactConfig {
  enabled: boolean;
  destinationType: ImpactDestinationType;
  destinationId: string;
  impactType: ImpactType;
  afectaSaldo: boolean;
}

export interface AccountImpactResult {
  impactId: string;
  movementId: string;
  userId: string;
  destinationType: ImpactDestinationType;
  destinationId: string;
  impactType: ImpactType;
  amount: number;
  moneda: string;
  status: ImpactStatus;
  appliedAt?: string;
  conversionMeta?: {
    monedaOrigen: string;
    monedaDestino: string;
    tasaConversion: number;
    montoConvertido: number;
    fechaConversion: string;
  } | null;
}

export interface SharedMovement {
  movementId: string;
  spaceId: string;
  createdByUserId: string;
  createdByMemberId: string;
  tipo: MovementType;
  titulo: string;
  descripcion?: string;
  categoriaId?: string;
  montoTotal: number;
  moneda: string;
  fechaMovimiento: string;
  splitMode: SplitMode;
  visibility: Visibility;
  estado: MovementStatus;
  hasAccountImpact: boolean;
  notes?: string;
  tags?: string[];
  cancelledAt?: string;
  cancelledBy?: string;
  idempotencyKey?: string;
  createdAt?: string;
}

export interface MemberDifference {
  memberId: string;
  userId: string;
  contributed: number;
  assigned: number;
  difference: number;
}

export interface SharedMovementDetail {
  movement: SharedMovement;
  contributions: SharedMovementContribution[];
  splits: SharedMovementSplit[];
  impacts?: AccountImpactResult[];
  memberDifferences: MemberDifference[];
}

export interface SharedSplitRule {
  ruleId: string;
  spaceId: string;
  nombre: string;
  tipo: SplitMode;
  scope: 'default' | 'category' | 'movement_template';
  config: Record<string, number>;
  estado?: string;
}

// ── Notification ────────────────────────────────────────────────────────────

export interface SharedNotification {
  notificationId: string;
  userId: string;
  spaceId?: string;
  type: SharedNotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  actorUserId?: string;
  createdAt: string;
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface SpaceAnalyticsSummary {
  spaceId: string;
  period: { from: string; to: string };
  movementCount: number;
  totalExpenses: number;
  totalIncome: number;
  totalAdjustments: number;
  netAmount: number;
  bySplitMode: Record<string, number>;
}

export interface MemberAnalytics {
  memberId: string;
  userId: string;
  totalContributed: number;
  totalAssigned: number;
  difference: number;
  movementsCreated: number;
  movementsInvolved: number;
}

export interface CategoryAnalytics {
  categoryId: string;
  count: number;
  totalAmount: number;
  totalExpenses: number;
  totalIncome: number;
  percentage: number;
}

export interface BalanceDebt {
  fromMemberId: string;
  fromUserId: string;
  toMemberId: string;
  toUserId: string;
  amount: number;
}

export interface SpaceBalance {
  members: Array<{
    memberId: string;
    userId: string;
    totalContributed: number;
    totalAssigned: number;
    difference: number;
  }>;
  debts: BalanceDebt[];
  isBalanced: boolean;
}

export interface TrendPoint {
  period: string;
  expenses: number;
  income: number;
  net: number;
  count: number;
}

// ── Paginated Response ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Dashboard Summary (from /dashboard/snapshot) ────────────────────────────

export interface SharedSpaceSnapshotSpace {
  spaceId: string;
  nombre: string;
  tipo: SpaceType;
  monedaBase: string;
  descripcion?: string;
  ownerUserId: string;
  myRol: MemberRole;
  memberCount: number;
  maxMembers: number;
  configuracion?: SpaceConfig;
  ingresosPeriodo: number;
  egresosPeriodo: number;
  totalMovimientosPeriodo: number;
  lastMovementAt: string | null;
  unreadNotificationsCount: number;
  pendingOutgoingInvitationsCount: number;
  recentMovements: SharedMovement[];
  activeLinkInvitation?: {
    invitationId: string;
    shareUrl: string;
    deepLink: string;
    acceptedCount: number;
    expiresAt: string;
  } | null;
}

export interface SharedSpacesSummary {
  activeSpacesCount: number;
  pendingInvitationsCount: number;
  unreadNotificationsCount: number;
  spaces: SharedSpaceSnapshotSpace[];
}

// ── Create / Update DTOs ────────────────────────────────────────────────────

export interface CreateSpaceDTO {
  nombre: string;
  tipo: SpaceType;
  monedaBase: string;
  configuracion?: Partial<SpaceConfig>;
}

export interface UpdateSpaceDTO {
  nombre?: string;
  configuracion?: Partial<SpaceConfig>;
}

export interface CreateMovementDTO {
  tipo: MovementType;
  titulo: string;
  descripcion?: string;
  categoriaId?: string;
  montoTotal: number;
  moneda: string;
  fechaMovimiento: string;
  splitMode: SplitMode;
  visibility?: Visibility;
  contributions: Array<{
    memberId: string;
    amountContributed: number;
    contributionType: 'payer' | 'shared_source' | 'manual';
  }>;
  splits: Array<{
    memberId: string;
    included?: boolean;
    amountAssigned?: number;
    percentage?: number;
    units?: number;
  }>;
  accountImpact?: AccountImpactConfig;
  notes?: string;
  tags?: string[];
  idempotencyKey: string;
}

export interface InviteMemberDTO {
  invitedUserId?: string;
  email?: string;
  invitationType?: 'direct' | 'email' | 'link';
  rol?: MemberRole;
  message?: string;
  multiUse?: boolean;
  maxUses?: number; // 0 = sin límite
}

export interface TokenVerificationResult {
  valid: boolean;
  invitationId: string;
  estado: InvitationStatus;
  invitationType: 'direct' | 'email' | 'link';
  rol: MemberRole;
  message?: string;
  multiUse?: boolean;
  maxUses?: number | null;       // null = sin límite
  acceptedCount?: number;
  remainingUses?: number | null; // null = sin límite
  expiresAt: string;
  space: {
    spaceId: string;
    nombre: string;
    tipo: string;
    monedaBase: string;
  };
  invitedBy?: string;
}

export interface CreateCategoryDTO {
  nombre: string;
  icono: string;
  color: string;
}

export interface CreateRuleDTO {
  nombre: string;
  tipo: SplitMode;
  scope: 'default' | 'category' | 'movement_template';
  config: Record<string, number>;
}

// ── UI Helpers ──────────────────────────────────────────────────────────────

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  pareja: 'Pareja',
  grupo: 'Grupo',
  viaje: 'Viaje',
  familia: 'Familia',
  custom: 'Personalizado',
};

export const SPACE_TYPE_ICONS: Record<SpaceType, string> = {
  pareja: 'heart-outline',
  grupo: 'people-outline',
  viaje: 'airplane-outline',
  familia: 'home-outline',
  custom: 'settings-outline',
};

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  equal: 'Partes iguales',
  percentage: 'Porcentaje',
  fixed: 'Montos fijos',
  participants_only: 'Solo participantes',
  units: 'Por unidades',
  custom: 'Personalizado',
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  adjustment: 'Ajuste',
  planned: 'Planificado',
  recurring: 'Recurrente',
  goal_contribution: 'Aporte a meta',
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
};
