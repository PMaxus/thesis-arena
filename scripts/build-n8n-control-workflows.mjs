import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "n8n");
const analysisWorkflowId = process.env.THESIS_ARENA_ANALYSIS_WORKFLOW_ID || "REPLACE_WITH_ANALYSIS_WORKFLOW_ID";
const webhookCredentialId = process.env.THESIS_ARENA_WEBHOOK_CREDENTIAL_ID || "";
const webhookCredentialName = process.env.THESIS_ARENA_WEBHOOK_CREDENTIAL_NAME || "Thesis Arena Webhook Secret";
const apiCredentialId = process.env.THESIS_ARENA_N8N_API_CREDENTIAL_ID || "";
const apiCredentialName = process.env.THESIS_ARENA_N8N_API_CREDENTIAL_NAME || "Thesis Arena n8n API Client";
const postgresCredentialId = process.env.THESIS_ARENA_POSTGRES_CREDENTIAL_ID || "";
const postgresCredentialName = process.env.THESIS_ARENA_POSTGRES_CREDENTIAL_NAME || "PostgreSQL account";

const webhookCredentials = webhookCredentialId
  ? { httpHeaderAuth: { id: webhookCredentialId, name: webhookCredentialName } }
  : undefined;
const apiCredentials = apiCredentialId
  ? { n8nApi: { id: apiCredentialId, name: apiCredentialName } }
  : undefined;
const postgresCredentials = postgresCredentialId
  ? { postgres: { id: postgresCredentialId, name: postgresCredentialName } }
  : undefined;

function createWorkflow(name) {
  const nodes = [];
  const connections = {};

  function addNode({ nodeName, type, typeVersion, position, parameters, credentials, webhookId, retryOnFail, maxTries, waitBetweenTries, onError }) {
    const node = {
      parameters,
      type,
      typeVersion,
      position,
      id: randomUUID(),
      name: nodeName,
    };
    if (credentials) node.credentials = credentials;
    if (webhookId) node.webhookId = webhookId;
    if (retryOnFail) node.retryOnFail = true;
    if (maxTries) node.maxTries = maxTries;
    if (waitBetweenTries) node.waitBetweenTries = waitBetweenTries;
    if (onError) node.onError = onError;
    nodes.push(node);
  }

  function connect(from, to) {
    connections[from] ||= { main: [[]] };
    connections[from].main[0].push({ node: to, type: "main", index: 0 });
  }

  return { name, nodes, connections, addNode, connect };
}

function httpRequest({ nodeName, method = "GET", url, position, sendBody = false, jsonBody }) {
  const parameters = {
    method,
    url,
    authentication: "predefinedCredentialType",
    nodeCredentialType: "n8nApi",
    options: {
      response: {
        response: {
          neverError: true,
          responseFormat: "json",
        },
      },
    },
  };
  if (sendBody) {
    parameters.sendBody = true;
    parameters.specifyBody = "json";
    parameters.jsonBody = jsonBody;
  }
  return {
    nodeName,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.3,
    position,
    parameters,
    credentials: apiCredentials,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1000,
  };
}

function webhookNode(path, nodeName, position) {
  return {
    nodeName,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2.1,
    position,
    webhookId: randomUUID(),
    parameters: {
      httpMethod: "POST",
      path,
      authentication: webhookCredentialId ? "headerAuth" : "none",
      responseMode: "responseNode",
      options: {},
    },
    credentials: webhookCredentials,
  };
}

function responseNode({ nodeName, responseBody, responseCode = 200, position }) {
  return {
    nodeName,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.5,
    position,
    parameters: {
      respondWith: "json",
      responseBody,
      options: {
        responseCode,
        responseHeaders: {
          entries: [
            { name: "Cache-Control", value: "no-store" },
            { name: "X-Content-Type-Options", value: "nosniff" },
          ],
        },
      },
    },
  };
}

