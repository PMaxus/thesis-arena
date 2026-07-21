import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "n8n", "thesis-arena-workflow.json");

const analysisModel = "openai/gpt-5.6-luna";
const factCheckModel = "openai/gpt-5.6-luna:online";

const openRouterCredentialId = process.env.THESIS_ARENA_OPENROUTER_CREDENTIAL_ID || "";
const openRouterCredentialName = process.env.THESIS_ARENA_OPENROUTER_CREDENTIAL_NAME || "OpenRouter account";
const postgresCredentialId = process.env.THESIS_ARENA_POSTGRES_CREDENTIAL_ID || "";
const postgresCredentialName = process.env.THESIS_ARENA_POSTGRES_CREDENTIAL_NAME || "PostgreSQL account";

const openRouterCredentials = openRouterCredentialId
  ? { openRouterApi: { id: openRouterCredentialId, name: openRouterCredentialName } }
  : undefined;
const postgresCredentials = postgresCredentialId
  ? { postgres: { id: postgresCredentialId, name: postgresCredentialName } }
  : undefined;

const webhookCredentialId = process.env.THESIS_ARENA_WEBHOOK_CREDENTIAL_ID || "";
const webhookCredentialName = process.env.THESIS_ARENA_WEBHOOK_CREDENTIAL_NAME || "Thesis Arena Webhook Secret";

const nodes = [];
const connections = {};

function addNode({ name, type, typeVersion, position, parameters, credentials, webhookId, retryOnFail, maxTries, waitBetweenTries, onError }) {
  const node = {
    parameters,
    type,
    typeVersion,
    position,
    id: randomUUID(),
    name,
  };
  if (credentials) node.credentials = credentials;
  if (webhookId) node.webhookId = webhookId;
  if (retryOnFail) node.retryOnFail = true;
  if (maxTries) node.maxTries = maxTries;
  if (waitBetweenTries) node.waitBetweenTries = waitBetweenTries;
  if (onError) node.onError = onError;
  nodes.push(node);
  return node;
}

const archiveUpsertQuery = `INSERT INTO thesis_arena.runs (
  execution_id, account_username, thesis, language, status, stage, analysis_model,
  fact_check_model, success, error, payload, duration_ms, started_at, finished_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::timestamptz, $14::timestamptz, now()
)
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

const consumeAccessQuery = `WITH account_before AS MATERIALIZED (
  SELECT username, role, quota, used_count, enabled
  FROM thesis_arena.access_accounts
  WHERE username = $1
), consumed AS (
  UPDATE thesis_arena.access_accounts
  SET used_count = used_count + 1,
      last_used_at = now(),
      updated_at = now()
  WHERE username = $1
    AND enabled = true
    AND (quota IS NULL OR used_count < quota)
  RETURNING username, role, quota, used_count
), initialized_run AS (
  INSERT INTO thesis_arena.runs (
    execution_id, account_username, thesis, language, status, stage,
    analysis_model, fact_check_model, success, error, payload, duration_ms,
    started_at, finished_at, updated_at
  )
  SELECT
    $2, consumed.username, $3, $4, 'running', 'accepted', $5, $6, false, '',
    jsonb_build_object(
      'thesis', $3,
      'language', $4,
      'access', jsonb_build_object(
        'username', consumed.username,
        'role', consumed.role,
        'quota', consumed.quota,
        'used_count', consumed.used_count,
        'remaining_attempts', CASE
          WHEN consumed.quota IS NULL THEN NULL
          ELSE GREATEST(consumed.quota - consumed.used_count, 0)
        END
      )
    ),
    0, $7::timestamptz, NULL, now()
  FROM consumed
  ON CONFLICT (execution_id) DO UPDATE SET
    account_username = EXCLUDED.account_username,
    thesis = EXCLUDED.thesis,
    language = EXCLUDED.language,
    status = EXCLUDED.status,
    stage = EXCLUDED.stage,
    analysis_model = EXCLUDED.analysis_model,
    fact_check_model = EXCLUDED.fact_check_model,
    payload = EXCLUDED.payload,
    updated_at = now()
  RETURNING execution_id
)
SELECT
  consumed.username IS NOT NULL AS allowed,
  COALESCE(consumed.username, account_before.username, $1) AS username,
  COALESCE(consumed.role, account_before.role, 'unknown') AS role,
  COALESCE(consumed.quota, account_before.quota) AS quota,
  COALESCE(consumed.used_count, account_before.used_count, 0) AS used_count,
  CASE
    WHEN COALESCE(consumed.quota, account_before.quota) IS NULL THEN NULL
    ELSE GREATEST(
      COALESCE(consumed.quota, account_before.quota) -
      COALESCE(consumed.used_count, account_before.used_count, 0),
      0
    )
  END AS remaining_attempts,
  COALESCE(consumed.quota, account_before.quota) IS NULL AS unlimited,
  CASE
    WHEN consumed.username IS NOT NULL THEN 'allowed'
    WHEN account_before.username IS NULL THEN 'unknown_account'
    WHEN account_before.enabled = false THEN 'disabled'
    ELSE 'limit_exhausted'
  END AS reason,
  (SELECT COUNT(*) FROM initialized_run) AS initialized_runs
