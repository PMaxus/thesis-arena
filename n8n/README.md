# Thesis Arena n8n workflows

This directory contains sanitized, importable exports generated from the
scripts in `../scripts/`:

- `thesis-arena-workflow.json` starts and checkpoints an analysis;
- `thesis-arena-status-workflow.json` returns saved progressive results;
- `thesis-arena-retry-workflow.json` resumes a failed run from the latest safe
  checkpoint instead of repeating completed paid steps.

The analytical workflow uses six GPT-5.6 Luna model nodes:

1. Claim Mapper;
2. Red Team;
3. Steelman;
4. Logic;
5. Fact Check (`openai/gpt-5.6-luna:online`);
6. Synthesizer.

Fact Check is the only web-enabled lens. All user-facing results conform to
`../analysis-schema.json`; checkpoints and final results are persisted in
PostgreSQL.

## Configure credentials

The committed exports intentionally contain no production credential IDs,
workflow IDs, account names, webhook secrets, or API keys. Create the required
credentials in your own n8n instance, copy `.env.example` to a private `.env`,
and expose those values to the build process.

Required credential types:

- OpenRouter API credential;
- PostgreSQL credential;
- optional Header Auth credential for direct webhook protection;
- n8n API credential for the saved-execution retry workflow.

Generate the main workflow:

```powershell
node scripts/build-n8n-workflow.mjs
```

After importing it, set `THESIS_ARENA_ANALYSIS_WORKFLOW_ID` to the imported
workflow ID and generate the two control workflows:

```powershell
node scripts/build-n8n-control-workflows.mjs
```

Import all three JSON files, select the matching credentials if they were not
embedded during generation, verify the webhook paths, and activate the
workflows.

## Production boundary

In the reference deployment, the browser never receives an n8n secret. Nginx
authenticates the user, injects a trusted account identity, and forwards only
the three same-origin API routes. PostgreSQL enforces account quotas before any
paid model node runs.
