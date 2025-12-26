import { NextRequest } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, ToolMessage, BaseMessage, AIMessageChunk, SystemMessage } from "@langchain/core/messages";
import { listFilesTool, readFileTool, writeToFileTool, deleteFileTool } from "@/lib/ai/tools";
import { ContextManager } from "@/lib/ai/context_manager";
import { db_append_message, db_get_history, db_get_chat_summary, db_update_chat_summary, db_update_chat_title, db_get_thread, Message } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

// --- Summarization Logic ---
async function generateSummary(
  currentSummary: object | null,
  history: Message[],
  model: string
): Promise<object | null> {
  const summarizer = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_FLASH_MODEL || "gemini-1.5-flash", 
    temperature: 0.0,
    apiKey: process.env.GOOGLE_API_KEY
  });

  const summaryPrompt = `
    You are a session analyst. Your task is to update a JSON summary of the user's session based on the latest conversation turns.
    The user's goal is to get actionable, structured advice.
    The current summary is:
    ${JSON.stringify(currentSummary, null, 2) || "{}"}

    The latest messages are:
    ${history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}

    Update the JSON object with the following fields if new information is available:
    - user_goal: A concise, 1-5 word description of the user's primary objective. (e.g., "Export Business Feasibility")
    - current_stage: The user's current progress. (e.g., "Exploration", "Planning", "Execution")
    - constraints: Key limitations mentioned by the user. (e.g., "Low capital", "No prior experience")
    - decisions_made: Important choices the user has settled on.
    - open_questions: What the user is currently trying to figure out.

    RULES:
    - ONLY output the updated JSON object, nothing else.
    - Preserve existing fields if no new information is available.
  `;

  try {
    const response = await summarizer.invoke([new HumanMessage(summaryPrompt)]);
    const responseText = response.content.toString();
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : responseText;
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to generate or parse summary:", e);
    return null;
  }
}

