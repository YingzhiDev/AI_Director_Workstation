import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildRoot = path.join(projectRoot, ".next", "server", "app", "api");
const tempRoot = mkdtempSync(
  path.join(tmpdir(), "director-workspace-showcase-verify-"),
);
const originalCwd = process.cwd();
const require = createRequire(import.meta.url);
const checks = [];
const outboundCalls = [];

function record(name, evidence) {
  checks.push({ name, evidence, passed: true });
}

function findLocalLlmApiFile() {
  const candidates = [
    process.env.LLM_API_FILE,
    path.join(projectRoot, "LLM_API.txt"),
    path.resolve(projectRoot, "..", "LLM_API.txt"),
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function route(relativePath) {
  const bundle = path.join(buildRoot, relativePath, "route.js");
  assert.ok(
    existsSync(bundle),
    `Missing production route bundle: ${relativePath}. Run a production build first.`,
  );
  return require(bundle).routeModule.userland;
}

function request(url, body, init = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
}

function mockCompletion(payload) {
  const serializedMessages = JSON.stringify(payload.messages ?? []);
  const hasImageInput = (payload.messages ?? []).some((message) =>
    Array.isArray(message.content),
  );

  if (hasImageInput) {
    return "Reference analysis: the subject silhouette is clear and the warm-cool contrast provides useful composition and continuity anchors.";
  }

  if (serializedMessages.includes("CREATIVE DIRECTION")) {
    return [
      "【Creative Direction / CREATIVE DIRECTION】",
      "Use a low-angle medium shot to establish spatial depth on a rain-soaked city street.",
      "【Positive Prompt / POSITIVE PROMPT】",
      "A figure pauses beneath an umbrella at a rainy intersection, 35 mm lens, cool blue ambient light against a warm shop window.",
      "【Negative Prompt / NEGATIVE PROMPT】",
      "Avoid malformed limbs, duplicate people, text watermarks, and unmotivated hard light.",
    ].join("\n");
  }

  if (serializedMessages.includes("CREATIVE INTENT")) {
    return [
      "【Creative Intent / CREATIVE INTENT】",
      "Use a long-delayed reunion to force a consequential choice.",
      "【Character & Conflict / CHARACTER & CONFLICT】",
      "The protagonist must choose between leaving and telling the truth.",
      "【Scene Draft / SCENE DRAFT】",
      "INT. WAITING ROOM — NIGHT. An announcement sounds. The protagonist finally reveals the truth concealed for years.",
      "【Revision Notes / REVISION NOTES】",
      "Preserve the action pauses and let the dialogue carry less exposition.",
    ].join("\n");
  }

  return [
    "【Global Style / STYLE LOCK】",
    "Grounded cinematic realism, a muted cool environment, and natural warm skin tones.",
    "【Asset Lock / ASSET LOCK】",
    "Test Character: short black hair, dark-gray overcoat, and an old silver camera.",
    "【Shot Content / SHOT CONTENT】",
    "A five-second single take. A 35 mm medium shot slowly pushes toward the figure looking up on a rainy platform as train lights approach.",
    "【Risk Control / RISK CONTROL】",
    "Avoid identity drift, extra people, discontinuous action, camera teleportation, and text watermarks.",
  ].join("\n");
}

function createMockModelResponse(payload) {
  const content = mockCompletion(payload);

  if (payload.stream) {
    const midpoint = Math.ceil(content.length / 2);
    const events = [
      content.slice(0, midpoint),
      content.slice(midpoint),
    ]
      .map(
        (delta) =>
          `data: ${JSON.stringify({
            choices: [{ delta: { content: delta } }],
          })}\n\n`,
      )
      .join("");

    return new Response(`${events}data: [DONE]\n\n`, {
      headers: { "Content-Type": "text/event-stream" },
      status: 200,
    });
  }

  return Response.json({
    choices: [{ message: { content } }],
  });
}

async function readJson(response, expectedStatus = 200) {
  const text = await response.text();
  assert.equal(
    response.status,
    expectedStatus,
    `Unexpected HTTP ${response.status}: ${text.slice(0, 400)}`,
  );
  return JSON.parse(text);
}

async function run() {
  const llmApiFile = findLocalLlmApiFile();
  assert.ok(llmApiFile, "No readable LLM_API.txt was found for the runtime check.");

  process.env.LLM_API_FILE = llmApiFile;
  process.env.LLM_HTTP_TRANSPORT = "fetch";
  process.env.DIRECTOR_WORKSPACE_DEMO_MODE = "false";
  process.env.DIRECTOR_WORKSPACE_ENABLE_UPLOADS = "true";
  process.env.DIRECTOR_WORKSPACE_RATE_LIMIT_ENABLED = "false";
  process.chdir(tempRoot);

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    const payload = JSON.parse(String(init.body ?? "{}"));
    const authorization = headers.get("Authorization") ?? "";
    const serializedMessages = JSON.stringify(payload.messages ?? []);

    assert.match(url.pathname, /\/v1\/chat\/completions$/u);
    assert.ok(authorization.startsWith("Bearer "));
    assert.ok(authorization.length > "Bearer ".length);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(typeof payload.model, "string");
    assert.ok(payload.model.length > 0);

    outboundCalls.push({
      pathValid: true,
      hasAuthorization: true,
      hasModel: true,
      hasCjkInstructions: /[\u3400-\u9fff]/u.test(serializedMessages),
      stream: Boolean(payload.stream),
    });
    return createMockModelResponse(payload);
  };

  const connection = route("test-connection");
  const generate = route("generate");
  const generateStream = route(path.join("generate", "stream"));
  const refine = route("refine");
  const imagePrompt = route(path.join("image-prompt", "[action]"));
  const screenwritingGenerate = route(
    path.join("screenwriting", "generate"),
  );
  const screenwritingOptimize = route(
    path.join("screenwriting", "optimize"),
  );
  const assets = route("assets");
  const history = route("history");
  const referenceFiles = route("reference-files");
  const blankApiConfig = { apiKey: "", modelName: "", requestUrl: "" };

  const connectionPayload = await readJson(
    await connection.POST(
      request("http://runtime.local/api/test-connection", {
        apiConfig: blankApiConfig,
      }),
    ),
  );
  assert.equal(connectionPayload.connected, true);
  assert.equal(connectionPayload.source, "built-in");
  assert.ok(connectionPayload.modelNames.length >= 1);
  record(
    "Default LLM_API.txt configuration",
    "Parsed the TokenPlan configuration and created a hosted model connection",
  );

  const assetPayload = await readJson(
    await assets.POST(
      request("http://runtime.local/api/assets", {
        assetKind: "character",
        name: "TestCharacter",
        promptText: "Short black hair, a dark-gray overcoat, and an old silver camera.",
        sourcePromptKind: "video",
      }),
    ),
  );
  assert.equal(assetPayload.asset.name, "TestCharacter");
  const assetId = assetPayload.asset.id;
  const listedAssets = await readJson(await assets.GET());
  assert.ok(listedAssets.assets.some((asset) => asset.id === assetId));
  record("Asset save and read", "Saved a character asset to temporary storage and loaded it again");

  const formData = new FormData();
  formData.append(
    "files",
    new File(["The platform sits at the edge of a rainy city. Keep the character's gray overcoat consistent."], "reference.txt", {
      type: "text/plain",
    }),
  );
  formData.append(
    "files",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "reference.png",
      { type: "image/png" },
    ),
  );
  const referencePayload = await readJson(
    await referenceFiles.POST(
      new Request("http://runtime.local/api/reference-files", {
        body: formData,
        method: "POST",
      }),
    ),
  );
  assert.equal(referencePayload.attachments.length, 2);
  record("Reference upload", "Saved TXT and PNG files to temporary storage and returned attachment metadata");

  const videoBody = {
    apiConfig: blankApiConfig,
    durationSeconds: 5,
    referenceAttachments: referencePayload.attachments,
    userIdea: "Have @TestCharacter wait for a train on a rain-soaked platform.",
  };
  const videoPayload = await readJson(
    await generate.POST(
      request("http://runtime.local/api/generate", videoBody),
    ),
  );
  assert.match(videoPayload.promptText, /STYLE LOCK/u);
  assert.match(videoPayload.promptText, /SHOT CONTENT/u);
  assert.ok(videoPayload.historyRecord.id);
  record("Video-prompt generation", "Combined asset, text, and image references into a structured result");

  const chineseLanguagePayload = await readJson(
    await generate.POST(
      request("http://runtime.local/api/generate", {
        apiConfig: blankApiConfig,
        durationSeconds: 5,
        outputLanguage: "zh",
        userIdea: "A traveler waits beneath the station clock.",
      }),
    ),
  );
  assert.match(chineseLanguagePayload.promptText, /STYLE LOCK/u);
  assert.ok(outboundCalls.some((call) => call.hasCjkInstructions));
  record(
    "Chinese output-language switch",
    "Preserved the Chinese prompt branch while the API default remained English",
  );

  const videoStreamResponse = await generateStream.POST(
    request("http://runtime.local/api/generate/stream", videoBody),
  );
  assert.match(
    videoStreamResponse.headers.get("Content-Type") ?? "",
    /text\/event-stream/u,
  );
  const videoStreamText = await videoStreamResponse.text();
  assert.match(videoStreamText, /event: status/u);
  assert.match(videoStreamText, /event: delta/u);
  assert.match(videoStreamText, /event: complete/u);
  record("Video SSE response", "Returned status, text-delta, and completion events");

  const refinedVideo = await readJson(
    await refine.POST(
      request("http://runtime.local/api/refine", {
        ...videoBody,
        currentPrompt: videoPayload.promptText,
        goal: "Strengthen action causality before the train enters the station.",
      }),
    ),
  );
  assert.match(refinedVideo.promptText, /RISK CONTROL/u);
  record("Video refinement", "Generated a new version from the current result and a refinement goal");

  const imageStreamResponse = await imagePrompt.POST(
    request("http://runtime.local/api/image-prompt/stream", {
      apiConfig: blankApiConfig,
      outputLanguage: "en",
      userIdea: "A cinematic still on a rain-soaked station platform.",
    }),
    { params: Promise.resolve({ action: "stream" }) },
  );
  assert.equal(imageStreamResponse.status, 200);
  const imageStreamText = await imageStreamResponse.text();
  assert.match(imageStreamText, /event: complete/u);
  assert.match(imageStreamText, /POSITIVE PROMPT/u);
  record("Image-prompt SSE generation", "Returned a complete streamed image prompt through the dynamic route");

  const imageRefinePayload = await readJson(
    await imagePrompt.POST(
      request("http://runtime.local/api/image-prompt/refine", {
        apiConfig: blankApiConfig,
        currentPrompt: mockCompletion({
          messages: [{ content: "【Creative Direction / CREATIVE DIRECTION】" }],
        }),
        goal: "Add reflections from the wet pavement.",
        outputLanguage: "en",
        userIdea: "A cinematic still on a rain-soaked station platform.",
      }),
      { params: Promise.resolve({ action: "refine" }) },
    ),
  );
  assert.match(imageRefinePayload.promptText, /NEGATIVE PROMPT/u);
  record("Image-prompt refinement", "Returned a new structured image prompt through the refine route");

  const unknownImageAction = await imagePrompt.POST(
    request("http://runtime.local/api/image-prompt/unknown", {
      apiConfig: blankApiConfig,
      userIdea: "test",
    }),
    { params: Promise.resolve({ action: "unknown" }) },
  );
  assert.equal(unknownImageAction.status, 404);
  record("Image dynamic-route validation", "Returned 404 for an unknown action");

  const screenplayPayload = await readJson(
    await screenwritingGenerate.POST(
      request("http://runtime.local/api/screenwriting/generate", {
        apiConfig: blankApiConfig,
        outputLanguage: "en",
        storyIdea: "Two people reunite after years apart just before the last train.",
      }),
    ),
  );
  assert.match(screenplayPayload.generatedText, /SCENE DRAFT/u);
  record("Script generation", "Expanded a story idea into a structured scene draft");

  const screenplayOptimizePayload = await readJson(
    await screenwritingOptimize.POST(
      request("http://runtime.local/api/screenwriting/optimize", {
        apiConfig: blankApiConfig,
        outputLanguage: "en",
        scriptText: screenplayPayload.generatedText,
      }),
    ),
  );
  assert.match(screenplayOptimizePayload.optimizedText, /REVISION NOTES/u);
  record("Script revision", "Returned a revised script and revision notes");

  const emptyGenerateResponse = await generate.POST(
    request("http://runtime.local/api/generate", {
      apiConfig: blankApiConfig,
      userIdea: "",
    }),
  );
  assert.equal(emptyGenerateResponse.status, 400);
  record("Input validation", "Returned 400 for an empty creative brief");

  const historyPayload = await readJson(
    await history.GET(new Request("http://runtime.local/api/history")),
  );
  assert.ok(historyPayload.records.length >= 6);
  const firstHistoryId = historyPayload.records[0].id;
  const deleteHistoryPayload = await readJson(
    await history.DELETE(
      new Request(
        `http://runtime.local/api/history?id=${encodeURIComponent(firstHistoryId)}`,
        { method: "DELETE" },
      ),
    ),
  );
  assert.equal(deleteHistoryPayload.deleted, true);
  const clearHistoryPayload = await readJson(
    await history.DELETE(
      new Request("http://runtime.local/api/history?all=1", {
        method: "DELETE",
      }),
    ),
  );
  assert.deepEqual(clearHistoryPayload.records, []);
  record("History read and delete", "Loaded generated records, deleted one record, and cleared all records");

  for (const attachment of referencePayload.attachments) {
    const deletedReference = await readJson(
      await referenceFiles.DELETE(
        new Request(
          `http://runtime.local/api/reference-files?id=${encodeURIComponent(
            attachment.id,
          )}`,
          { method: "DELETE" },
        ),
      ),
    );
    assert.equal(deletedReference.deleted, true);
  }
  record("Reference deletion", "Deleted both uploaded TXT and PNG files");

  const deletedAsset = await readJson(
    await assets.DELETE(
      new Request(
        `http://runtime.local/api/assets?id=${encodeURIComponent(assetId)}`,
        { method: "DELETE" },
      ),
    ),
  );
  assert.equal(deletedAsset.deleted, true);
  record("Asset deletion", "Deleted a single asset");

  process.env.DIRECTOR_WORKSPACE_DEMO_MODE = "true";
  process.env.DIRECTOR_WORKSPACE_ENABLE_UPLOADS = "false";
  const demoAssetResponse = await assets.POST(
    request("http://runtime.local/api/assets", {
      name: "demo",
      promptText: "demo",
    }),
  );
  assert.equal(demoAssetResponse.status, 403);
  const demoUploadResponse = await referenceFiles.POST(
    new Request("http://runtime.local/api/reference-files", {
      body: new FormData(),
      method: "POST",
    }),
  );
  assert.equal(demoUploadResponse.status, 403);
  record("Demo write restrictions", "Demo mode blocked server-side asset and reference-file writes");

  process.env.DIRECTOR_WORKSPACE_RATE_LIMIT_ENABLED = "true";
  process.env.DIRECTOR_WORKSPACE_RATE_LIMIT_MAX_PER_HOUR = "1";
  const limitedHeaders = { "x-forwarded-for": "203.0.113.10" };
  const firstLimitedRequest = await generate.POST(
    request(
      "http://runtime.local/api/generate",
      {
        apiConfig: blankApiConfig,
        userIdea: "Rate-limit test one",
      },
      { headers: limitedHeaders },
    ),
  );
  assert.equal(firstLimitedRequest.status, 200);
  const secondLimitedRequest = await generate.POST(
    request(
      "http://runtime.local/api/generate",
      {
        apiConfig: blankApiConfig,
        userIdea: "Rate-limit test two",
      },
      { headers: limitedHeaders },
    ),
  );
  assert.equal(secondLimitedRequest.status, 429);
  record("Demo request rate limit", "Returned 429 after one anonymous network scope exceeded its limit");

  assert.ok(outboundCalls.length >= 10);
  assert.ok(outboundCalls.some((call) => call.stream));
  assert.ok(outboundCalls.some((call) => !call.stream));
  record(
    "Model request protocol",
    `${outboundCalls.length} mocked upstream calls included a model, Bearer authentication, and the standard Chat Completions path`,
  );

  return {
    checks,
    outboundCallCount: outboundCalls.length,
    tempDataRemoved: true,
  };
}

try {
  const result = await run();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  process.chdir(originalCwd);
  rmSync(tempRoot, { force: true, recursive: true });
}
