# **AI Director Workstation**

> **The public portfolio showcase for GENIUSHUANG**
>
> A full-stack, multimodal workspace for AI film pre-production that turns ideas, scripts, reference files, and reusable assets into structured video prompts, image prompts, and script treatments—helping creators produce more cinematic, accurate AI-generated images and video.

Experience the complete product at [www.geniushuang.cn](https://www.geniushuang.cn).

This repository is the source-code repository for the public edition of **GENIUSHUANG — AI Director Workstation**. **GENIUSHUANG** is the complete product, available directly on the web. They are the public and complete editions of the same product, not two separate brands. It retains the complete product's primary features, interaction model, and reviewable engineering structure, while excluding its private knowledge base, internal prompt assets, evaluation cases, production databases, and other protected resources.

## Project overview

| Item | Details |
| --- | --- |
| Product | AI Director Workstation |
| Repository role | Runnable public portfolio showcase |
| Public-edition version | `1.0.0` |
| Development | May–July 2026; ongoing maintenance thereafter |
| Role | Independent Builder |
| Stack | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Route Handlers, SSE |
| Model integration | Server-side gateway compatible with Chat Completions |
| Public-edition storage | Local JSON files and file directories ignored by Git |
| Complete product | [www.geniushuang.cn](https://www.geniushuang.cn) |

The public and complete editions share the same product boundary: they interpret creative intent, organize reference material, and generate prompts or script text. They do not directly generate images or video, and they do not automatically call an external video-generation model.

## Project background

### Target users

The complete product is designed for creators who need to produce content consistently but do not yet have a systematic command of cinematic prompting:

- AI creators and short-form video operators.
- E-commerce content creators.
- MCN directors and producers.
- Small brand-content teams.
- Film professionals who want to reduce pre-production ideation time.

### Previous workflow

1. Start with a vague idea and repeatedly add shots, style, characters, locations, and negative constraints across several chat windows.
2. Study or copy long prompts from other creators, then manually rewrite them for a new project.
3. Keep reference images, character definitions, and location definitions scattered across local files and generation platforms.
4. When results disappoint, add more adjectives or restart without knowing whether the failure came from camera design, action, continuity, model fit, or prompt structure.

### Core pain points

- **Professional language barrier:** many creators cannot precisely express shot size, focal length, composition, camera movement, lighting, color, pacing, or action causality.
- **Cognitive and time cost:** long prompts require extensive reading, decomposition, and trial and error, which does not match the pace of content production.
- **Ambiguous creative intent:** concepts such as “premium” or “cinematic” have many visual interpretations, so short inputs often lead to generic results.
- **Continuity loss:** once characters, locations, props, references, and version relationships are scattered, visual rules begin to drift.
- **Unstructured failure correction:** users struggle to identify whether they should change the subject, action, camera, lighting, style constraints, or negative prompt.

## What the public edition demonstrates

The public edition is not a static interface mockup. It is an independent, runnable full-stack implementation.

| Workspace or capability | Public-edition experience |
| --- | --- |
| Director workspace | Turns an idea into a video prompt covering style, assets, shot content, and risk control |
| Image workflow | Produces creative direction, a positive prompt, and a negative prompt |
| Screenwriting workspace | Develops a scene from a story idea or revises existing script text |
| Reference material | Understands JPG/JPEG, PNG, WebP, and multiple text-oriented document formats |
| Named assets | Saves characters, locations, and props for reuse with `@asset-name` in supported workflows |
| History and versions | Reloads, edits, copies, refines, and reuses results across workspaces |
| Bilingual experience | Controls interface language and generation language independently |

### Controlled generation

- Video and image workflows return status, incremental text, errors, and final results through Server-Sent Events.
- Users can cancel a generation, provide further direction, edit versions, and generate again.
- The model client includes connection testing, timeouts, transient-error retries, and configurable model fallback.
- The final response reconciles streaming state at the end, preventing the interface from retaining only partial text.

### Multimodal reference material

- Image formats: JPG/JPEG, PNG, WebP.
- Document formats: TXT, MD, PDF, DOC/DOCX, CSV, TSV, JSON, XML, SRT, VTT, LOG, Fountain.
- Image understanding depends on the configured model service supporting multimodal `image_url` input.
- File types, file count, file size, and input length are validated on both the client and server.

## My responsibilities

As the Independent Builder, I owned the complete path from problem definition to production launch and the public portfolio showcase:

- **Product definition:** organized video prompting, image prompting, and screenwriting into separate but interoperable workspaces.
- **User experience:** designed creative input, reference files, named assets, streaming generation, version editing, history reuse, and bilingual controls.
- **Full-stack development:** implemented the frontend, server endpoints, and model gateway with Next.js, React, TypeScript, and Route Handlers.
- **AI workflows:** implemented retrieval intent, structured knowledge calls, a prompt compiler, and output contracts in the complete product.
- **Reliability:** added connection testing, timeouts, cancellation, retries, model fallback, input validation, and final-result reconciliation.
- **Secure release:** isolated public code from private knowledge assets, production databases, and credentials, and added pre-release sensitive-content checks.
- **Data-informed iteration:** analyzed real usage signals from the complete product and adjusted the product structure around failure patterns and user feedback.

## Key product decisions

- **Sell a workflow, not a template:** structured modules carry professional judgment and let users refine a specific part of the result.
- **Treat continuity as a first-class capability:** reference materials, named assets, and historical versions preserve character, location, and prop rules.
- **Keep generation controllable:** streaming feedback, cancellation, further direction, and editing reduce waiting and rework.
- **Use an independent public runtime:** demonstrate real product thinking and engineering ability while protecting the complete product's private knowledge assets.

## Complete-product outcomes

The figures in this section come from the **complete private edition of AI Director Workstation**. They demonstrate the validation behind this portfolio project; they are not generated automatically by running the public repository and do not imply that the public edition contains the associated private knowledge or evaluation assets.

### Structured knowledge engineering

The complete product is not a collection of fixed templates. It combines retrieval intent, structured knowledge bases, a prompt compiler, and workflow-specific output contracts:

- One primary output-framework knowledge base and 15 specialist sub-knowledge bases, for 16 knowledge databases in total.
- 55,941 structured runtime records.
- 6,149 high-priority calibration overlays.
- Coverage across shot design, composition, focal length, camera movement, lighting, color, action, continuity, narrative, color LUTs, and failure constraints.

These figures come from a fixed July 2026 validation snapshot of the complete product. They do not describe the public edition's data volume, and the underlying records cannot be downloaded from this repository.

### Real-world usage results

As of July 22, 2026, the complete product had completed an initial 14-day online observation:

| Metric | Result |
| --- | ---: |
| Completed production creative interactions | 201 |
| Anonymous network scopes | 68 |
| Custom-content inputs | 139 |
| Anonymous scopes that submitted custom content | 38 |
| Deduplicated custom creative needs | 116 |
| Scopes that submitted custom content | 55.9% |
| Scopes with at least two interactions | 47.1% |

Among custom interactions, image prompts accounted for 52.5%, video prompts for 28.8%, and script generation and revision for 18.7%.

Across 116 deduplicated needs:

- 50.0% involved character identity or appearance.
- 42.2% involved settings or worldbuilding.
- 24.1% emphasized reference material, continuity, or asset consistency.
- 24.1% explicitly requested a particular style, texture, or image quality.
- 17.2% involved revision, rework, or correction.
- 17.2% explicitly specified negative constraints.

These real usage signals drove iterations in asset referencing, reference material, history reuse, batch recognition, item-by-item generation, structure checks, cancellation, and streaming feedback.

> Anonymous network scopes are created by irreversibly hashing IP addresses on the server. They do not represent individual people or user accounts. The 47.1% figure means only that a scope produced repeat interactions during the observation window; it must not be interpreted as retention.

### Engineering and evaluation evidence

| Complete-product check | Result |
| --- | --- |
| Runtime connection audit | 25/25 checks passed, 0 failures, 0 warnings |
| Runtime database audit | High 0, Medium 0, Low 0 |
| Deterministic quality evaluation | Three fixed English cases across video, image, and screenwriting workflows; average 4.92/5 |

The 4.92/5 score comes from a lightweight deterministic rule evaluation over fixed complete-product outputs. It is not a user rating, third-party rating, real-time model-quality score, or LLM-as-judge result. The public repository does not include the private cases, scoring rules, runtime reports, or database audit material.

## Public edition vs. complete edition

| Capability | Public portfolio showcase | Complete private edition |
| --- | --- | --- |
| Product role | Runnable, reviewable portfolio showcase | Complete product for real users |
| Director, image, and screenwriting workspaces | Included | Included |
| SSE streaming for video and image prompts | Included | Included |
| Batch task recognition and generation of up to 10 items | Not included in this public repository | Included |
| Reference-file understanding | Safe public implementation | Complete implementation |
| Context and knowledge layer | Original, simplified showcase structure rules | Private structured knowledge retrieval and prompt compilation |
| History, asset, and upload storage | Git-ignored local file adapters | Supabase / local dual persistence |
| Production database and object storage | Not included | Supabase Postgres and private Storage |
| Evaluation content | Public methodology and aggregate complete-product results | Private tools, cases, reports, and database audits |
| Online behavior data | References anonymous aggregate complete-product results only | Complete production data pipeline |
| Private sources, internal prompts, and credentials | Not included | Private deployment |

The public edition does not connect to, download, or dynamically request the complete product's private knowledge base. The two codebases can demonstrate similar user workflows, but they do not share the same knowledge runtime or production data.

### Browser boundary

- Renders the Director, Image, and Screenwriting workspaces.
- Manages version switching, editing, copying, cancellation, and streaming state.
- Can store user-entered custom model configuration in the current browser.
- Never receives the deployment's default API key in the browser bundle.

### Server boundary

- Resolves default and fallback model configuration from environment variables.
- Validates requests, file types, input length, and connection URLs.
- Combines public structure rules, reference material, and explicitly referenced user assets.
- Returns the video- and image-prompt generation process through SSE.
- Stores showcase history, assets, and temporary reference files in local development.

## Code guide

- [`components/DirectorWorkbench.tsx`](components/DirectorWorkbench.tsx): workspace state, history, assets, generation, and cross-workspace interactions.
- [`components/OutputPanel.tsx`](components/OutputPanel.tsx): structured results, editing, further direction, and asset saving.
- [`lib/showcaseRuntime.ts`](lib/showcaseRuntime.ts): public context orchestration, workflow execution, and traceable metadata.
- [`lib/llmClient.ts`](lib/llmClient.ts): server-side model connection, timeouts, retries, fallback, and stream handling.
- [`lib/showcaseStream.ts`](lib/showcaseStream.ts): SSE event framing and final-result reconciliation.
- [`lib/referenceFilePolicy.ts`](lib/referenceFilePolicy.ts): file type, count, and size boundaries.
- [`scripts/security-check.mjs`](scripts/security-check.mjs): pre-release leakage guard for the public repository.

## Run locally

Node.js 20.9.0 or later is required.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Configure a Chat Completions-compatible model service in `.env.local`:

```text
LLM_MODEL_NAME=your-model-name
LLM_FALLBACK_MODEL_NAMES=fallback-model-a,fallback-model-b
LLM_API_KEY=your-api-key
LLM_REQUEST_URL=https://your-provider.example/v1/chat/completions
```

Public-showcase controls:

```text
DIRECTOR_WORKSPACE_DEMO_MODE=false
DIRECTOR_WORKSPACE_ALLOW_CUSTOM_API=false
DIRECTOR_WORKSPACE_ENABLE_UPLOADS=true
DIRECTOR_WORKSPACE_RATE_LIMIT_ENABLED=true
DIRECTOR_WORKSPACE_RATE_LIMIT_MAX_PER_HOUR=60
```

## Release checks

```bash
npm run release:check
```

This command runs ESLint, a Next.js production build, and checks for known sensitive-content patterns in the public repository. It is not equivalent to the complete product's generation-quality evaluation and does not constitute a full secret scanner, unit-test suite, or end-to-end test suite.

## Security, privacy, and known limitations

- This repository does not contain private knowledge files, source materials, production data, or private Git history from the complete product.
- `.env.local`, local history, assets, uploads, and build output are ignored by Git.
- Model credentials must be configured only through server-side environment variables and must never be committed.
- The local file adapters are intended for development and portfolio review, not as a production multi-user data architecture.
- Hosted deployments that need persistent data should use a database and object storage with authentication and per-user isolation.
- Uploaded content is sent to the configured model service. Do not upload material you are not authorized to process.
- Reference-image understanding depends on the configured model's multimodal capability.
- Model output may contain factual, structural, or creative errors and should be reviewed before entering production.
- `npm run security:check` guards against known risk patterns; it is not a replacement for a professional secret scanner or security audit.
- Public visibility does not grant permission to copy the complete product, private methods, or brand assets.

## Repository structure

```text
app/                         Pages and server-side APIs
components/                  Interactive workspace components
lib/                         Model connection, public generation workflows, files, and local-data adapters
types/                       Shared TypeScript types
docs/                        Architecture and security-boundary documentation
scripts/security-check.mjs   Pre-release leakage guard
```

## License

This is a public portfolio repository, not an open-source project. The source is available for evaluation and product demonstration under the repository’s all-rights-reserved license.

Copyright © 2026. All rights reserved. See [LICENSE](LICENSE).