FROM (SELECT 1) AS seed
LEFT JOIN consumed ON true
LEFT JOIN account_before ON true;`;

function addArchiveCheckpoint({ source, name, stage, status = "running", success = false, y = 520 }) {
  addNode({
    name,
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [nodes.find((node) => node.name === source)?.position?.[0] ?? 0, y],
    onError: "continueRegularOutput",
    credentials: postgresCredentials,
    parameters: {
      operation: "executeQuery",
      query: archiveUpsertQuery,
      options: {
        queryReplacement: `={{ [
          String($execution.id),
          String($json.access?.username ?? $json.meta?.account_username ?? ''),
          String($json.thesis ?? $json.input?.thesis ?? ''),
          String($json.language ?? $json.meta?.language ?? 'en'),
          ${JSON.stringify(status)},
          ${JSON.stringify(stage)},
          String($json.models?.analysis ?? $json.meta?.analysis_model ?? $json.meta?.model ?? ''),
          String($json.models?.fact_check ?? $json.meta?.fact_check_model ?? ''),
          ${success},
          '',
          JSON.stringify($json),
          Number($json.meta?.duration_ms ?? (Date.now() - Number($json.started_at_ms ?? Date.now()))),
          new Date(Number($json.started_at_ms ?? Date.now())).toISOString(),
          ${success ? "new Date().toISOString()" : "null"}
        ] }}`,
      },
    },
  });
  connectMain(source, name);
}

function connectMain(from, to, outputIndex = 0) {
  connections[from] ||= {};
  connections[from].main ||= [];
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: "main", index: 0 });
}

function connectAi(from, outputType, to) {
  connections[from] = {
    [outputType]: [[{ node: to, type: outputType, index: 0 }]],
  };
}

function schema(value) {
  return JSON.stringify(value, null, 2);
}

function addAgent({ name, x, model, prompt, systemMessage, outputSchema }) {
  addNode({
    name,
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 3.1,
    position: [x, 0],
    parameters: {
      promptType: "define",
      text: prompt,
      hasOutputParser: true,
      options: { systemMessage },
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
  });

  const modelName = `${name} · Model`;
  addNode({
    name: modelName,
    type: "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
    typeVersion: 1,
    position: [x - 110, 250],
    parameters: { model, options: {} },
    credentials: openRouterCredentials,
  });

  const parserName = `${name} · Parser`;
  addNode({
    name: parserName,
    type: "@n8n/n8n-nodes-langchain.outputParserStructured",
    typeVersion: 1.3,
    position: [x + 120, 250],
    parameters: {
      schemaType: "manual",
      inputSchema: schema(outputSchema),
    },
  });

  connectAi(modelName, "ai_languageModel", name);
  connectAi(parserName, "ai_outputParser", name);
}

const findingProperties = {
  title: { type: "string", minLength: 1 },
  detail: { type: "string", minLength: 1 },
  claim_ids: {
    type: "array",
    minItems: 1,
    items: { type: "string", pattern: "^C[1-9][0-9]*$" },
  },
  severity: { type: "string", enum: ["low", "medium", "high"] },
};

function lensSchema({ minItems, maxItems, factCheck = false }) {
  const properties = { ...findingProperties };
  const required = ["title", "detail", "claim_ids", "severity"];
  if (factCheck) {
    properties.status = {
      type: "string",
      enum: ["supported", "partially_supported", "mixed", "unsupported", "insufficient_evidence"],
    };
    properties.sources = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "publisher", "url", "relation"],
        properties: {
          title: { type: "string", minLength: 1 },
          publisher: { type: "string", minLength: 1 },
          url: { type: "string", minLength: 8 },
          relation: { type: "string", minLength: 1 },
        },
      },
    };
    required.push("status", "sources");
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "findings"],
    properties: {
      summary: { type: "string", minLength: 1 },
      findings: {
        type: "array",
        minItems,
        maxItems,
        items: {
          type: "object",
          additionalProperties: false,
          required,
          properties,
        },
      },
    },
  };
}

const claimMapSchema = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "type"],
        properties: {
          text: { type: "string", minLength: 1 },
          type: {
            type: "string",
            enum: ["empirical_claim", "causal_claim", "value_judgment", "interpretation", "prediction"],
          },
        },
      },
    },
  },
};

const synthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["survived", "failed", "hidden_assumptions", "key_crux", "improved_thesis"],
  properties: {
    survived: { type: "string", minLength: 1 },
    failed: { type: "string", minLength: 1 },
    hidden_assumptions: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 1 },
    },
    key_crux: { type: "string", minLength: 1 },
    improved_thesis: { type: "string", minLength: 1 },
  },
};

const webhookCredentials = webhookCredentialId
  ? { httpHeaderAuth: { id: webhookCredentialId, name: webhookCredentialName } }
  : undefined;

addNode({
  name: "Analyze Claim Webhook",
  type: "n8n-nodes-base.webhook",
  typeVersion: 2.1,
  position: [-1100, 0],
  webhookId: randomUUID(),
  parameters: {
    httpMethod: "POST",
    path: "thesis-arena-analyze",
    authentication: webhookCredentialId ? "headerAuth" : "none",
    responseMode: "responseNode",
    options: {},
  },
  credentials: webhookCredentials,
});

addNode({
  name: "Prepare Request",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-850, 0],
  parameters: {
    jsCode: `const payload = $json.body ?? $json;
