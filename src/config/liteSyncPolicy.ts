export const LITE_SYNC_POLICY = {
  manualSyncOnly: true,

  autoBootstrapOnAppStart: false,
  autoBootstrapOnReconnect: false,
  autoBootstrapOnResume: false,

  autoPullOnAppStart: false,
  autoPullOnReconnect: false,
  autoPullOnResume: false,

  autoPushOnCreate: false,
  autoPushOnDelete: false,
  autoPushOnReconnect: false,
  autoPushOnResume: false,
  autoPushOnUpdate: false,

  autoDashboardRefreshOnFocus: false,
  autoDashboardRefreshOnReconnect: false,
  autoProfileRefreshOnResume: false,

  bootstrapTtlMinutes: 10080,
  configTtlMinutes: 720,
  maxSyncPages: 5,
  profileTtlMinutes: 1440,
} as const;
