# Built with ChatGPT, Codex, and GPT-5.6

## Where the idea came from

About a year before OpenAI Build Week, I ran a small remote workshop where
people learned to build AI agents with n8n. The participants arrived with very
different project ideas. One wanted a scientific fact checker; others were
interested in debate, education, or multi-agent automation.

I needed one shared project that exposed enough of the stack to be useful to
everyone. The result was a debate-training workflow: it decomposed a position,
checked its internal logic, challenged it, and delegated externally verifiable
claims to a separate fact-checking agent. Later we added text-to-speech as an
educational extra.

The workflow taught the architecture well, but it had a communication problem.
Someone looking at a collection of n8n nodes could not immediately see what the
agents were doing or why their separation mattered. The product insight behind
Thesis Arena was to make that invisible analytical process legible: one thesis
enters, several independent perspectives examine it, and a stronger formulation
comes out.

Another reference point was [Moltbook](https://www.moltbook.com/), whose
Reddit-like presentation made interactions between software agents immediately
visible to an outside observer. The useful lesson was not to build another
social feed, but to give an abstract multi-agent process a familiar visual
grammar. Thesis Arena applies that lesson to reasoning while deliberately
presenting the result as an analytical workspace rather than a social network.

The idea remained an experimental side project until OpenAI Build Week created
a reason to turn it into a complete, demonstrable product.

## Product and design work in ChatGPT

ChatGPT was used as the thinking environment for the full product cycle:

- turning the original debate trainer into a focused argument stress test;
- choosing the visible analytical roles and strict MVP boundary;
- incorporating Toulmin-style claim decomposition and double-crux reasoning;
- defining the canonical JSON response contract;
- developing the Thesis Arena positioning and visual direction;
- iterating on the brand book, Arena Ring identity, and interface reference;
- reviewing implementation results and prioritizing product changes.

All product reasoning and implementation assistance happened inside ChatGPT and
Codex. No second coding assistant was used.

## What Codex built

Codex handled the implementation and deployment loop inside the real project
workspace:

1. Built the dependency-free single-page frontend from the approved visual
   reference.
2. Added initial, progressive loading, partial-result, completed, and error
   states.
3. Implemented expandable lens reports without disturbing the reading position
   as later agents complete.
4. Built a dedicated A4 report renderer for browser-native PDF export.
5. Created the strict shared JSON contract and deterministic mock fixtures.
6. Generated the main, status, and saved-execution retry n8n workflows.
7. Connected PostgreSQL persistence, run checkpoints, ownership checks, and
   account quotas.
8. Diagnosed a production `524` timeout and replaced the long blocking request
   with immediate acknowledgement plus status polling and progressive delivery.
9. Deployed behind an isolated Nginx route with Basic Auth, rate limits, and
   server-side credential injection.
10. Audited real n8n executions and PostgreSQL records after live test runs.

Codex did not merely write a static mockup. It worked across frontend behavior,
workflow generation, database design, deployment, observability, debugging, and
production verification.

## How GPT-5.6 is used in the product

The live analytical layer uses six GPT-5.6 Luna nodes through OpenRouter:

- Claim Mapper;
- Red Team;
- Steelman;
- Logic;
- Fact Check (`gpt-5.6-luna:online` for cited web evidence);
- Synthesizer.

OpenRouter is the transport layer; GPT-5.6 performs the analysis. Automatic
fallback to unrelated models is not part of the product design. The actual model
identifier and execution duration are recorded with every completed run.

## Key decisions made during the build

### Structure before personality

The agents have memorable names in the interface, but each is constrained by a
method: claim mapping, adversarial review, steelmanning, logical analysis,
evidence checking, and synthesis. This prevents the product from becoming four
parallel opinion prompts.

### Progressive delivery instead of a blocking request

The first live implementation waited for the entire n8n workflow and could hit
an upstream timeout even when the analysis completed successfully. The final
architecture acknowledges the run immediately, persists checkpoints, and lets
the frontend poll a read-only status endpoint. Users can read completed modules
while later modules are still running.

### One data contract for every surface

Mock mode, the live workflow, the interactive UI, PostgreSQL, and the printable
report all use the same validated response object. This reduced integration
ambiguity and made local testing possible without paid model calls.

### HTML print layout instead of screenshot-based PDF generation

The report is a dedicated print document with A4 CSS, native text, controlled
page breaks, and vector rendering. It avoids the blurred text and unstable page
splitting common to canvas-to-PDF approaches.

## What I learned

- A multi-agent product becomes useful only when the agents exchange structured
  artifacts rather than unbounded prose.
- Progressive results are not just loading polish; they change a two-minute wait
  into useful reading time.
- Execution history is excellent for debugging, but durable product observability
  belongs in a real database.
- The most valuable role of Codex was continuity across layers: the same working
  session could reason about UI behavior, n8n data flow, SQL state, Nginx, and the
  live deployment.