const headers = $json.headers ?? {};
const thesis = String(payload.thesis ?? "").replace(/\\s+/g, " ").trim();
const language = payload.language === "ru" ? "ru" : "en";
const accountUsername = String(headers["x-thesis-arena-user"] ?? headers["X-Thesis-Arena-User"] ?? "").trim().toLowerCase();
if (thesis.length < 12) throw new Error("Thesis must contain at least 12 characters.");
if (thesis.length > 480) throw new Error("Thesis must contain at most 480 characters.");
if (!/^[a-z0-9_-]{1,64}$/.test(accountUsername)) throw new Error("A trusted account identity is required.");
return [{
  json: {
    thesis,
    language,
    account_username: accountUsername,
    contract_version: String(payload.contract_version ?? "1.0"),
    started_at_ms: Date.now(),
    models: {
      analysis: "${analysisModel}",
      fact_check: "${factCheckModel}"
    }
  }
}];`,
  },
});
connectMain("Analyze Claim Webhook", "Prepare Request");

addNode({
  name: "Consume Access",
  type: "n8n-nodes-base.postgres",
  typeVersion: 2.6,
  position: [-590, 0],
  credentials: postgresCredentials,
  parameters: {
    operation: "executeQuery",
    query: consumeAccessQuery,
    options: {
      queryReplacement: `={{ [
        String($json.account_username),
        String($execution.id),
        String($json.thesis),
        String($json.language),
        String($json.models.analysis),
        String($json.models.fact_check),
        new Date(Number($json.started_at_ms)).toISOString()
      ] }}`,
    },
  },
});
connectMain("Prepare Request", "Consume Access");

addNode({
  name: "Attach Access",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-330, 0],
  parameters: {
    jsCode: `const base = $("Prepare Request").first().json;
