export type {
  DashboardRange,
  DashboardSnapshot,
  RateLimitedError,
  SnapshotFetchResult,
  UnauthorizedError,
} from '../../../types/dashboardSnapshot';

export type DashboardSnapshotRequest = {
  etag?: string;
  range?: import('../../../types/dashboardSnapshot').DashboardRange;
  recentLimit?: number;
  recentPage?: number;
  subaccountsLimit?: number;
  subaccountsPage?: number;
  recurrentesLimit?: number;
  recurrentesPage?: number;
  metasLimit?: number;
  metasPage?: number;
  signal?: AbortSignal;
};

