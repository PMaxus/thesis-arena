(function () {
  const claimTypes = {
    empirical_claim: "Empirical claim",
    causal_claim: "Causal claim",
    value_judgment: "Value judgment",
    prediction: "Prediction",
    generalization: "Generalization",
    main_claim: "Main claim",
    causal_warrant: "Causal warrant",
    scope_assumption: "Scope assumption",
  };

  function finding(id, title, detail, claimIds, severity = "medium", extra = {}) {
    return { id, title, detail, claim_ids: claimIds, severity, ...extra };
  }

  function agent(name, tone, summary, countLabel, findings) {
    return { name, tone, summary, count: findings.length, count_label: countLabel, findings };
  }

  function finalize(thesis, claims, agents, synthesis, executionId) {
    return {
      version: "1.0",
      input: { thesis },
      claims: claims.map((claim, index) => ({
        id: `c${index + 1}`,
        ...claim,
        label: claimTypes[claim.type] || claim.type,
      })),
      agents,
      synthesis,
      meta: {
        execution_id: executionId,
        model: "gpt-5.6 · mock response",
        duration_ms: 1840,
        mode: "mock",
      },
    };
  }

  function basicIncomeAnalysis(thesis) {
    const claims = [
      { text: "UBI improves economic security", type: "empirical_claim", tone: "amber" },
      { text: "Economic security improves wellbeing", type: "causal_claim", tone: "teal" },
      { text: "Social benefits outweigh economic costs", type: "value_judgment", tone: "amber" },
    ];

    const redTeam = [
      finding("rt1", "Funding mechanism is undefined", "The thesis assumes that a universal benefit can be financed without specifying tax increases, spending cuts, debt, or the programs it would replace.", ["c1", "c3"], "high"),
      finding("rt2", "Labor response is treated as constant", "Changes in labor participation may differ by income, caregiving obligations, age, and benefit design. A single aggregate claim hides these distributional effects.", ["c1", "c3"], "high"),
      finding("rt3", "Inflation risk depends on implementation", "A transfer funded through taxation is not economically equivalent to deficit financing. The original thesis does not distinguish between these mechanisms.", ["c3"], "high"),
      finding("rt4", "Universal and targeted programs solve different problems", "Universality can reduce stigma and administrative friction, but it may spend scarce resources on households that need them least.", ["c1", "c3"], "medium"),
      finding("rt5", "Wellbeing is underspecified", "Financial security, health, autonomy, and life satisfaction are related but not interchangeable outcomes. The thesis needs a measurable definition.", ["c2"], "medium"),
      finding("rt6", "Opportunity costs are missing", "The relevant comparison is not UBI versus nothing, but UBI versus other uses of the same fiscal capacity, such as housing, healthcare, or targeted transfers.", ["c3"], "high"),
      finding("rt7", "Pilot results may not scale", "Short, geographically limited experiments cannot fully reproduce national price effects, political durability, migration, or long-term behavioral adaptation.", ["c1", "c2"], "medium"),
    ];

    const steelman = [
      finding("st1", "A guaranteed floor improves resilience", "A predictable income floor can help households absorb job loss, illness, and volatile hours without waiting for eligibility decisions.", ["c1"], "high"),
      finding("st2", "Universality reduces administrative exclusion", "Simple eligibility can reduce non-take-up, paperwork, and the risk that vulnerable people fall through fragmented programs.", ["c1"], "medium"),
      finding("st3", "Cash preserves recipient agency", "Unlike tightly restricted benefits, cash allows households to prioritize the constraint that is most urgent in their own circumstances.", ["c1", "c2"], "medium"),
      finding("st4", "Security can improve decision quality", "Lower financial volatility may give people more capacity to plan, retrain, leave unsafe work, or manage caregiving responsibilities.", ["c2"], "medium"),
      finding("st5", "The defensible claim is conditional", "The strongest version treats UBI as a carefully funded income floor whose effects must be compared with realistic alternatives, not as an automatic cure.", ["c3"], "high"),
    ];

    const logic = [
      finding("lg1", "Security does not guarantee wellbeing", "The movement from income security to wellbeing is plausible, but it needs intermediate mechanisms and boundary conditions.", ["c2"], "high"),
      finding("lg2", "Individual benefit does not establish social net benefit", "Even if many recipients benefit, the conclusion must also account for financing, displacement, administrative change, and effects on non-recipients.", ["c3"], "high"),
      finding("lg3", "The quantifier is too broad", "The phrase “would improve society more than it would harm it” implies a stable net effect across designs and contexts that the premises do not establish.", ["c1", "c2", "c3"], "medium"),
    ];

    const factCheck = [
      finding("fc1", "Wellbeing effects are promising but contextual", "Basic-income experiments have reported improvements in perceived security and some wellbeing measures, but designs and populations vary.", ["c2"], "medium", {
        status: "partially_supported",
        sources: [{ title: "Results of Finland's basic income experiment", publisher: "Kela", url: "https://www.kela.fi/basic-income-experiment", relation: "supports" }],
      }),
      finding("fc2", "Employment effects are not uniform", "Available experiments do not support a single universal claim about labor supply. Effects depend on program design and participant group.", ["c1", "c3"], "high", {
        status: "mixed",
        sources: [{ title: "Basic income experiment research programme", publisher: "Kela", url: "https://www.kela.fi/basic-income-experiment", relation: "context" }],
      }),
      finding("fc3", "National inflation effects remain unresolved", "Small pilots generally cannot test economy-wide price effects, so this part of the argument requires macroeconomic modeling rather than pilot evidence alone.", ["c3"], "high", { status: "insufficient_evidence", sources: [] }),
      finding("fc4", "Fiscal impact cannot be evaluated without a design", "Cost estimates change radically with payment size, tax treatment, residency rules, and which existing programs remain in place.", ["c3"], "high", {
        status: "insufficient_evidence",
        sources: [{ title: "Social policy and income support", publisher: "OECD", url: "https://www.oecd.org/social/", relation: "context" }],
      }),
    ];

    return finalize(thesis, claims, {
      red_team: agent("Red Team", "red", "The thesis understates inflation, labor, targeting, and fiscal tradeoffs.", "pressure points", redTeam),
      steelman: agent("Steelman", "teal", "Strongest when framed as a targeted floor for dignity and stability.", "supporting arguments", steelman),
      logic: agent("Logic", "blue", "The central causal chain is plausible, but several links remain implicit.", "reasoning gaps", logic),
      fact_check: agent("Fact Check", "amber", "Core claims are testable, but the evidence varies by policy design.", "evidence findings", factCheck),
    }, {
      survived: "A guaranteed income floor can reduce precarity and help households absorb shocks.",
      failed: "The original wording overclaims net benefit without defining scope, funding, or implementation.",
      hidden_assumptions: ["Financing remains politically and fiscally stable", "Inflationary effects stay limited", "Labor participation does not fall enough to offset gains", "Universal delivery outperforms targeted alternatives"],
      key_crux: "Whether long-run social gains exceed fiscal and behavioral costs under a concrete, scalable policy design.",
      improved_thesis: "A carefully funded basic-income policy could improve wellbeing in some contexts, but its net value depends on design, fiscal tradeoffs, and measured outcomes.",
    }, "mock-ubi-001");
  }

  function remoteWorkAnalysis(thesis) {
    const claims = [
      { text: "Remote work reduces spontaneous collaboration", type: "causal_claim", tone: "teal" },
      { text: "Less spontaneous contact lowers team output", type: "causal_claim", tone: "teal" },
      { text: "The effect applies across most knowledge work", type: "generalization", tone: "amber" },
    ];

    const redTeam = [
      finding("rt1", "Deep-work gains are omitted", "Remote environments may reduce interruption and protect focus time, offsetting losses in spontaneous contact for some roles.", ["c2"], "high"),
      finding("rt2", "Commute costs are ignored", "Time, fatigue, and schedule rigidity from commuting can affect output and retention, but are absent from the comparison.", ["c2"], "medium"),
      finding("rt3", "Team age matters", "Established teams with shared context may coordinate remotely better than newly formed teams.", ["c3"], "high"),
      finding("rt4", "Work type is overgeneralized", "Independent analytical work and tightly coupled creative work have different coordination needs.", ["c3"], "high"),
      finding("rt5", "Management adaptation is assumed away", "Documentation, asynchronous norms, meeting design, and occasional co-location can replace some informal coordination.", ["c1", "c2"], "medium"),
      finding("rt6", "Productivity is not one metric", "Output quantity, quality, innovation, mentoring, and employee retention may move in different directions.", ["c2"], "high"),
    ];

    const steelman = [
      finding("st1", "Tacit knowledge is harder to transfer", "Unplanned observation and low-friction questions can matter for complex work that is difficult to document.", ["c1"], "high"),
      finding("st2", "New hires face a steeper context gap", "Remote onboarding can make it harder to learn informal norms and identify the right person to ask.", ["c1", "c2"], "high"),
      finding("st3", "Ambiguous work benefits from rapid alignment", "When goals and interfaces are changing, synchronous co-location may reduce iteration cost.", ["c2"], "medium"),
      finding("st4", "The defensible scope is narrower", "The claim is strongest for new or highly interdependent teams without mature remote operating practices.", ["c3"], "high"),
    ];

    const logic = [
      finding("lg1", "One mechanism is substituted for total output", "Reduced spontaneous interaction does not by itself establish lower overall productivity because other mechanisms may compensate.", ["c1", "c2"], "high"),
      finding("lg2", "Inevitable and every make the claim falsifiable by one counterexample", "The universal quantifiers are much stronger than the evidence needed for a conditional claim.", ["c3"], "high"),
    ];

    const factCheck = [
      finding("fc1", "Hybrid work can improve retention without harming measured performance", "A large randomized trial found lower attrition and no detected performance penalty in the studied organization.", ["c2", "c3"], "medium", {
        status: "unsupported",
        sources: [{ title: "Hybrid working from home improves retention without damaging performance", publisher: "Nature", url: "https://doi.org/10.1038/s41586-024-07500-2", relation: "contradicts" }],
      }),
      finding("fc2", "Fully remote and hybrid arrangements should not be conflated", "Evidence from hybrid schedules does not automatically establish effects for fully distributed teams.", ["c3"], "high", { status: "mixed", sources: [] }),
      finding("fc3", "Productivity measurement varies substantially", "Self-reports, manager ratings, output metrics, and innovation measures can produce different conclusions.", ["c2"], "medium", {
        status: "mixed",
        sources: [{ title: "Working from Home Research", publisher: "WFH Research", url: "https://wfhresearch.com/", relation: "context" }],
      }),
      finding("fc4", "Collaboration networks can become more siloed", "Some organizational studies report changes in communication patterns, but this is not identical to a universal fall in productivity.", ["c1", "c2"], "medium", { status: "partially_supported", sources: [] }),
      finding("fc5", "Long-term effects remain context dependent", "Technology, management practice, labor markets, and employee selection continue to change, limiting broad causal generalization.", ["c3"], "medium", { status: "insufficient_evidence", sources: [] }),
    ];

    return finalize(thesis, claims, {
      red_team: agent("Red Team", "red", "The thesis ignores deep-work gains, commute costs, and differences between team types.", "pressure points", redTeam),
      steelman: agent("Steelman", "teal", "It is strongest for new teams doing ambiguous, highly interdependent work.", "supporting arguments", steelman),
      logic: agent("Logic", "blue", "It jumps from one coordination mechanism to total productivity.", "reasoning gaps", logic),
      fact_check: agent("Fact Check", "amber", "Productivity measures and study populations must be specified before comparison.", "evidence findings", factCheck),
    }, {
      survived: "Remote work can weaken informal coordination and knowledge transfer in some teams.",
      failed: "A universal and inevitable productivity decline does not follow from that narrower effect.",
      hidden_assumptions: ["Collaboration always dominates focus time", "Managers cannot adapt their operating practices", "All teams depend on similar coordination patterns", "Productivity has one stable definition"],
      key_crux: "Which work outcomes matter, and for which kinds of teams does location change them over time?",
      improved_thesis: "Fully remote work can reduce coordination quality for new or highly interdependent teams unless deliberate practices replace informal contact.",
    }, "mock-remote-001");
  }

  function shorten(text, length) {
    if (text.length <= length) return text;
    return `${text.slice(0, length).replace(/\s+\S*$/, "")}…`;
  }

  function genericAnalysis(thesis) {
    const clean = thesis.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
    const claims = [
      { text: shorten(clean, 82), type: "main_claim", tone: "blue" },
      { text: "The proposed cause reliably produces the claimed outcome", type: "causal_warrant", tone: "teal" },
      { text: "The conclusion holds across the relevant contexts", type: "scope_assumption", tone: "amber" },
    ];
    const redTeam = [
      finding("rt1", "Scope is undefined", "The claim does not say which people, places, time horizon, or conditions are included.", ["c1", "c3"], "high"),
      finding("rt2", "Competing explanations are missing", "The same observation may be produced by causes other than the one proposed.", ["c2"], "high"),
      finding("rt3", "A likely counterexample is not addressed", "The thesis needs a boundary case that shows where it is expected not to hold.", ["c3"], "medium"),
      finding("rt4", "Key terms are not operationalized", "Important words in the conclusion need definitions that could be applied consistently.", ["c1"], "medium"),
      finding("rt5", "The comparison baseline is implicit", "A net-benefit claim requires a realistic alternative, not an unspecified status quo.", ["c1", "c2"], "high"),
    ];
    const steelman = [
      finding("st1", "Preserve the core intuition", "The thesis points to a coherent relationship that deserves testing rather than dismissal.", ["c1"], "medium"),
      finding("st2", "Add explicit conditions", "The argument becomes stronger when it names the circumstances in which the mechanism should operate.", ["c2", "c3"], "high"),
      finding("st3", "Choose a measurable outcome", "Replacing broad evaluation with an observable outcome makes the proposition testable.", ["c1"], "high"),
      finding("st4", "State the strongest warranted conclusion", "A conditional claim can remain useful without pretending to establish universality.", ["c3"], "medium"),
    ];
    const logic = [
      finding("lg1", "The causal warrant is implicit", "The argument needs to explain why its premise should produce the claimed outcome.", ["c2"], "high"),
      finding("lg2", "Correlation and causation are not separated", "Observed association alone would not rule out confounding or reverse causality.", ["c2"], "high"),
      finding("lg3", "The conclusion is broader than the premise", "The scope of the conclusion should not exceed the population and conditions supported by the premises.", ["c3"], "medium"),
    ];
    const factCheck = [
      finding("fc1", "The main proposition requires external evidence", "No source, population, time frame, or measurement rule is included in the input.", ["c1"], "high", { status: "insufficient_evidence", sources: [] }),
      finding("fc2", "The causal mechanism is testable in principle", "A useful search would look for comparative or longitudinal evidence that distinguishes the proposed cause from alternatives.", ["c2"], "medium", { status: "insufficient_evidence", sources: [] }),
      finding("fc3", "The scope statement is not yet verifiable", "The word “relevant” must be replaced with an explicit population or context before evidence can be assessed.", ["c3"], "medium", { status: "insufficient_evidence", sources: [] }),
      finding("fc4", "A live search layer is required", "This local mock identifies evidence needs but does not claim to have performed a current web search.", ["c1", "c2", "c3"], "low", { status: "not_searched", sources: [] }),
    ];

    return finalize(thesis, claims, {
      red_team: agent("Red Team", "red", "The wording leaves scope, alternatives, and likely counterexamples underdefined.", "pressure points", redTeam),
      steelman: agent("Steelman", "teal", "The core intuition becomes stronger after adding explicit conditions and boundaries.", "supporting arguments", steelman),
      logic: agent("Logic", "blue", "The conclusion needs a clearer warrant connecting its premise to the outcome.", "reasoning gaps", logic),
      fact_check: agent("Fact Check", "amber", "The claim mixes testable statements with interpretation; evidence criteria are missing.", "evidence findings", factCheck),
    }, {
      survived: "The thesis identifies a coherent relationship worth investigating rather than dismissing outright.",
      failed: "Its strongest wording reaches beyond what the stated reasoning currently establishes.",
      hidden_assumptions: ["Key terms have stable definitions", "Available evidence is representative", "Competing explanations are weaker", "The effect is similar across contexts"],
      key_crux: "What observable result would distinguish this explanation from the strongest competing explanation?",
      improved_thesis: `${shorten(clean, 150)} may hold under specific conditions, but its scope and supporting evidence need to be stated explicitly.`,
    }, "mock-generic-001");
  }

  window.THESIS_ARENA_MOCKS = {
    getAnalysis(thesis) {
      const normalized = thesis.toLowerCase();
      if (/basic[- ]income|\bubi\b|базов.*доход/.test(normalized)) return basicIncomeAnalysis(thesis);
      if (/remote work|work from home|удален|удалён/.test(normalized)) return remoteWorkAnalysis(thesis);
      return genericAnalysis(thesis);
    },
  };
})();