const quota = $json.quota == null ? null : Number($json.quota);
const remaining = $json.remaining_attempts == null ? null : Number($json.remaining_attempts);
return [{
  json: {
    ...base,
    access: {
      allowed: $json.allowed === true,
      username: String($json.username ?? base.account_username),
      role: String($json.role ?? "unknown"),
      quota,
      used_count: Number($json.used_count ?? 0),
      remaining_attempts: remaining,
      unlimited: quota == null,
      reason: String($json.reason ?? "unknown_account")
    }
  }
}];`,
  },
});
connectMain("Consume Access", "Attach Access");

addNode({
  name: "Acknowledge Run",
  type: "n8n-nodes-base.respondToWebhook",
  typeVersion: 1.5,
  position: [-70, 0],
  parameters: {
    respondWith: "json",
    responseBody: `={{ $json.access.allowed
      ? {
          state: "accepted",
          execution_id: String($execution.id),
          poll_after_ms: 2500,
          access: {
            username: $json.access.username,
            role: $json.access.role,
            unlimited: $json.access.unlimited,
            remaining_attempts: $json.access.remaining_attempts
          }
        }
      : {
          state: "denied",
          code: $json.access.reason === "limit_exhausted" ? "quota_exhausted" : "access_denied",
          error: $json.language === "ru"
            ? ($json.access.reason === "limit_exhausted"
              ? "Все доступные анализы для этого аккаунта уже использованы."
              : "Этому аккаунту не разрешён запуск анализа.")
            : ($json.access.reason === "limit_exhausted"
              ? "This account has used all available analyses."
              : "This account is not allowed to start an analysis."),
          access: {
            username: $json.access.username,
            role: $json.access.role,
            unlimited: $json.access.unlimited,
            remaining_attempts: $json.access.remaining_attempts
          }
        } }}`,
    options: {
      responseCode: '={{ $json.access.allowed ? 202 : ($json.access.reason === "limit_exhausted" ? 429 : 403) }}',
      responseHeaders: {
        entries: [
          { name: "Cache-Control", value: "no-store" },
          { name: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    },
  },
});
connectMain("Attach Access", "Acknowledge Run");

addNode({
  name: "Continue If Authorized",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [190, 0],
  parameters: {
    jsCode: `if (!$json.access?.allowed) return [];
return $input.all();`,
  },
});
connectMain("Acknowledge Run", "Continue If Authorized");

addAgent({
  name: "Claim Mapper",
  x: 460,
  model: analysisModel,
  prompt: `=Language: {{ $json.language }}\n\nThesis to map:\n{{ $json.thesis }}`,
  systemMessage: `You are the Claim Mapper for Thesis Arena. Decompose the user's thesis into 2–5 concise claims using Toulmin-style reasoning. Identify conclusions, warrants, causal links, empirical premises, value judgments, interpretations, and predictions. Do not critique the thesis yet. Each claim must be independently understandable and preserve the author's intended meaning. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: claimMapSchema,
});
connectMain("Continue If Authorized", "Claim Mapper");

addNode({
  name: "Store Claim Map",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [730, 0],
  parameters: {
    jsCode: `let parsed = $json.output ?? $json;
if (typeof parsed === "string") parsed = JSON.parse(parsed);
const base = $("Attach Access").first().json;
const typeMeta = {
  empirical_claim: ["Empirical claim", "Эмпирическое утверждение", "amber"],
  causal_claim: ["Causal claim", "Причинное утверждение", "teal"],
  value_judgment: ["Value judgment", "Ценностное суждение", "amber"],
  interpretation: ["Interpretation", "Интерпретация", "blue"],
  prediction: ["Prediction", "Прогноз", "blue"]
};
const claims = (parsed.claims ?? []).slice(0, 5).map((claim, index) => {
  const type = typeMeta[claim.type] ? claim.type : "interpretation";
  return {
    id: "C" + (index + 1),
    text: String(claim.text ?? "").trim(),
    type,
    label: base.language === "ru" ? typeMeta[type][1] : typeMeta[type][0],
    tone: typeMeta[type][2]
  };
}).filter((claim) => claim.text);
if (claims.length < 1) throw new Error("Claim Mapper returned no usable claims.");
return [{ json: { ...base, claims, agents: {} } }];`,
  },
});
connectMain("Claim Mapper", "Store Claim Map");

const sharedLensInput = `=Language: {{ $json.language }}\n\nOriginal thesis:\n{{ $json.thesis }}\n\nClaim map:\n{{ JSON.stringify($json.claims) }}`;