const archiveUpsertQuery = `INSERT INTO thesis_arena.runs (
  execution_id, account_username, thesis, language, status, stage, analysis_model,
  fact_check_model, success, error, payload, duration_ms, started_at, finished_at, updated_at
)
SELECT
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12,
  $13::timestamptz, $14::timestamptz, now()
WHERE $15::boolean
ON CONFLICT (execution_id) DO UPDATE SET
  account_username = COALESCE(NULLIF(EXCLUDED.account_username, ''), thesis_arena.runs.account_username),
  thesis = EXCLUDED.thesis,
  language = EXCLUDED.language,
  status = EXCLUDED.status,
  stage = EXCLUDED.stage,
  analysis_model = EXCLUDED.analysis_model,
  fact_check_model = EXCLUDED.fact_check_model,
  success = EXCLUDED.success,
  error = EXCLUDED.error,
  payload = EXCLUDED.payload,
  duration_ms = EXCLUDED.duration_ms,
  started_at = COALESCE(thesis_arena.runs.started_at, EXCLUDED.started_at),
  finished_at = COALESCE(EXCLUDED.finished_at, thesis_arena.runs.finished_at),
  updated_at = now()
RETURNING execution_id;`;

const status = createWorkflow("Thesis Arena · Execution Status");
status.addNode(webhookNode("thesis-arena-status", "Status Webhook", [-900, 0]));
status.addNode({
  nodeName: "Validate Status Request",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-650, 0],
  parameters: {
    jsCode: `const payload = $json.body ?? $json;
const headers = $json.headers ?? {};
const executionId = String(payload.execution_id ?? "").trim();
const accountUsername = String(headers["x-thesis-arena-user"] ?? headers["X-Thesis-Arena-User"] ?? "").trim().toLowerCase();
if (!/^\\d+$/.test(executionId)) throw new Error("A numeric execution_id is required.");
if (!/^[a-z0-9_-]{1,64}$/.test(accountUsername)) throw new Error("A trusted account identity is required.");
return [{ json: { requested_execution_id: executionId, account_username: accountUsername } }];`,
  },
});
status.connect("Status Webhook", "Validate Status Request");
status.addNode({
  nodeName: "List Recent Executions",
  type: "n8n-nodes-base.n8n",
  typeVersion: 1,
  position: [-390, 0],
  parameters: {
    resource: "execution",
    operation: "getAll",
    returnAll: false,
    limit: 25,
    filters: {
      workflowId: { __rl: true, value: analysisWorkflowId, mode: "id" },
    },
    options: {},
  },
  credentials: apiCredentials,
});
status.connect("Validate Status Request", "List Recent Executions");
status.addNode({
  nodeName: "Resolve Effective Execution",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-120, 0],
  parameters: {
    jsCode: `const requestedId = $("Validate Status Request").first().json.requested_execution_id;
const rows = $input.all().map((item) => item.json).filter((item) => item && item.id);
let effectiveId = requestedId;
let changed = true;
while (changed) {
  changed = false;
  const retry = rows
    .filter((item) => String(item.retryOf ?? "") === effectiveId)
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (retry) {
    effectiveId = String(retry.id);
    changed = true;
  }
}
return [{ json: { requested_execution_id: requestedId, effective_execution_id: effectiveId } }];`,
  },
});
status.connect("List Recent Executions", "Resolve Effective Execution");
status.addNode({
  nodeName: "Get Execution",
  type: "n8n-nodes-base.n8n",
  typeVersion: 1,
  position: [150, 0],
  parameters: {
    resource: "execution",
    operation: "get",
    executionId: "={{ $json.effective_execution_id }}",
    options: { activeWorkflows: true },
  },
  credentials: apiCredentials,
});
status.connect("Resolve Effective Execution", "Get Execution");
status.addNode({
  nodeName: "Build Safe Status",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [420, 0],
  parameters: {
    jsCode: `const execution = $json;
const resolved = $("Resolve Effective Execution").first().json;
if (!execution.id || String(execution.workflowId) !== "${analysisWorkflowId}") {
  return [{ json: { state: "not_found", execution_id: resolved.effective_execution_id, requested_execution_id: resolved.requested_execution_id } }];
}

const runData = execution.data?.resultData?.runData ?? {};
const successful = (name) => Array.isArray(runData[name]) && runData[name].some((run) => !run.error);
const completedNodes = Object.keys(runData).filter(successful);
const nodeJson = (name) => {
  const runs = runData[name] ?? [];
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const value = runs[index]?.data?.main?.[0]?.[0]?.json;
    if (value && typeof value === "object") return value;
  }
  return null;
};
const checkpointNames = ["Store Fact Check", "Store Logic", "Store Steelman", "Store Red Team", "Store Claim Map", "Prepare Request"];
const checkpoint = checkpointNames.map(nodeJson).find(Boolean) ?? {};
const accessCheckpoint = nodeJson("Attach Access") ?? {};
const requester = String($("Validate Status Request").first().json.account_username ?? "");
const owner = String(accessCheckpoint.access?.username ?? accessCheckpoint.account_username ?? nodeJson("Prepare Request")?.account_username ?? "");
if (!owner || owner !== requester) {
  return [{
    json: {
      state: "not_found",
      requested_execution_id: resolved.requested_execution_id,
      execution_id: resolved.effective_execution_id,
      authorized: false,
      error: "This execution is not available to the current account.",
      poll_after_ms: 2500,
      persisted: false
    }
  }];
}
let stage = "queued";
let stageLabel = "Queued in n8n";
let stageDetail = "The workflow has been accepted and is waiting to start.";
let progress = 2;

if (successful("Prepare Request")) {
  stage = "mapping";
  stageLabel = "Mapping claims";
  stageDetail = "n8n is decomposing the thesis into testable claims.";
  progress = 10;
}
if (successful("Store Claim Map")) {
  stage = "lenses";
  stageLabel = "Running Red Team";
  stageDetail = "The claim map is complete. The reasoning lenses are now running.";
  progress = 25;
}
if (successful("Store Red Team")) {
  stageLabel = "Running Steelman";
  stageDetail = "Red Team completed. n8n is building the strongest defensible version.";
  progress = 38;
}
if (successful("Store Steelman")) {
  stageLabel = "Checking logic";
  stageDetail = "Steelman completed. n8n is checking warrants and causal links.";
  progress = 52;
}
if (successful("Store Logic")) {
  stage = "fact_check";
  stageLabel = "Checking evidence";
  stageDetail = "The reasoning lenses are complete. Live source research is in progress.";
  progress = 66;
}
if (successful("Store Fact Check")) {
  stage = "synthesis";
  stageLabel = "Building synthesis";
  stageDetail = "Fact Check completed. n8n is reconciling the findings and rewriting the thesis.";
  progress = 90;
}
if (successful("Assemble Response")) {
  stage = "completed";
  stageLabel = "Analysis complete";
  stageDetail = "The complete result is ready.";
  progress = 100;
}

const startedAt = execution.startedAt ? new Date(execution.startedAt).getTime() : Date.now();
const response = {
  state: execution.status === "success" ? "completed" : execution.status,
  requested_execution_id: resolved.requested_execution_id,
  execution_id: String(execution.id),
  retry_of: execution.retryOf == null ? null : String(execution.retryOf),
  stage,
  stage_label: stageLabel,
  stage_detail: stageDetail,
  progress,
  completed_nodes: completedNodes,
  started_at: execution.startedAt ?? null,
  elapsed_ms: Math.max(0, Date.now() - startedAt),
  heartbeat_at: new Date().toISOString(),
  poll_after_ms: 2500,
  authorized: true,
  persisted: true,
};

if (checkpoint.thesis || Array.isArray(checkpoint.claims) || checkpoint.agents) {
  response.partial = {
    version: "1.0",
    input: { thesis: String(checkpoint.thesis ?? "") },
    claims: Array.isArray(checkpoint.claims) ? checkpoint.claims : [],
    agents: checkpoint.agents && typeof checkpoint.agents === "object" ? checkpoint.agents : {},
    meta: {
      execution_id: String(execution.id),
      model: checkpoint.models?.analysis
        ? checkpoint.models.analysis + (checkpoint.models.fact_check ? " · Fact Check: " + checkpoint.models.fact_check : "")
        : "GPT-5.6 · live workflow",
      duration_ms: Math.max(0, Date.now() - startedAt),
      mode: "live",
      language: String(checkpoint.language ?? "en"),
      account_username: owner,
      access: accessCheckpoint.access ?? null,
      analysis_model: String(checkpoint.models?.analysis ?? ""),
      fact_check_model: String(checkpoint.models?.fact_check ?? "")
    }
  };
}

if (execution.status === "success") {
  const runs = runData["Assemble Response"] ?? [];
  const finalRun = runs[runs.length - 1];
  response.analysis = finalRun?.data?.main?.[0]?.[0]?.json ?? null;
  if (response.analysis) response.partial = response.analysis;
  if (!response.analysis) {
    response.state = "error";
    response.error = "The execution completed without a readable analysis result.";
    response.retryable = false;
  }
}

if (["error", "crashed", "canceled"].includes(execution.status)) {
  const resultError = execution.data?.resultData?.error;
  response.stage = "error";
  response.stage_label = "Analysis interrupted";
  response.failed_node = execution.data?.resultData?.lastNodeExecuted ?? null;
  response.error = String(resultError?.message ?? resultError?.description ?? "The n8n execution stopped before completion.").slice(0, 400);
  response.retryable = execution.status !== "canceled";
}

return [{ json: response }];`,
  },
});
status.connect("Get Execution", "Build Safe Status");
status.addNode(responseNode({
  nodeName: "Respond with Status",
  responseBody: "={{ $json }}",
  position: [690, 0],
}));
status.connect("Build Safe Status", "Respond with Status");
status.addNode({
  nodeName: "Archive Observed Status",
  type: "n8n-nodes-base.postgres",
  typeVersion: 2.6,
  position: [690, 220],
  onError: "continueRegularOutput",
  credentials: postgresCredentials,
  parameters: {
    operation: "executeQuery",
    query: archiveUpsertQuery,
    options: {
      queryReplacement: `={{ [
        String($json.execution_id),
        String($json.partial?.meta?.account_username ?? $json.analysis?.meta?.account_username ?? ''),
        String($json.partial?.input?.thesis ?? $json.analysis?.input?.thesis ?? ''),
        String($json.partial?.meta?.language ?? $json.analysis?.meta?.language ?? 'en'),
        String($json.state ?? 'unknown'),
        String($json.stage ?? 'unknown'),
        String($json.partial?.meta?.analysis_model ?? $json.analysis?.meta?.model ?? ''),
        String($json.partial?.meta?.fact_check_model ?? ''),
        $json.state === 'completed',
        String($json.error ?? ''),
        JSON.stringify($json.analysis ?? $json.partial ?? {}),
        Number($json.elapsed_ms ?? $json.analysis?.meta?.duration_ms ?? 0),
        $json.started_at ?? new Date().toISOString(),
        ['completed','error','crashed','canceled'].includes($json.state) ? new Date().toISOString() : null,
        $json.authorized !== false
      ] }}`,
    },
  },
});
status.connect("Build Safe Status", "Archive Observed Status");

