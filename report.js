(function () {
  const isRussian = document.documentElement.lang === "ru";
  const storageKey = isRussian ? "thesis-arena-report-ru" : "thesis-arena-report";
  const labels = isRussian ? {
    execution: "Запуск",
    model: "Модель",
    duration: "Длительность",
    notProvided: "нет данных",
    seconds: "сек.",
    sources: "Источники",
    survived: "Что выдержало проверку",
    failed: "Что не выдержало проверку",
    assumptions: "Скрытые допущения",
    crux: "Ключевая развилка",
    improved: "Улучшенный тезис",
    severity: { low: "низкая", medium: "средняя", high: "высокая" },
    status: {
      supported: "подтверждено",
      partially_supported: "частично подтверждено",
      mixed: "смешанные данные",
      unsupported: "не подтверждено",
      insufficient_evidence: "недостаточно данных",
    },
  } : null;
  const report = document.querySelector("#report");
  const empty = document.querySelector("#report-empty");
  const printButton = document.querySelector("#print-button");
  const agentOrder = ["red_team", "steelman", "logic", "fact_check"];

  function textElement(tag, text, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function renderMeta(meta = {}) {
    const container = document.querySelector("#report-meta");
    const values = [
      [isRussian ? labels.execution : "Execution", meta.execution_id || (isRussian ? labels.notProvided : "not provided")],
      [isRussian ? labels.model : "Model", meta.mode === "live" ? "6 GPT-5.6 Luna agents · n8n-orchestrated" : (meta.model || (isRussian ? labels.notProvided : "not provided"))],
      [isRussian ? labels.duration : "Duration", Number.isFinite(meta.duration_ms) ? `${(meta.duration_ms / 1000).toFixed(2)} ${isRussian ? labels.seconds : "seconds"}` : (isRussian ? labels.notProvided : "not provided")],
    ];
    values.forEach(([label, value]) => {
      const group = document.createElement("span");
      group.append(textElement("strong", label), document.createTextNode(value));
      container.append(group);
    });
  }

  function renderClaims(claims) {
    const container = document.querySelector("#report-claims");
    claims.forEach((claim, index) => {
      const card = document.createElement("article");
      card.append(
        textElement("span", String(index + 1).padStart(2, "0"), "report-claim__number"),
        textElement("h3", claim.text),
        textElement("span", claim.label || claim.type.replaceAll("_", " "), "report-tag"),
      );
      container.append(card);
    });
  }

  function renderFinding(finding, index) {
    const item = document.createElement("article");
    item.className = "report-finding";
    const heading = document.createElement("div");
    heading.className = "report-finding__heading";
    heading.append(textElement("span", String(index + 1).padStart(2, "0")), textElement("h4", finding.title));
    item.append(heading);

    const badges = document.createElement("div");
    badges.className = "report-finding__badges";
    const severity = finding.severity || "medium";
    badges.append(textElement("span", isRussian ? (labels.severity[severity] || severity) : severity));
    finding.claim_ids.forEach((claimId) => badges.append(textElement("span", claimId.toUpperCase())));
    if (finding.status) badges.append(textElement("span", isRussian ? (labels.status[finding.status] || finding.status) : finding.status.replaceAll("_", " ")));
    item.append(badges, textElement("p", finding.detail));

    if (Array.isArray(finding.sources) && finding.sources.length) {
      const sources = document.createElement("div");
      sources.className = "report-sources";
      sources.append(textElement("strong", isRussian ? labels.sources : "Sources"));
      finding.sources.forEach((source) => {
        const href = safeUrl(source.url);
        if (!href) return;
        const link = document.createElement("a");
        link.href = href;
        link.textContent = `${source.publisher ? `${source.publisher} — ` : ""}${source.title}`;
        sources.append(link);
      });
      item.append(sources);
    }
    return item;
  }

  function renderAgents(agents) {
    const container = document.querySelector("#report-agents");
    agentOrder.forEach((key) => {
      const agent = agents[key];
      const section = document.createElement("section");
      section.className = `report-agent report-agent--${agent.tone || "blue"}`;
      const heading = document.createElement("div");
      heading.className = "report-agent__heading";
      const titleGroup = document.createElement("div");
      titleGroup.append(textElement("h3", agent.name), textElement("p", agent.summary));
      heading.append(titleGroup, textElement("span", `${agent.findings.length} ${agent.count_label}`, "report-agent__count"));
      section.append(heading);
      const list = document.createElement("div");
      list.className = "report-findings";
      agent.findings.forEach((finding, index) => list.append(renderFinding(finding, index)));
      section.append(list);
      container.append(section);
    });
  }

  function synthesisBlock(title, value, className = "") {
    const block = document.createElement("article");
    block.className = className;
    block.append(textElement("h3", title));
    if (Array.isArray(value)) {
      const list = document.createElement("ul");
      value.forEach((entry) => list.append(textElement("li", entry)));
      block.append(list);
    } else {
      block.append(textElement("p", value));
    }
    return block;
  }

  function renderSynthesis(synthesis) {
    const container = document.querySelector("#report-synthesis-grid");
    container.append(
      synthesisBlock(isRussian ? labels.survived : "What survived", synthesis.survived),
      synthesisBlock(isRussian ? labels.failed : "What failed", synthesis.failed),
      synthesisBlock(isRussian ? labels.assumptions : "Hidden assumptions", synthesis.hidden_assumptions),
      synthesisBlock(isRussian ? labels.crux : "Key crux", synthesis.key_crux, "report-key-crux"),
      synthesisBlock(isRussian ? labels.improved : "Improved thesis", synthesis.improved_thesis, "report-improved"),
    );
  }

  try {
    const raw = sessionStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : null;
    if (!data?.input?.thesis || !Array.isArray(data.claims) || !data.agents || !data.synthesis) throw new Error("Missing report");
    document.querySelector("#report-thesis").textContent = data.input.thesis;
    renderMeta(data.meta);
    renderClaims(data.claims);
    renderAgents(data.agents);
    renderSynthesis(data.synthesis);
    report.hidden = false;
  } catch {
    empty.hidden = false;
    printButton.hidden = true;
  }

  printButton.addEventListener("click", async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.print();
  });
})();