addAgent({
  name: "Red Team",
  x: 1010,
  model: analysisModel,
  prompt: sharedLensInput,
  systemMessage: `You are the Red Team lens in Thesis Arena. Stress-test the claim aggressively but fairly. Find hidden assumptions, counterexamples, omitted alternatives, scope problems, causal confounds, edge cases, and practical tradeoffs. Focus on the argument, never the author. Produce 5–7 distinct pressure points. The summary must be one crisp sentence; each detail should be 2–4 useful sentences. Reference only claim IDs from the supplied map. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: lensSchema({ minItems: 5, maxItems: 7 }),
});
connectMain("Store Claim Map", "Red Team");

function storeLensCode({ previousNode, key, name, nameRu, tone, countLabel, countLabelRu, idPrefix, factCheck = false }) {
  return `let parsed = $json.output ?? $json;
if (typeof parsed === "string") parsed = JSON.parse(parsed);
const previous = $("${previousNode}").first().json;
const validClaims = new Set(previous.claims.map((claim) => claim.id));
const findings = (parsed.findings ?? []).map((finding, index) => {
  const item = {
    id: "${idPrefix}" + (index + 1),
    title: String(finding.title ?? "").trim(),
    detail: String(finding.detail ?? "").trim(),
    claim_ids: (finding.claim_ids ?? []).map(String).filter((id) => validClaims.has(id)),
    severity: ["low", "medium", "high"].includes(finding.severity) ? finding.severity : "medium"
  };
  ${factCheck ? `item.status = ["supported", "partially_supported", "mixed", "unsupported", "insufficient_evidence"].includes(finding.status) ? finding.status : "insufficient_evidence";
  item.sources = (finding.sources ?? []).filter((source) => /^https?:\\/\\//i.test(String(source.url ?? ""))).map((source) => ({
    title: String(source.title ?? "Untitled source").trim(),
    publisher: String(source.publisher ?? "Source").trim(),
    url: String(source.url).trim(),
    relation: String(source.relation ?? "context").trim()
  }));` : ""}
  if (!item.claim_ids.length && previous.claims[0]) item.claim_ids = [previous.claims[0].id];
  return item;
}).filter((finding) => finding.title && finding.detail);
if (!findings.length) throw new Error("${name} returned no usable findings.");
return [{
  json: {
    ...previous,
    agents: {
      ...previous.agents,
      ${key}: {
        name: previous.language === "ru" ? "${nameRu}" : "${name}",
        tone: "${tone}",
        summary: String(parsed.summary ?? "").trim(),
        count: findings.length,
        count_label: previous.language === "ru" ? "${countLabelRu}" : "${countLabel}",
        findings
      }
    }
  }
}];`;
}

addNode({
  name: "Store Red Team",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1280, 0],
  parameters: { jsCode: storeLensCode({ previousNode: "Store Claim Map", key: "red_team", name: "Red Team", nameRu: "Красная команда", tone: "red", countLabel: "pressure points", countLabelRu: "критических пунктов", idPrefix: "R" }) },
});
connectMain("Red Team", "Store Red Team");

addAgent({
  name: "Steelman",
  x: 1550,
  model: analysisModel,
  prompt: sharedLensInput,
  systemMessage: `You are the Steelman lens in Thesis Arena. Reconstruct the strongest defensible version of the argument. Supply missing warrants, necessary conditions, useful qualifications, boundary conditions, and the best available support without pretending uncertain premises are proven. Produce 4–6 distinct supporting arguments. The summary must be one crisp sentence; each detail should be 2–4 useful sentences. Reference only claim IDs from the supplied map. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: lensSchema({ minItems: 4, maxItems: 6 }),
});
connectMain("Store Red Team", "Steelman");

addNode({
  name: "Store Steelman",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1820, 0],
  parameters: { jsCode: storeLensCode({ previousNode: "Store Red Team", key: "steelman", name: "Steelman", nameRu: "Усиление аргумента", tone: "teal", countLabel: "supporting arguments", countLabelRu: "усиливающих аргументов", idPrefix: "S" }) },
});
connectMain("Steelman", "Store Steelman");

addAgent({
  name: "Logic",
  x: 2090,
  model: analysisModel,
  prompt: sharedLensInput,
  systemMessage: `You are the Logic lens in Thesis Arena. Check internal consistency, warrants, quantifiers, causal inference, contradictions, non sequiturs, equivocation, and whether the conclusion follows from the premises. Separate a merely plausible link from an established one. Produce 3–5 distinct reasoning gaps. The summary must be one crisp sentence; each detail should be 2–4 useful sentences. Reference only claim IDs from the supplied map. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: lensSchema({ minItems: 3, maxItems: 5 }),
});
connectMain("Store Steelman", "Logic");

addNode({
  name: "Store Logic",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [2360, 0],
  parameters: { jsCode: storeLensCode({ previousNode: "Store Steelman", key: "logic", name: "Logic", nameRu: "Логика", tone: "blue", countLabel: "reasoning gaps", countLabelRu: "логических пробелов", idPrefix: "L" }) },
});
connectMain("Logic", "Store Logic");

addAgent({
  name: "Fact Check",
  x: 2630,
  model: factCheckModel,
  prompt: sharedLensInput,
  systemMessage: `You are the Fact Check lens in Thesis Arena and have web search enabled. Check only externally verifiable empirical, numerical, historical, scientific, and causal claims. Do not pretend that opinions, preferences, or value judgments can be fact-checked. Search for credible primary or authoritative sources. Never invent a URL or citation. If reliable evidence cannot be found, use insufficient_evidence and an empty sources array. Produce 2–5 evidence findings. The summary must be one crisp sentence; each detail should be 2–4 useful sentences. Reference only claim IDs from the supplied map. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: lensSchema({ minItems: 2, maxItems: 5, factCheck: true }),
});
connectMain("Store Logic", "Fact Check");

