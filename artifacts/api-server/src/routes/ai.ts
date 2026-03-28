import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiMessagesTable, fileChangesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import {
  buildFileTree,
  readFile,
  writeFile,
  detectEntryFile,
  countFiles,
  getProjectRoot,
} from "../services/filesystem.js";
import { generateAssetForProject } from "../services/assetGeneration.js";
import { nanoid } from "../lib/nanoid.js";
import { existsSync } from "fs";

const router: IRouter = Router({ mergeParams: true });

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// ─── Tool definition ──────────────────────────────────────────────────────────

const GAME_ASSET_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_game_asset",
    description:
      "Generate a game asset image using AI image generation. " +
      "Use this to create sprites, characters, enemies, items, backgrounds, tilesets, and UI elements needed for the game. " +
      "Call this for EACH distinct visual asset needed. Assets are saved to the project and you must use the returned path in Phaser load calls. " +
      "IMPORTANT: Only call this when building a themed/visual game that needs custom art. Do NOT generate assets for simple geometric shapes — use Phaser.Graphics instead.",
    parameters: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Short identifier for this asset (snake_case, e.g. 'barista', 'coffee_cup', 'shop_background'). Used as the Phaser key.",
        },
        prompt: {
          type: "string",
          description: "Detailed visual description of what to generate. Be specific about colors, pose, perspective.",
        },
        assetType: {
          type: "string",
          enum: ["sprite", "animation", "background", "tileset", "ui", "vfx", "enemy", "item"],
          description: "sprite=character/object, animation=sprite sheet, background=scene bg, tileset=repeating tiles, ui=interface element",
        },
        style: {
          type: "string",
          enum: ["pixel", "cartoon", "realistic", "vector", "painterly", "dark"],
          description: "Visual art style. Default to pixel or cartoon for most games.",
        },
        frameCount: {
          type: "number",
          description: "Number of animation frames for sprite sheets. Use 1 for static assets (default: 1).",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "16:9", "4:3", "9:16"],
          description: "Aspect ratio. Use 16:9 for backgrounds, 1:1 for sprites/characters (default: 1:1).",
        },
      },
      required: ["name", "prompt", "assetType", "style"],
    },
  },
};

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a friendly, expert game developer and coding partner embedded in an AI Game Studio IDE. You are both conversational and highly capable — like a senior colleague sitting next to the developer.

## Conversation first
Read every message carefully and decide what kind of response it needs:

- **Conversational / casual messages** ("nice, it works!", "cool", "thanks") → respond naturally in plain text. No code changes.
- **Questions about game dev / code** → answer clearly. Only include code snippets inline unless explicitly asked to apply changes.
- **Explicit requests to build / add / fix / change something** → proceed with code changes using the file format below.

When in doubt about whether to make changes, **ask first** rather than assuming.

## Asset generation (generate_game_asset tool)
When the user asks you to build a themed game (coffee shop, space shooter, RPG, etc.), **call generate_game_asset for each distinct visual asset** needed BEFORE writing the game code.

Rules:
- Generate 2–6 assets max — focus on the most impactful visuals (main character, key environment elements, background)
- Always prefer pixel or cartoon style unless the user specifies otherwise
- Use 1:1 for sprites/characters/enemies/items, 16:9 for backgrounds
- After generating, use the EXACT returned \`path\` in your Phaser code: \`this.load.image('name', 'RETURNED_PATH')\`
- The name arg should match the snake_case name you gave the asset
- For static sprites: \`this.add.image(x, y, 'name').setOrigin(0.5)\`
- For sprite sheets: \`this.load.spritesheet('name', 'RETURNED_PATH', { frameWidth, frameHeight })\`
- Do NOT generate assets for simple geometry — use Phaser.GameObjects.Graphics for rectangles/circles

## When making code changes
Use this exact format — only when changes are genuinely requested:

<file path="RELATIVE_FILE_PATH">
FULL_FILE_CONTENT_HERE
</file>

Rules for code changes:
- Always output COMPLETE file content, never partial snippets
- Support Phaser 3, HTML5 Canvas, vanilla JS, and modern web game patterns
- Self-contained index.html that loads everything inline or via relative paths
- Phaser games use CDN: https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js
- Games must be playable in an iframe with sandbox="allow-scripts allow-same-origin allow-pointer-lock"
- Keep your explanation short and friendly — don't over-explain
- When using generated assets, make the game actually USE them — as the player sprite, background, objects, etc.

## Tone
- Be direct, warm, and brief — like a knowledgeable friend
- Celebrate wins with the user
- If something is unclear, ask a short clarifying question rather than guessing`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FileEdit {
  path: string;
  content: string;
}

