/**
 * Production runtime configuration.
 *
 * The browser calls a same-origin nginx endpoint. Nginx adds the private
 * webhook header server-side, so no n8n credential is shipped to the client.
 */
window.THESIS_ARENA_CONFIG = {
  mode: "webhook",
  n8nWebhookUrl: "/projects/thesis-arena/api/analyze",
  n8nStatusUrl: "/projects/thesis-arena/api/status",
  n8nRetryUrl: "/projects/thesis-arena/api/retry",
  requestTimeoutMs: 20000,
  pollIntervalMs: 2500,
  maxAnalysisWaitMs: 600000,
};
