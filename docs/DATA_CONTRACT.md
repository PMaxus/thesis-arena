# Analysis data contract

The canonical machine-readable contract is [`../analysis-schema.json`](../analysis-schema.json).
The browser UI, report renderer, mock fixtures, PostgreSQL archive, and n8n
workflows all consume the same object.

## Top-level shape

```text
input
claims[]
agents
  red_team
  steelman
  logic
  fact_check
synthesis
meta
```

Each lens has two levels of detail:

- `summary` and `count_label` drive the compact card;
- `findings[]` drives the expandable full report.

Important invariants:

- `agents.*.count` equals `agents.*.findings.length`;
- every `claim_id` refers to an item in `claims[]`;
- Fact Check uses explicit evidence statuses rather than invented percentages;
- citations belong to the Fact Check finding they support;
- `synthesis.hidden_assumptions` is an array;
- `meta.execution_id`, model information, and duration come from the live run.

The strict contract is the boundary between the visual product and the n8n
orchestration layer. It allows deterministic mock testing and prevents one
malformed model response from silently breaking the page.
