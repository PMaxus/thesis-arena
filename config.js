/**
 * Runtime configuration for Thesis Arena.
 *
 * MVP ships in `mock` mode. To connect n8n later:
 * 1. set mode to `webhook`;
 * 2. set n8nWebhookUrl to the single production webhook URL;
 * 3. keep the response shape documented in README.md.
 */
window.THESIS_ARENA_CONFIG = {
  mode: "mock",
  n8nWebhookUrl: "",
  n8nStatusUrl: "",
  n8nRetryUrl: "",
  requestTimeoutMs: 20000,
  pollIntervalMs: 2500,
  maxAnalysisWaitMs: 600000,
};