function sse_event(type: string, data: any = {}) {
  let payload: any = { type };
  if (type === 'content') payload.value = data;
  else Object.assign(payload, data);
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// --- Main Handler ---

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Start processing without awaiting, allowing the stream to be returned immediately
      processChatRequest(req, controller).catch(err => {
        console.error("Unhandled stream error:", err);
        try { controller.close(); } catch {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// --- Core Logic Extracted ---

async function processChatRequest(req: NextRequest, controller: ReadableStreamDefaultController) {
  try {
    const body = await req.json();
    const { messages: reqMessages, model, mode, context, session_id: providedSessionId, parent_message_id } = body;

    const sessionId = providedSessionId || uuidv4();
    controller.enqueue(new TextEncoder().encode(sse_event("session_id", { value: sessionId })));

    // 1. Load History & Append New Message
    let history: Message[] = [];
    
    // Check if parent_message_id was strictly provided (it could be null for root branching)
    const isBranchingOperation = parent_message_id !== undefined;
    
    let currentParentId: number | null = null;

    if (isBranchingOperation) {
      // BRANCHING MODE
      if (parent_message_id !== null) {
        currentParentId = parseInt(parent_message_id);
        if (!isNaN(currentParentId)) {
           history = db_get_thread(currentParentId);
        } else {
           // Fallback if parsing fails? Treat as root.
           currentParentId = null;
           history = []; 
        }
      } else {
        // Explicitly null -> Branching from Root
        currentParentId = null;
        history = [];
      }
    } else {
      // CONTINUATION MODE (Legacy/Default)
      // Load flat history and attach to the very last message found
      history = db_get_history(sessionId);
      if (history.length > 0) {
        currentParentId = history[history.length - 1].id || null;
      }
    }

    const lastUserMsg = reqMessages[reqMessages.length - 1];
    const isNew = history.length === 0 || history[history.length - 1].content !== lastUserMsg.content;
    let userMessageId: number | null = null;

    if (isNew && lastUserMsg.role === 'user') {
      userMessageId = db_append_message(sessionId, 'user', lastUserMsg.content, 'text', undefined, undefined, undefined, currentParentId);
      history.push({ 
        chat_id: sessionId, 
        role: 'user', 
        content: lastUserMsg.content,
        id: userMessageId,
        parent_id: currentParentId
      } as Message);
      currentParentId = userMessageId;
    } else {
      if (history.length > 0) {
         currentParentId = history[history.length - 1].id || null;
      }
    }

    // 2. Summarization
    const currentSummary = db_get_chat_summary(sessionId);
    const updatedSummary = await generateSummary(currentSummary, history, model);

    if (updatedSummary) {
      db_update_chat_summary(sessionId, updatedSummary);
      // @ts-ignore
      if (updatedSummary.user_goal && updatedSummary.user_goal !== "Initial query") {
         // @ts-ignore
        db_update_chat_title(sessionId, updatedSummary.user_goal);
      }
    }

    // 3. Setup LLM
    let tools: any[] = [listFilesTool, readFileTool];
    if (mode === 'write') tools.push(writeToFileTool, deleteFileTool);
    const toolsMap = Object.fromEntries(tools.map(t => [t.name, t]));

    const selectedModel = (model && model.includes("pro"))
      ? (process.env.GEMINI_PRO_MODEL || "gemini-1.5-pro")
      : (process.env.GEMINI_FLASH_MODEL || "gemini-1.5-flash");

    const llm = new ChatGoogleGenerativeAI({
      model: selectedModel,
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY
    }).bindTools(tools);
    
    const promptPath = path.join(process.cwd(), "prompt.txt");
    let systemPrompt = "";
    try {
      systemPrompt = fs.readFileSync(promptPath, "utf-8");
    } catch (e) {
      systemPrompt = "You are Think, an expert AI assistant powered by Google Gemini.";
    }

    if (mode === 'write') {
      systemPrompt += "\n\nYou are in WRITE mode. Use write_file and delete_file when appropriate.";
    } else {
      systemPrompt += "\n\nYou are in DISCUSS mode. You do not have access to write or delete files.";
    }

    // 4. Execution Loop
    let currentTurnMessages: BaseMessage[] = ContextManager.buildMessages(systemPrompt, history, updatedSummary, context);
    let keepLooping = true;
    let turns = 0;
    const MAX_TURNS = 5;

    while (keepLooping && turns < MAX_TURNS) {
      turns++;
      let aggregatedMsg = new AIMessageChunk({ content: "" });
      const responseStream = await llm.stream(currentTurnMessages);

      for await (const chunk of responseStream) {
        aggregatedMsg = aggregatedMsg.concat(chunk);
        if (chunk.content) {
          let text = "";
          if (typeof chunk.content === 'string') {
            text = chunk.content;
          } else {
            for (const part of chunk.content) {
              if (part.type === "text") {
                text += part.text; // Fixed typo
              }
            }
          }
          if (text) {
            controller.enqueue(new TextEncoder().encode(sse_event("content", text)));
          }
        }
      }

      const toolCalls = aggregatedMsg.tool_calls;
      
      const assistantMsgId = db_append_message(
         sessionId, 
         'assistant',
         aggregatedMsg.content.toString(), 
         toolCalls && toolCalls.length > 0 ? 'tool_use' : 'text', 
         undefined, 
         undefined, 
         toolCalls && toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined,
         currentParentId
      );
      currentParentId = assistantMsgId;

      if (toolCalls && toolCalls.length > 0) {
        currentTurnMessages.push(aggregatedMsg);
        for (const call of toolCalls) {
          const tool = toolsMap[call.name];
          controller.enqueue(new TextEncoder().encode(sse_event("tool_start", { tool: call.name })))
          let result = tool ? await tool.invoke(call.args) : `Error: Tool ${call.name} not found.`;
          controller.enqueue(new TextEncoder().encode(sse_event("tool_result", { tool: call.name, result: result })))
          
          const toolResultId = db_append_message(
            sessionId, 
            'tool',
            result.toString(), 
            'tool_result',
            call.id,
            call.name,
            undefined,
            currentParentId
          );
          currentParentId = toolResultId;
          currentTurnMessages.push(new ToolMessage({ content: result.toString(), tool_call_id: call.id!, name: call.name }));
        }
      } else {
        keepLooping = false;
      }
    }

  } catch (error: any) {
    console.error("Chat API Error:", error);
    try {
      controller.enqueue(new TextEncoder().encode(sse_event("error", { value: error.message })));
    } catch (ignore) { }
  } finally {
    try { controller.close(); } catch (e) { }
  }
}
