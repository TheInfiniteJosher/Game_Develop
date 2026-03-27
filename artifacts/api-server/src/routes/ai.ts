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
import { nanoid } from "../lib/nanoid.js";
import { existsSync } from "fs";

const router: IRouter = Router({ mergeParams: true });

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a friendly, expert game developer and coding partner embedded in an AI Game Studio IDE. You are both conversational and highly capable — like a senior colleague sitting next to the developer.

## Conversation first
Read every message carefully and decide what kind of response it needs:

- **Conversational / casual messages** ("nice, it works!", "cool", "thanks", "what do you think about X?", general questions) → respond naturally and warmly in plain text. No code changes. No file tags.
- **Questions about game dev / code** → answer clearly and conversationally. Only include code snippets inline (not file edits) unless the user explicitly asks you to apply changes.
- **Explicit requests to build / add / fix / change something** → proceed with code changes using the file format below.

When in doubt about whether to make changes, **ask first** rather than assuming. A short "Want me to go ahead and add that?" is always better than silently rewriting files.

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

## Tone
- Be direct, warm, and brief — like a knowledgeable friend
- Celebrate wins with the user ("Nice, that's working great!")
- If something is unclear, ask a short clarifying question rather than guessing`;

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

// AI Chat endpoint (SSE)
router.post("/ai/chat", async (req, res) => {
  const { id } = req.params;
  const { message, contextFiles } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

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

      // Read relevant files (user-specified or auto-detected)
      const filesToRead = contextFiles || [];

      // Auto-include common game files if no context provided
      if (filesToRead.length === 0) {
        const autoFiles = ["index.html", "game.js", "src/main.js", "main.js"];
        for (const f of autoFiles) {
          try {
            await readFile(id, f);
            filesToRead.push(f);
          } catch { /* ignore */ }
        }
        // Limit to first 5 auto files
        filesToRead.splice(5);
      }

      for (const filePath of filesToRead.slice(0, 10)) {
        try {
          const content = await readFile(id, filePath);
          // Limit file size for context
          const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n... [truncated]" : content;
          fileContentsStr += `\n\n--- File: ${filePath} ---\n${truncated}`;
        } catch { /* ignore */ }
      }
    }

    // Get previous conversation history
    const history = await db
      .select()
      .from(aiMessagesTable)
      .where(eq(aiMessagesTable.projectId, id))
      .orderBy(aiMessagesTable.timestamp)
      .limit(20);

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT + (fileTreeStr ? `\n\nProject file tree:\n${fileTreeStr}` : "\n\nNo files uploaded yet."),
      },
    ];

    // Add history (excluding the user message we just saved)
    for (const msg of history.slice(0, -1)) {
      chatMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // Add current user message with file context
    const userContent = fileContentsStr
      ? `${message}\n\nContext files:${fileContentsStr}`
      : message;
    chatMessages.push({ role: "user", content: userContent });

    sendEvent({ type: "thinking", content: "Analyzing your project..." });

    let fullResponse = "";
    let thinkingContent = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    let isFirstChunk = true;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        if (isFirstChunk) {
          sendEvent({ type: "thinking_done" });
          isFirstChunk = false;
        }
        fullResponse += content;
        sendEvent({ type: "delta", content });
      }
    }

    const thinkingDurationMs = Date.now() - startTime;

    // Parse file edits from the response
    const edits = parseFileEdits(fullResponse);
    const cleanResponse = stripFileBlocks(fullResponse);

    // Apply edits and record changes
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
      // Update project stats
      const fileCount = await countFiles(root);
      const entryFile = await detectEntryFile(id);
      await db
        .update(projectsTable)
        .set({ fileCount, entryFile: entryFile || null, updatedAt: new Date() })
        .where(eq(projectsTable.id, id));
    }

    // Save assistant message
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

// Get AI history
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

// Clear AI history
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