addNode({
  name: "Store Fact Check",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [2900, 0],
  parameters: { jsCode: storeLensCode({ previousNode: "Store Logic", key: "fact_check", name: "Fact Check", nameRu: "Проверка фактов", tone: "amber", countLabel: "evidence findings", countLabelRu: "выводов по источникам", idPrefix: "F", factCheck: true }) },
});
connectMain("Fact Check", "Store Fact Check");

addAgent({
  name: "Synthesizer",
  x: 3170,
  model: analysisModel,
  prompt: `=Language: {{ $json.language }}\n\nOriginal thesis:\n{{ $json.thesis }}\n\nClaim map:\n{{ JSON.stringify($json.claims) }}\n\nAnalytical lenses:\n{{ JSON.stringify($json.agents) }}`,
  systemMessage: `You are the final Synthesizer in Thesis Arena. Reconcile the independent lenses without averaging them into vagueness. State what genuinely survived, what failed, the hidden assumptions, and the single key crux: the decisive empirical or logical hinge that could change the conclusion. Then rewrite the thesis into a more precise, conditional, defensible formulation. Preserve the author's core intent where possible. Be concise but substantive. When Language is ru, write every user-facing text field in Russian; otherwise write in English. Return only the structured result requested by the output parser.`,
  outputSchema: synthesisSchema,
});
connectMain("Store Fact Check", "Synthesizer");

addNode({
  name: "Assemble Response",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [3440, 0],
  parameters: {
    jsCode: `let synthesis = $json.output ?? $json;
if (typeof synthesis === "string") synthesis = JSON.parse(synthesis);
const state = $("Store Fact Check").first().json;
const durationMs = Math.max(0, Date.now() - Number(state.started_at_ms ?? Date.now()));
return [{
  json: {
    version: "1.0",
    input: { thesis: state.thesis },
    claims: state.claims,
    agents: state.agents,
    synthesis: {
      survived: String(synthesis.survived ?? "").trim(),
      failed: String(synthesis.failed ?? "").trim(),
      hidden_assumptions: (synthesis.hidden_assumptions ?? []).map(String).filter(Boolean),
      key_crux: String(synthesis.key_crux ?? "").trim(),
      improved_thesis: String(synthesis.improved_thesis ?? "").trim()
    },
    meta: {
      execution_id: String($execution.id),
      model: "${analysisModel} · Fact Check: ${factCheckModel}",
      duration_ms: durationMs,
      mode: "live",
      language: state.language ?? "en",
      account_username: state.access?.username ?? "",
      access: {
        username: state.access?.username ?? "",
        role: state.access?.role ?? "unknown",
        unlimited: Boolean(state.access?.unlimited),
        remaining_attempts: state.access?.remaining_attempts ?? null
      },
      persisted: true,
      completed: true
    }
  }
}];`,
  },
});
connectMain("Synthesizer", "Assemble Response");

addArchiveCheckpoint({ source: "Store Claim Map", name: "Archive · Claim Map", stage: "claim_map" });
addArchiveCheckpoint({ source: "Store Red Team", name: "Archive · Red Team", stage: "red_team" });
addArchiveCheckpoint({ source: "Store Steelman", name: "Archive · Steelman", stage: "steelman" });
addArchiveCheckpoint({ source: "Store Logic", name: "Archive · Logic", stage: "logic" });
addArchiveCheckpoint({ source: "Store Fact Check", name: "Archive · Fact Check", stage: "fact_check" });
addArchiveCheckpoint({ source: "Assemble Response", name: "Archive · Completed", stage: "completed", status: "success", success: true });

const workflow = {
  name: "Thesis Arena · Analyze Claim",
  nodes,
  connections,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataErrorExecution: "all",
    saveDataSuccessExecution: "all",
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);
console.log(`Nodes: ${nodes.length}`);
console.log(`Webhook authentication: ${webhookCredentialId ? "headerAuth" : "none (inactive build only)"}`);