function parseFileEdits(text: string): FileEdit[] {
  const edits: FileEdit[] = [];
  const regex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    edits.push({ path: match[1], content: match[2].trim() });
  }
  return edits;
}

function stripFileBlocks(text: string): string {
  return text.replace(/<file path="[^"]+">[\s\S]*?<\/file>/g, "").trim();
}

// ─── AI Chat endpoint (SSE) ───────────────────────────────────────────────────

router.post("/ai/chat", async (req, res) => {
  const { id } = req.params;
  const { message, contextFiles } = req.body;

  if (!message) return res.status(400).json({ error: "message is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const startTime = Date.now();

  try {
    // Save user message
    const userMsgId = nanoid();
    await db.insert(aiMessagesTable).values({
      id: userMsgId,
      projectId: id,
      role: "user",
      content: message,
    });

    // Build file context
    const root = getProjectRoot(id);
    let fileTreeStr = "";
    let fileContentsStr = "";

    if (existsSync(root)) {
      const tree = await buildFileTree(root);
      fileTreeStr = JSON.stringify(tree, null, 2);

      const filesToRead = contextFiles || [];
      if (filesToRead.length === 0) {
        const autoFiles = ["index.html", "game.js", "src/main.js", "main.js"];
        for (const f of autoFiles) {
          try {
            await readFile(id, f);
            filesToRead.push(f);
          } catch { /* ignore */ }
        }
        filesToRead.splice(5);
      }

      for (const filePath of filesToRead.slice(0, 10)) {
        try {
          const content = await readFile(id, filePath);
          const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n... [truncated]" : content;
          fileContentsStr += `\n\n--- File: ${filePath} ---\n${truncated}`;
        } catch { /* ignore */ }
      }
    }

    // Get conversation history
    const history = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, id))
      .orderBy(aiMessagesTable.timestamp)
      .limit(20);

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT + (fileTreeStr ? `\n\nProject file tree:\n${fileTreeStr}` : "\n\nNo files uploaded yet."),
      },
    ];

    for (const msg of history.slice(0, -1)) {
      chatMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    const userContent = fileContentsStr
      ? `${message}\n\nContext files:${fileContentsStr}`
      : message;
    chatMessages.push({ role: "user", content: userContent });

    sendEvent({ type: "thinking", content: "Analyzing your request..." });

    // ── Round 1: AI decides whether to generate assets or respond directly ──

    let fullResponse = "";
    let thinkingContent = "";

    // Accumulate tool calls from stream
    type PartialToolCall = { id: string; name: string; args: string };
    const toolCallsAccum: Record<number, PartialToolCall> = {};

    const stream1 = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: chatMessages,
      tools: [GAME_ASSET_TOOL],
      tool_choice: "auto",
      stream: true,
    });

    let finishReason: string | null = null;
    let isFirstChunk = true;

    for await (const chunk of stream1) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      if (delta?.content) {
        if (isFirstChunk) {
          sendEvent({ type: "thinking_done" });
          isFirstChunk = false;
        }
        fullResponse += delta.content;
        sendEvent({ type: "delta", content: delta.content });
      }

      if (delta?.tool_calls) {
        if (isFirstChunk) {
          sendEvent({ type: "thinking_done" });
          isFirstChunk = false;
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = { id: "", name: "", args: "" };
          }
          if (tc.id) toolCallsAccum[idx].id = tc.id;
          if (tc.function?.name) toolCallsAccum[idx].name = tc.function.name;
          if (tc.function?.arguments) toolCallsAccum[idx].args += tc.function.arguments;
        }
      }
    }

    // ── Round 2: Execute tool calls if any ──────────────────────────────────

    const toolCallsList = Object.values(toolCallsAccum);

    if (finishReason === "tool_calls" && toolCallsList.length > 0) {
      sendEvent({ type: "assets_start", count: toolCallsList.length });

      // Add the assistant's tool_calls message to history
      chatMessages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCallsList.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      // Execute all tool calls, potentially in parallel (but cap at 3 concurrent)
      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      // Process in batches of 3 to avoid rate limits
      const batchSize = 3;
      const allCalls = toolCallsList.slice(0, 6); // max 6 assets per request
      for (let i = 0; i < allCalls.length; i += batchSize) {
        const batch = allCalls.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (tc, batchIdx) => {
            const globalIdx = i + batchIdx;
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.args);
            } catch {
              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({ error: "Failed to parse arguments" }),
              };
            }

            const assetName = (args.name as string) || `asset_${globalIdx}`;
            const assetType = (args.assetType as string) || "sprite";
            const style = (args.style as string) || "pixel";

            sendEvent({
              type: "asset_generating",
              index: globalIdx,
              name: assetName,
              assetType,
              style,
              prompt: args.prompt as string,
            });

            try {
              const result = await generateAssetForProject(id, {
                name: assetName,
                prompt: args.prompt as string,
                assetType,
                style,
                frameCount: (args.frameCount as number) || 1,
                aspectRatio: (args.aspectRatio as string) || "1:1",
              });

              sendEvent({
                type: "asset_done",
                index: globalIdx,
                name: assetName,
                path: result.path,
                previewUrl: result.previewUrl,
                filename: result.filename,
                assetType: result.assetType,
                frameCount: result.frameCount,
                frameWidth: result.frameWidth,
                frameHeight: result.frameHeight,
              });

              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({
                  success: true,
                  name: assetName,
                  path: result.path,
                  previewUrl: result.previewUrl,
                  filename: result.filename,
                  assetType: result.assetType,
                  frameCount: result.frameCount,
                  frameWidth: result.frameWidth,
                  frameHeight: result.frameHeight,
                  phaserLoadSnippet: result.frameCount > 1
                    ? `this.load.spritesheet('${assetName}', '${result.path}', { frameWidth: ${result.frameWidth}, frameHeight: ${result.frameHeight} })`
                    : `this.load.image('${assetName}', '${result.path}')`,
                }),
              };
            } catch (err) {
              sendEvent({
                type: "asset_error",
                index: globalIdx,
                name: assetName,
                error: String(err),
              });

              return {
                tool_call_id: tc.id,
                role: "tool" as const,
                content: JSON.stringify({ error: `Failed to generate asset: ${err}` }),
              };
            }
          })
        );
        toolResults.push(...batchResults);
      }

      // Add tool results to messages
      for (const result of toolResults) {
        chatMessages.push(result);
      }

      sendEvent({ type: "assets_done" });
      sendEvent({ type: "thinking", content: "Writing game code with generated assets..." });

      // ── Round 3: AI writes the game code using the generated asset paths ──

      const stream2 = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 8192,
        messages: chatMessages,
        stream: true,
      });

      let isFirst2 = true;
      for await (const chunk of stream2) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          if (isFirst2) {
            sendEvent({ type: "thinking_done" });
            isFirst2 = false;
          }
          fullResponse += content;
          sendEvent({ type: "delta", content });
        }
      }
    }

    const thinkingDurationMs = Date.now() - startTime;

    // Parse and apply file edits
    const edits = parseFileEdits(fullResponse);
    const cleanResponse = stripFileBlocks(fullResponse);
    const appliedChanges: string[] = [];
    const assistantMsgId = nanoid();

    for (const edit of edits) {
      try {
        let previousContent: string | undefined;
        try {
          previousContent = await readFile(id, edit.path);
        } catch { /* new file */ }

        await writeFile(id, edit.path, edit.content);

        await db.insert(fileChangesTable).values({
          id: nanoid(),
          projectId: id,
          filePath: edit.path,
          previousContent: previousContent ?? null,
          newContent: edit.content,
          description: `AI edit: ${edit.path}`,
          aiMessageId: assistantMsgId,
        });

        appliedChanges.push(edit.path);
        sendEvent({ type: "change", filePath: edit.path, description: `Updated ${edit.path}` });
      } catch (err) {
        sendEvent({ type: "error", message: `Failed to write ${edit.path}` });
      }
    }

    if (edits.length > 0) {
      const fileCount = await countFiles(root);
      const entryFile = await detectEntryFile(id);
      await db
        .update(projectsTable)
        .set({ fileCount, entryFile: entryFile || null, updatedAt: new Date() })
        .where(eq(projectsTable.id, id));
    }

    // Invalidate asset list so sidebar refreshes
    if (toolCallsList.length > 0) {
      sendEvent({ type: "assets_saved" });
    }

    await db.insert(aiMessagesTable).values({
      id: assistantMsgId,
      projectId: id,
      role: "assistant",
      content: cleanResponse || fullResponse,
      thinking: thinkingContent || null,
      changesCount: edits.length,
      thinkingDurationMs,
    });

    sendEvent({
      type: "done",
      changesCount: edits.length,
      thinkingDurationMs,
      appliedFiles: appliedChanges,
    });

    res.end();
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    sendEvent({ type: "error", message: String(err) });
    res.end();
  }
});

// ─── AI history ───────────────────────────────────────────────────────────────

router.get("/ai/history", async (req, res) => {
  try {
    const messages = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, req.params.id))
      .orderBy(aiMessagesTable.timestamp);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to get AI history");
    res.status(500).json({ error: "Failed to get AI history" });
  }
});

router.delete("/ai/history", async (req, res) => {
  try {
    await db
      .delete(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, req.params.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to clear AI history");
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
