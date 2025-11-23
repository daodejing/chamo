// Centralized debug toggle so verbose logs can be enabled in dev or via env.
export const DEBUG_LOGS_ENABLED =
  process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production';