const retry = createWorkflow("Thesis Arena · Retry Execution");
retry.addNode(webhookNode("thesis-arena-retry", "Retry Webhook", [-650, 0]));
retry.addNode({
  nodeName: "Validate Retry Request",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-390, 0],
  parameters: {
    jsCode: `const payload = $json.body ?? $json;
const headers = $json.headers ?? {};
const executionId = String(payload.execution_id ?? "").trim();
const accountUsername = String(headers["x-thesis-arena-user"] ?? headers["X-Thesis-Arena-User"] ?? "").trim().toLowerCase();
if (!/^\\d+$/.test(executionId)) throw new Error("A numeric execution_id is required.");
if (!/^[a-z0-9_-]{1,64}$/.test(accountUsername)) throw new Error("A trusted account identity is required.");
return [{ json: { execution_id: executionId, account_username: accountUsername } }];`,
  },
});
retry.connect("Retry Webhook", "Validate Retry Request");
retry.addNode(httpRequest({
  nodeName: "Get Saved Execution",
  method: "GET",
  url: '={{ "http://127.0.0.1:5678/api/v1/executions/" + $json.execution_id + "?includeData=true" }}',
  position: [-120, 0],
}));
retry.connect("Validate Retry Request", "Get Saved Execution");
retry.addNode({
  nodeName: "Authorize Retry",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [150, 0],
  parameters: {
    jsCode: `const execution = $json;
const request = $("Validate Retry Request").first().json;
const runData = execution.data?.resultData?.runData ?? {};
const nodeJson = (name) => {
  const runs = runData[name] ?? [];
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const value = runs[index]?.data?.main?.[0]?.[0]?.json;
    if (value && typeof value === "object") return value;
  }
  return null;
};
const access = nodeJson("Attach Access") ?? {};
const owner = String(access.access?.username ?? access.account_username ?? nodeJson("Prepare Request")?.account_username ?? "");
const allowed = Boolean(execution.id) && String(execution.workflowId) === "${analysisWorkflowId}" && owner === request.account_username;
return [{
  json: {
    execution_id: request.execution_id,
    account_username: request.account_username,
    allowed,
    reason: allowed ? "allowed" : "not_found"
  }
}];`,
  },
});
retry.connect("Get Saved Execution", "Authorize Retry");
retry.addNode(responseNode({
  nodeName: "Acknowledge Retry",
  responseBody: '={{ $json.allowed ? { state: "retrying", retry_of: $json.execution_id, poll_after_ms: 2500 } : { state: "denied", code: "access_denied", error: "This execution is not available to the current account." } }}',
  responseCode: '={{ $json.allowed ? 202 : 403 }}',
  position: [420, 0],
}));
retry.connect("Authorize Retry", "Acknowledge Retry");
retry.addNode({
  nodeName: "Continue If Retry Authorized",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [690, 0],
  parameters: {
    jsCode: `if (!$json.allowed) return [];
return $input.all();`,
  },
});
retry.connect("Acknowledge Retry", "Continue If Retry Authorized");
retry.addNode(httpRequest({
  nodeName: "Retry Saved Execution",
  method: "POST",
  url: '={{ "http://127.0.0.1:5678/api/v1/executions/" + $("Validate Retry Request").first().json.execution_id + "/retry" }}',
  position: [960, 0],
  sendBody: true,
  jsonBody: '={{ JSON.stringify({ loadWorkflow: true }) }}',
}));
retry.connect("Continue If Retry Authorized", "Retry Saved Execution");

const settings = {
  executionOrder: "v1",
  saveManualExecutions: true,
  saveExecutionProgress: true,
  saveDataErrorExecution: "all",
  saveDataSuccessExecution: "all",
};

mkdirSync(outputDirectory, { recursive: true });
for (const [filename, workflow] of [
  ["thesis-arena-status-workflow.json", status],
  ["thesis-arena-retry-workflow.json", retry],
]) {
  const outputPath = resolve(outputDirectory, filename);
  writeFileSync(outputPath, `${JSON.stringify({ name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings }, null, 2)}\n`, "utf8");
  console.log(`Generated ${outputPath}`);
}
