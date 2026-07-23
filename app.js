(function () {
  const config = window.THESIS_ARENA_CONFIG;
  const locale = document.documentElement.lang === "ru" ? "ru" : "en";
  const isRussian = locale === "ru";
  const storageKey = isRussian ? "thesis-arena-report-ru" : "thesis-arena-report";
  const copy = isRussian ? {
    analyze: "Анализировать тезис",
    analyzeAgain: "Проанализировать снова",
    analyzeRevision: "Анализировать новую версию",
    pending: "Ожидание",
    connecting: "Подключение…",
    submitting: "Отправляем тезис в защищённый workflow.",
    opening: "Открываем арену",
    progress: "Анализ выполняется",
    stillRunning: "Workflow продолжает работу.",
    justNow: "Только что",
    sources: "Источники",
    openReport: "Открыть полный отчёт",
    closeReport: "Закрыть полный отчёт",
    fullReport: "Полный отчёт",
    findings: "выводов",
    waitingLens: "Ожидаем эту линзу…",
    decisiveQuestion: "Решающий вопрос",
    survived: "Что выдержало проверку",
    failed: "Что не выдержало проверку",
    assumptions: "Скрытые допущения",
    crux: "Ключевая развилка",
    improved: "Улучшенный тезис",
    stressAgain: "Проверить эту версию",
    export: "Экспортировать отчёт",
    reportError: "Не удалось подготовить отчёт в этом браузере.",
    execution: "Запуск",
    model: "Модель",
    duration: "Длительность",
    notProvided: "нет данных",
    interrupted: "Анализ был прерван.",
    retry: "Повторить анализ",
    resume: "Продолжить прерванный запуск",
    resuming: "Продолжаем сохранённый запуск",
    resumingNode: (node) => `n8n продолжает работу с узла ${node}. Уже завершённые платные этапы сохранены.`,
    resumingGeneric: "n8n продолжает сохранённый запуск с последней контрольной точки.",
    shortClaim: "Введите законченный тезис длиной не менее 12 символов.",
    invalidContract: "Ответ не соответствует контракту Thesis Arena v1.",
    endpointMissing: "Endpoint рабочего workflow не настроен.",
    requestFailed: (status) => `Запрос завершился со статусом ${status}.`,
    noExecution: "n8n принял запрос, но не вернул ID запуска.",
    workflowStopped: "Запуск n8n остановился до завершения.",
    waitTimeout: "Анализ всё ещё выполняется, но страница прекратила ожидание через десять минут.",
    live: "Рабочий анализ",
    local: "Локальный анализ",
    agentNames: { red_team: "Красная команда", steelman: "Усиление аргумента", logic: "Логика", fact_check: "Проверка фактов" },
    stages: {
      queued: ["Запуск принят", "n8n поставил анализ в очередь."],
      mapping: ["Строим карту тезиса", "Разбиваем исходную мысль на проверяемые утверждения."],
      lenses: ["Применяем аналитические линзы", "Готовые модули появляются ниже по мере обработки."],
      fact_check: ["Проверяем источники", "Проверяем внешне верифицируемые утверждения по актуальным источникам."],
      synthesis: ["Собираем синтез", "Сопоставляем выводы агентов и уточняем формулировку тезиса."],
      completed: ["Анализ завершён", "Полный результат готов."],
    },
  } : null;
  const elements = {
    body: document.body,
    form: document.querySelector("#claim-form"),
    input: document.querySelector("#claim-input"),
    count: document.querySelector("#character-count"),
    formError: document.querySelector("#claim-error"),
    button: document.querySelector("#analyze-button"),
    buttonLabel: document.querySelector(".analyze-button__label"),
    modeLabel: document.querySelector("#mode-label"),
    inputBadge: document.querySelector("#input-complete-badge"),
    region: document.querySelector("#analysis-region"),
    loading: document.querySelector("#analysis-loading"),
    progressTitle: document.querySelector("#progress-title"),
    progressSteps: document.querySelectorAll("#progress-steps li"),
    progressExecution: document.querySelector("#progress-execution"),
    progressElapsed: document.querySelector("#progress-elapsed"),
    progressHeartbeat: document.querySelector("#progress-heartbeat"),
    progressDetail: document.querySelector("#progress-detail"),
    errorPanel: document.querySelector("#analysis-error-panel"),
    errorMessage: document.querySelector("#analysis-error-message"),
    retryButton: document.querySelector("#retry-button"),
    results: document.querySelector("#analysis-results"),
    claimMapSection: document.querySelector("#claim-map-section"),
    claimMap: document.querySelector("#claim-map"),
    lensesSection: document.querySelector("#lenses-section"),
    lensesGrid: document.querySelector("#lenses-grid"),
    lensReportPanel: document.querySelector("#lens-report-panel"),
    synthesisSection: document.querySelector("#synthesis-section"),
    synthesisGrid: document.querySelector("#synthesis-grid"),
    meta: document.querySelector("#analysis-meta"),
  };

  const icons = {
    red_team: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m7 6 19 19M25 6 6 25M9 4l4 4-5 5-4-4 5-5Zm14 0-4 4 5 5 4-4-5-5ZM9 28l4-4-5-5-4 4 5 5Zm14 0-4-4 5-5 4 4-5 5Z"/></svg>',
    steelman: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c4 3 8 3 11 4v8c0 7-4 11-11 14C9 26 5 22 5 15V7c3-1 7-1 11-4Z"/><path d="m11 16 3 3 7-8"/></svg>',
    logic: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 6a5 5 0 0 0-9 3 5 5 0 0 0 1 9 5 5 0 0 0 7 7l4 3 4-3a5 5 0 0 0 7-7 5 5 0 0 0 1-9 5 5 0 0 0-9-3l-3-3-3 3Z"/><path d="M12 11h1m6 0h1m-8 5h1m6 0h1m-8 5h1m6 0h1M16 8v16"/></svg>',
    fact_check: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/></svg>',
    survived: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    failed: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
    assumptions: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 9a2.2 2.2 0 0 1 4 1.3c0 1.7-2 2-2 3.7m0 3h.01"/></svg>',
    crux: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/></svg>',
    improved: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4M8 15c-1.3-1-2-2.6-2-4.4a6 6 0 1 1 12 0c0 1.8-.7 3.4-2 4.4-.7.6-1 1-1 2H9c0-1-.3-1.4-1-2Z"/></svg>',
  };

  const agentOrder = ["red_team", "steelman", "logic", "fact_check"];
  const allowedTones = new Set(["red", "teal", "blue", "amber"]);
  const allowedSeverity = new Set(["low", "medium", "high"]);
  let currentAnalysis = null;
  let currentState = "initial";
  let progressTimers = [];
  let progressInterval = null;
  let activeRun = null;
  let failedRun = null;
  let wakePoll = null;
  let hasPartialResults = false;
  let lastPartialSignature = "";
  let activeLensKey = null;
  let currentAccess = null;
  const mobileLensLayout = window.matchMedia("(max-width: 560px)");

  function syncLensReportPlacement() {
    const activeCard = activeLensKey
      ? elements.lensesGrid.querySelector(`[data-agent="${activeLensKey}"]`)
      : null;

    if (mobileLensLayout.matches && activeCard) {
      activeCard.after(elements.lensReportPanel);
      return;
    }

    elements.lensesGrid.after(elements.lensReportPanel);
  }

  if (typeof mobileLensLayout.addEventListener === "function") {
    mobileLensLayout.addEventListener("change", syncLensReportPlacement);
  } else {
    mobileLensLayout.addListener(syncLensReportPlacement);
  }

  const baseModeLabel = isRussian
    ? (config.mode === "webhook" ? copy.live : copy.local)
    : (config.mode === "webhook" ? "Live analysis" : "Local analysis");

  function updateAccessIndicator(access) {
    if (!access || config.mode !== "webhook") {
      elements.modeLabel.textContent = baseModeLabel;
      return;
    }
    currentAccess = access;
    if (access.unlimited) {
      elements.modeLabel.textContent = `${baseModeLabel} · ${isRussian ? "без лимита" : "unlimited"}`;
      return;
    }
    const remaining = Math.max(0, Number(access.remaining_attempts ?? 0));
    elements.modeLabel.textContent = isRussian
      ? `${baseModeLabel} · осталось анализов: ${remaining}`
      : `${baseModeLabel} · ${remaining} ${remaining === 1 ? "analysis" : "analyses"} left`;
  }

  function normalizedClaim() {
    return elements.input.value.replace(/\s+/g, " ").trim();
  }

  function safeTone(tone, fallback = "blue") {
    return allowedTones.has(tone) ? tone : fallback;
  }

  function safeSeverity(severity) {
    return allowedSeverity.has(severity) ? severity : "medium";
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function validateAnalysis(data) {
    const validInput = typeof data?.input?.thesis === "string";
    const validClaims = Array.isArray(data?.claims) && data.claims.length > 0 && data.claims.every((claim) =>
      typeof claim.id === "string" && typeof claim.text === "string" && typeof claim.type === "string");
    const validAgents = agentOrder.every((key) => {
      const agent = data?.agents?.[key];
      return agent && typeof agent.name === "string" && typeof agent.summary === "string" &&
        typeof agent.count_label === "string" && Array.isArray(agent.findings) &&
        agent.findings.length === agent.count && agent.findings.every((item) =>
          typeof item.title === "string" && typeof item.detail === "string" && Array.isArray(item.claim_ids));
    });
    const synthesis = data?.synthesis;
    const validSynthesis = synthesis && typeof synthesis.survived === "string" &&
      typeof synthesis.failed === "string" && Array.isArray(synthesis.hidden_assumptions) &&
      typeof synthesis.key_crux === "string" && typeof synthesis.improved_thesis === "string";

    if (!validInput || !validClaims || !validAgents || !validSynthesis) {
      throw new Error(isRussian ? copy.invalidContract : "The analysis response does not match the Thesis Arena v1 contract.");
    }
    return data;
  }

  function updateCharacterCount() {
    elements.count.textContent = `${elements.input.value.length} / ${elements.input.maxLength}`;
  }

  function resizeClaimInput() {
    const minHeight = currentState === "results" ? 54 : 94;
    const maxHeight = currentState === "results" ? 300 : 320;
    elements.input.style.height = "auto";
    const contentHeight = elements.input.scrollHeight;
    elements.input.style.height = `${Math.max(minHeight, Math.min(contentHeight, maxHeight))}px`;
    elements.input.classList.toggle("is-scrollable", contentHeight > maxHeight);
  }

  function setBusy(isBusy) {
    elements.button.disabled = isBusy;
    elements.button.classList.toggle("is-loading", isBusy);
    elements.input.disabled = isBusy;
    elements.button.setAttribute("aria-busy", String(isBusy));
  }

  function setState(state) {
    currentState = state;
    elements.body.className = elements.body.className
      .split(" ")
      .filter((name) => !name.startsWith("app-state-"))
      .concat(`app-state-${state}`)
      .join(" ");

    elements.region.hidden = state === "initial";
    elements.loading.hidden = state !== "loading";
    elements.errorPanel.hidden = state !== "error";
    elements.results.hidden = state !== "results" && !(state === "loading" && hasPartialResults);
    elements.inputBadge.hidden = state !== "results";
    elements.buttonLabel.textContent = isRussian
      ? (state === "results" ? copy.analyzeAgain : copy.analyze)
      : (state === "results" ? "Analyze again" : "Analyze thesis");
    resizeClaimInput();
  }

  function clearProgress() {
    progressTimers.forEach((timer) => window.clearTimeout(timer));
    progressTimers = [];
    elements.progressSteps.forEach((step) => step.classList.remove("is-active", "is-complete"));
    if (progressInterval) window.clearInterval(progressInterval);
    progressInterval = null;
  }

  function formatElapsed(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function startProgress() {
    clearProgress();
    activeRun = { executionId: null, startedAt: Date.now(), elapsedMs: 0 };
    elements.progressExecution.textContent = isRussian ? copy.pending : "Pending";
    elements.progressElapsed.textContent = "00:00";
    elements.progressHeartbeat.textContent = isRussian ? copy.connecting : "Connecting…";
    elements.progressDetail.textContent = isRussian ? copy.submitting : "Submitting the thesis to the protected workflow.";
    elements.progressTitle.textContent = isRussian ? copy.opening : "Opening the arena";
    elements.progressSteps[0].classList.add("is-active");
    progressInterval = window.setInterval(() => {
      if (!activeRun) return;
      const elapsed = activeRun.elapsedMs || Date.now() - activeRun.startedAt;
      elements.progressElapsed.textContent = formatElapsed(elapsed);
    }, 1000);
  }

  function completeProgress() {
    clearProgress();
    elements.progressSteps.forEach((step) => step.classList.add("is-complete"));
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function postJson(url, payload) {
    if (!url) throw new Error(isRussian ? copy.endpointMissing : "The live workflow endpoint has not been configured.");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || (isRussian ? copy.requestFailed(response.status) : `Request failed with status ${response.status}.`));
        error.status = response.status;
        error.code = body.code || null;
        error.access = body.access || null;
        throw error;
      }
      return body;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchFromWebhook(thesis) {
    if (!config.n8nWebhookUrl) throw new Error("The n8n webhook URL has not been configured.");
    return postJson(config.n8nWebhookUrl, { thesis, language: locale, contract_version: "1.0" });
  }

  async function requestAnalysis(thesis) {
    if (config.mode === "webhook") {
      const accepted = await fetchFromWebhook(thesis);
      if (accepted?.input?.thesis) return accepted;
      if (!accepted?.execution_id) throw new Error(isRussian ? copy.noExecution : "n8n accepted the request without returning an execution ID.");
      if (accepted.access) {
        activeRun.access = accepted.access;
        updateAccessIndicator(accepted.access);
      }
      activeRun.executionId = String(accepted.execution_id);
      elements.progressExecution.textContent = activeRun.executionId;
      return pollExecution(activeRun.executionId);
    }
    await sleep(1680);
    return window.THESIS_ARENA_MOCKS.getAnalysis(thesis);
  }

  function updateProgress(status) {
    const stageIndexes = { queued: 0, mapping: 0, lenses: 1, fact_check: 2, synthesis: 3, completed: 4 };
    const activeIndex = stageIndexes[status.stage] ?? 0;
    elements.progressSteps.forEach((step, index) => {
      step.classList.toggle("is-complete", activeIndex === 4 || index < activeIndex);
      step.classList.toggle("is-active", activeIndex < 4 && index === activeIndex);
    });
    const localizedStage = isRussian ? copy.stages[status.stage] : null;
    elements.progressTitle.textContent = localizedStage?.[0] || status.stage_label || (isRussian ? copy.progress : "Analysis in progress");
    elements.progressDetail.textContent = localizedStage?.[1] || status.stage_detail || (isRussian ? copy.stillRunning : "The workflow is still running.");
    elements.progressExecution.textContent = status.execution_id || activeRun?.executionId || (isRussian ? copy.pending : "Pending");
    elements.progressHeartbeat.textContent = isRussian ? copy.justNow : "Just now";
    if (activeRun) {
      activeRun.executionId = status.execution_id || activeRun.executionId;
      activeRun.elapsedMs = Number(status.elapsed_ms) || Date.now() - activeRun.startedAt;
      elements.progressElapsed.textContent = formatElapsed(activeRun.elapsedMs);
    }
    if (status.partial) renderPartial(status.partial, status);
  }

  async function pollExecution(executionId) {
    const deadline = Date.now() + config.maxAnalysisWaitMs;
    while (Date.now() < deadline) {
      const status = await postJson(config.n8nStatusUrl, { execution_id: executionId });
      updateProgress(status);
      if (status.state === "completed") return status.analysis;
      if (["error", "crashed", "canceled", "not_found"].includes(status.state)) {
        const error = new Error(status.error || (isRussian ? copy.workflowStopped : "The n8n execution stopped before completion."));
        error.executionId = status.execution_id || executionId;
        error.retryable = Boolean(status.retryable);
        error.failedNode = status.failed_node || null;
        throw error;
      }
      await sleep(Number(status.poll_after_ms) || config.pollIntervalMs);
    }
    const error = new Error(isRussian ? copy.waitTimeout : "The analysis is still running, but this page stopped waiting after ten minutes.");
    error.executionId = executionId;
    error.retryable = false;
    throw error;
  }

  function createBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = text;
    return badge;
  }

  function renderClaimMap(claims) {
    elements.claimMap.replaceChildren();
    elements.claimMap.dataset.count = String(claims.length);
    claims.forEach((claim, index) => {
      const card = document.createElement("article");
      card.className = "claim-card";
      card.style.setProperty("--delay", `${index * 80}ms`);
      const number = createBadge(index + 1, "claim-card__number");
      const content = document.createElement("div");
      content.className = "claim-card__content";
      const text = document.createElement("h3");
      text.textContent = claim.text;
      const tag = createBadge(claim.label || claim.type.replaceAll("_", " "), `claim-tag tone-${safeTone(claim.tone)}`);
      content.append(text, tag);
      card.append(number, content);
      elements.claimMap.append(card);
      if (index < claims.length - 1) {
        const arrow = createBadge("→", "claim-arrow");
        arrow.setAttribute("aria-hidden", "true");
        elements.claimMap.append(arrow);
      }
    });
  }

  function renderFinding(finding, index, agentKey) {
    const item = document.createElement("li");
    item.className = "finding";
    const header = document.createElement("div");
    header.className = "finding__header";
    const number = createBadge(String(index + 1).padStart(2, "0"), "finding__number");
    const title = document.createElement("h4");
    title.textContent = finding.title;
    header.append(number, title);

    const badges = document.createElement("div");
    badges.className = "finding__badges";
    badges.append(createBadge(safeSeverity(finding.severity), `finding-badge severity-${safeSeverity(finding.severity)}`));
    finding.claim_ids.forEach((claimId) => badges.append(createBadge(claimId.toUpperCase(), "finding-badge claim-reference")));
    if (agentKey === "fact_check" && finding.status) {
      badges.append(createBadge(finding.status.replaceAll("_", " "), `finding-badge evidence-status status-${finding.status}`));
    }

    const detail = document.createElement("p");
    detail.textContent = finding.detail;
    item.append(header, badges, detail);

    if (Array.isArray(finding.sources) && finding.sources.length) {
      const sources = document.createElement("div");
      sources.className = "finding__sources";
      const label = document.createElement("span");
      label.textContent = isRussian ? copy.sources : "Sources";
      sources.append(label);
      finding.sources.forEach((source) => {
        const href = safeExternalUrl(source.url);
        const sourceElement = href ? document.createElement("a") : document.createElement("span");
        if (href) {
          sourceElement.href = href;
          sourceElement.target = "_blank";
          sourceElement.rel = "noopener noreferrer";
        }
        sourceElement.textContent = source.publisher ? `${source.publisher} — ${source.title}` : source.title;
        sources.append(sourceElement);
      });
      item.append(sources);
    }
    return item;
  }

  function renderLenses(agents) {
    elements.lensesGrid.after(elements.lensReportPanel);
    elements.lensesGrid.replaceChildren();
    const preserveOpenReport = activeLensKey && agents[activeLensKey];
    if (!preserveOpenReport) {
      activeLensKey = null;
      elements.lensReportPanel.replaceChildren();
      elements.lensReportPanel.hidden = true;
      elements.lensReportPanel.className = "lens-report-panel";
    }
    const controls = new Map();

    function setControlState(key, expanded) {
      const control = controls.get(key);
      if (!control) return;
      control.toggle.setAttribute("aria-expanded", String(expanded));
      control.label.textContent = isRussian
        ? (expanded ? copy.closeReport : copy.openReport)
        : (expanded ? "Close full report" : "Open full report");
      control.chevron.textContent = expanded ? "−" : "+";
      control.card.classList.toggle("is-active", expanded);
    }

    function renderSharedReport(key, agent) {
      const tone = safeTone(agent.tone);
      elements.lensReportPanel.replaceChildren();
      elements.lensReportPanel.className = `lens-report-panel tone-${tone}`;

      const reportHeading = document.createElement("div");
      reportHeading.className = "lens-report-panel__heading";
      const titleGroup = document.createElement("div");
      const eyebrow = createBadge(agent.name, "lens-report-panel__eyebrow");
      const reportTitle = document.createElement("h3");
      reportTitle.textContent = `${agent.name} · ${isRussian ? copy.fullReport : "Full report"}`;
      const reportSummary = document.createElement("p");
      reportSummary.textContent = agent.summary;
      titleGroup.append(eyebrow, reportTitle, reportSummary);
      const reportCount = createBadge(`${agent.findings.length} ${isRussian ? copy.findings : "findings"}`, "report-count");
      reportHeading.append(titleGroup, reportCount);

      const list = document.createElement("ol");
      list.className = "findings-list";
      agent.findings.forEach((finding, findingIndex) => list.append(renderFinding(finding, findingIndex, key)));
      elements.lensReportPanel.append(reportHeading, list);
      elements.lensReportPanel.hidden = false;
      syncLensReportPlacement();
    }

    agentOrder.forEach((key, index) => {
      const agent = agents[key];
      if (!agent) {
        const placeholder = document.createElement("article");
        placeholder.className = `lens-card lens-card--pending tone-${safeTone({ red_team: "red", steelman: "teal", logic: "blue", fact_check: "amber" }[key])}`;
        const pendingHeading = document.createElement("div");
        pendingHeading.className = "lens-card__heading";
        const pendingIcon = document.createElement("span");
        pendingIcon.className = "lens-card__icon";
        pendingIcon.innerHTML = icons[key];
        const pendingTitle = document.createElement("h3");
        pendingTitle.textContent = isRussian
          ? copy.agentNames[key]
          : { red_team: "Red Team", steelman: "Steelman", logic: "Logic", fact_check: "Fact Check" }[key];
        pendingHeading.append(pendingIcon, pendingTitle);
        const pendingState = document.createElement("p");
        pendingState.className = "lens-card__pending";
        pendingState.textContent = isRussian ? copy.waitingLens : "Waiting for this lens…";
        placeholder.append(pendingHeading, pendingState);
        elements.lensesGrid.append(placeholder);
        return;
      }
      const tone = safeTone(agent.tone);
      const card = document.createElement("article");
      card.className = `lens-card tone-${tone}`;
      card.dataset.agent = key;
      card.style.setProperty("--delay", `${220 + index * 80}ms`);

      const heading = document.createElement("div");
      heading.className = "lens-card__heading";
      const icon = document.createElement("span");
      icon.className = "lens-card__icon";
      icon.innerHTML = icons[key];
      const title = document.createElement("h3");
      title.textContent = agent.name;
      heading.append(icon, title);

      const accent = document.createElement("div");
      accent.className = "lens-card__accent";
      accent.setAttribute("aria-hidden", "true");
      const summary = document.createElement("p");
      summary.className = "lens-card__summary";
      summary.textContent = agent.summary;
      const metric = createBadge(`${agent.findings.length} ${agent.count_label}`, "lens-card__metric");

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "lens-card__toggle";
      toggle.dataset.agentToggle = key;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "lens-report-panel");
      const toggleLabel = document.createElement("span");
      toggleLabel.textContent = isRussian ? copy.openReport : "Open full report";
      const chevron = document.createElement("span");
      chevron.className = "lens-card__chevron";
      chevron.textContent = "+";
      chevron.setAttribute("aria-hidden", "true");
      toggle.append(toggleLabel, chevron);

      controls.set(key, { toggle, label: toggleLabel, chevron, card });

      toggle.addEventListener("click", () => {
        if (activeLensKey === key) {
          setControlState(key, false);
          activeLensKey = null;
          elements.lensReportPanel.hidden = true;
          elements.lensReportPanel.replaceChildren();
          syncLensReportPlacement();
          return;
        }

        if (activeLensKey) setControlState(activeLensKey, false);
        activeLensKey = key;
        setControlState(key, true);
        renderSharedReport(key, agent);
      });

      card.append(heading, accent, summary, metric, toggle);
      elements.lensesGrid.append(card);
    });

    if (preserveOpenReport) {
      setControlState(activeLensKey, true);
      syncLensReportPlacement();
    }
  }

  function synthesisCard(key, label, tone, value) {
    const card = document.createElement("article");
    card.className = `synthesis-card synthesis-card--${key} tone-${tone}`;
    const heading = document.createElement("div");
    heading.className = "synthesis-card__heading";
    const icon = document.createElement("span");
    icon.innerHTML = icons[key];
    const title = document.createElement("h3");
    title.textContent = label;
    heading.append(icon, title);
    card.append(heading);

    if (Array.isArray(value)) {
      const list = document.createElement("ul");
      list.className = "assumptions-list";
      value.forEach((assumption) => {
        const item = document.createElement("li");
        item.textContent = assumption;
        list.append(item);
      });
      card.append(list);
    } else {
      const body = document.createElement("p");
      body.textContent = value;
      card.append(body);
    }
    return card;
  }

  function renderSynthesis(data) {
    elements.synthesisGrid.replaceChildren();
    const crux = synthesisCard("crux", isRussian ? copy.crux : "Key crux", "teal", data.key_crux);
    const cruxKicker = document.createElement("span");
    cruxKicker.className = "synthesis-card__kicker";
    cruxKicker.textContent = isRussian ? copy.decisiveQuestion : "Decisive question";
    crux.querySelector(".synthesis-card__heading").append(cruxKicker);

    elements.synthesisGrid.append(
      synthesisCard("survived", isRussian ? copy.survived : "What survived", "teal", data.survived),
      synthesisCard("failed", isRussian ? copy.failed : "What failed", "red", data.failed),
      synthesisCard("assumptions", isRussian ? copy.assumptions : "Hidden assumptions", "blue", data.hidden_assumptions),
      crux,
    );

    const improved = synthesisCard("improved", isRussian ? copy.improved : "Improved thesis", "amber", data.improved_thesis);
    const actions = document.createElement("div");
    actions.className = "synthesis-actions";

    const stressTestAction = document.createElement("button");
    stressTestAction.type = "button";
    stressTestAction.className = "stress-test-button";
    stressTestAction.innerHTML = `<span>${isRussian ? copy.stressAgain : "Stress-test this version"}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>`;
    stressTestAction.addEventListener("click", () => {
      elements.input.value = data.improved_thesis;
      updateCharacterCount();
      resizeClaimInput();
      elements.form.requestSubmit();
    });

    const exportAction = document.createElement("button");
    exportAction.type = "button";
    exportAction.className = "export-button";
    exportAction.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 14v3h12v-3" /></svg><span>${isRussian ? copy.export : "Export report"}</span>`;
    exportAction.addEventListener("click", openReport);

    actions.append(stressTestAction, exportAction);
    improved.append(actions);
    elements.synthesisGrid.append(improved);
  }

  function openReport() {
    if (!currentAnalysis) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(currentAnalysis));
      window.location.assign("report.html");
    } catch {
      elements.formError.textContent = isRussian ? copy.reportError : "The report could not be prepared in this browser.";
    }
  }

  function renderMeta(meta = {}) {
    elements.meta.replaceChildren();
    const model = meta.mode === "live"
      ? "6 GPT-5.6 Luna agents · n8n-orchestrated"
      : meta.model || "not provided";
    const values = [
      [isRussian ? copy.execution : "Execution", meta.execution_id || (isRussian ? copy.notProvided : "not provided")],
      [isRussian ? copy.model : "Model", model],
      [isRussian ? copy.duration : "Duration", Number.isFinite(meta.duration_ms) ? `${(meta.duration_ms / 1000).toFixed(2)} s` : (isRussian ? copy.notProvided : "not provided")],
    ];
    values.forEach(([label, value]) => {
      const group = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = label;
      group.append(strong, document.createTextNode(value));
      elements.meta.append(group);
    });
  }

  function renderAnalysis(data) {
    elements.claimMapSection.hidden = false;
    elements.lensesSection.hidden = false;
    elements.synthesisSection.hidden = false;
    renderClaimMap(data.claims);
    renderLenses(data.agents);
    renderSynthesis(data.synthesis);
    renderMeta(data.meta);
    updateAccessIndicator(data.meta?.access || currentAccess);
  }

  function renderPartial(partial, status = {}) {
    const claims = Array.isArray(partial.claims) ? partial.claims : [];
    const agents = partial.agents && typeof partial.agents === "object" ? partial.agents : {};
    const signature = JSON.stringify({
      claims: claims.length,
      agents: agentOrder.filter((key) => agents[key]).map((key) => `${key}:${agents[key].findings?.length || 0}`),
      synthesis: Boolean(partial.synthesis),
    });
    if (signature === lastPartialSignature) return;
    lastPartialSignature = signature;
    hasPartialResults = claims.length > 0 || Object.keys(agents).length > 0;
    elements.results.hidden = !hasPartialResults;
    elements.claimMapSection.hidden = claims.length === 0;
    elements.lensesSection.hidden = claims.length === 0;
    elements.synthesisSection.hidden = !partial.synthesis;
    if (claims.length) renderClaimMap(claims);
    if (claims.length) renderLenses(agents);
    if (partial.synthesis) renderSynthesis(partial.synthesis);
    renderMeta({
      execution_id: status.execution_id,
      model: partial.meta?.model || "GPT-5.6 · live workflow",
      duration_ms: status.elapsed_ms,
      mode: "live",
    });
    updateAccessIndicator(partial.meta?.access || currentAccess);
  }

  function showError(error) {
    const message = error?.name === "AbortError"
      ? (isRussian ? "Время ожидания истекло. Проверьте workflow и повторите попытку." : "The analysis timed out. Check the workflow and try again.")
      : error?.message || (isRussian ? copy.interrupted : "The analysis could not be completed.");
    elements.errorMessage.textContent = message;
    if (error?.access) updateAccessIndicator(error.access);
    failedRun = error?.executionId ? {
      executionId: String(error.executionId),
      retryable: Boolean(error.retryable),
      failedNode: error.failedNode || null,
    } : null;
    elements.retryButton.textContent = isRussian
      ? (failedRun?.retryable ? copy.resume : copy.retry)
      : (failedRun?.retryable ? "Resume failed run" : "Retry analysis");
    elements.retryButton.hidden = error?.code === "quota_exhausted";
    setState("error");
  }

  async function retryFailedRun() {
    if (!failedRun?.retryable || !config.n8nRetryUrl) return runAnalysis();
    const savedRun = failedRun;
    failedRun = null;
    setBusy(true);
    setState("loading");
    startProgress();
    activeRun.executionId = savedRun.executionId;
    elements.progressExecution.textContent = savedRun.executionId;
    elements.progressTitle.textContent = isRussian ? copy.resuming : "Resuming the saved run";
    elements.progressDetail.textContent = savedRun.failedNode
      ? (isRussian ? copy.resumingNode(savedRun.failedNode) : `n8n is resuming from ${savedRun.failedNode}. Completed paid steps are preserved.`)
      : (isRussian ? copy.resumingGeneric : "n8n is resuming the saved execution from its last checkpoint.");
    try {
      await postJson(config.n8nRetryUrl, { execution_id: savedRun.executionId });
      const data = validateAnalysis(await pollExecution(savedRun.executionId));
      completeProgress();
      currentAnalysis = data;
      sessionStorage.setItem(storageKey, JSON.stringify(data));
      renderAnalysis(data);
      setState("results");
    } catch (error) {
      clearProgress();
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    const thesis = normalizedClaim();
    if (thesis.length < 12) {
      elements.formError.textContent = isRussian ? copy.shortClaim : "Enter a complete claim of at least 12 characters.";
      elements.input.focus();
      return;
    }

    elements.formError.textContent = "";
    elements.retryButton.hidden = false;
    failedRun = null;
    hasPartialResults = false;
    lastPartialSignature = "";
    activeLensKey = null;
    elements.lensReportPanel.replaceChildren();
    elements.lensReportPanel.hidden = true;
    elements.results.hidden = true;
    setBusy(true);
    setState("loading");
    startProgress();
    elements.region.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const data = validateAnalysis(await requestAnalysis(thesis));
      completeProgress();
      currentAnalysis = data;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // The analysis remains usable even when session storage is unavailable.
      }
      renderAnalysis(data);
      setState("results");
      elements.region.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      clearProgress();
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  elements.input.addEventListener("input", () => {
    updateCharacterCount();
    resizeClaimInput();
    if (elements.formError.textContent) elements.formError.textContent = "";
    if (currentState === "results") {
      const matchesResult = normalizedClaim() === currentAnalysis?.input?.thesis;
      elements.inputBadge.hidden = !matchesResult;
      elements.buttonLabel.textContent = isRussian
        ? (matchesResult ? copy.analyzeAgain : copy.analyzeRevision)
        : (matchesResult ? "Analyze again" : "Analyze revision");
    }
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runAnalysis();
  });

  elements.retryButton.addEventListener("click", retryFailedRun);

  updateAccessIndicator(null);
  updateCharacterCount();
  try {
    const stored = sessionStorage.getItem(storageKey);
    const restored = stored ? validateAnalysis(JSON.parse(stored)) : null;
    if (restored) {
      currentAnalysis = restored;
      elements.input.value = restored.input.thesis;
      updateCharacterCount();
      resizeClaimInput();
      renderAnalysis(restored);
      setState("results");
    } else {
      setState("initial");
    }
  } catch {
    sessionStorage.removeItem(storageKey);
    setState("initial");
  }
})();
