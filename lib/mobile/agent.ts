import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, ToolMessage, BaseMessage, AIMessageChunk, SystemMessage } from "@langchain/core/messages";
import { mobileListFilesTool, mobileReadFileTool, mobileWriteToFileTool, mobileDeleteFileTool } from "./tools";
import { ContextManager } from "@/lib/ai/context_manager";
import { MobileDB } from "./db";
import { Message } from "@/lib/types";
import { v4 as uuidv4 } from 'uuid';

export interface AgentConfig {
  sessionId?: string;
  messages: { role: string, content: string }[];
  model: string;
  mode: 'discuss' | 'write';
  context?: any;
  parentMessageId?: number | null;
  apiKey: string;
  onStream: (event: { type: string, value?: any, tool?: string, result?: string }) => void;
  geminiFlashModel?: string;
  geminiProModel?: string;
}

export const MobileAgent = {
  async run({ sessionId: providedSessionId, messages: reqMessages, model, mode, context, parentMessageId, apiKey, onStream, geminiFlashModel, geminiProModel }: AgentConfig) {
    if (!apiKey) {
      onStream({ type: 'error', value: 'Missing Google API Key' });
      return;
    }

    const sessionId = providedSessionId || uuidv4();
    onStream({ type: 'session_id', value: sessionId });

    // 1. Load History & Append New Message
    let history: Message[] = [];
    let currentParentId: number | null = parentMessageId || null;

    if (currentParentId) {
      history = await MobileDB.getThread(currentParentId);
    } else {
        // Fallback if no parent ID (e.g. new chat)
        // But for new chat history is empty anyway
    }

    const lastUserMsg = reqMessages[reqMessages.length - 1];
    // Check duplication (basic)
    const isNew = history.length === 0 || history[history.length - 1].content !== lastUserMsg.content;
    let userMessageId: number | null = null;

    if (isNew && lastUserMsg.role === 'user') {
      userMessageId = await MobileDB.appendMessage(sessionId, 'user', lastUserMsg.content, 'text', undefined, undefined, undefined, currentParentId);
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

    // 2. Summarization (Simplified for Client - maybe skip often or run loosely)
    const currentSummary = await MobileDB.getChatSummary(sessionId);
    // We can run summarizer in parallel or skip to save latency. Let's skip for V1 or do it simply.
    // For V1 mobile, let's skip automatic summarization to keep it snappy, or run it fire-and-forget.
    // Let's implement fire-and-forget summarization
    generateSummary(currentSummary, history, geminiFlashModel || "gemini-1.5-flash", apiKey).then(updatedSummary => {
        if (updatedSummary) {
            MobileDB.updateChatSummary(sessionId, updatedSummary);
             // @ts-ignore
            if (updatedSummary.user_goal && updatedSummary.user_goal !== "Initial query") {
                 // @ts-ignore
                MobileDB.updateChatTitle(sessionId, updatedSummary.user_goal);
            }
        }
    });


    // 3. Setup LLM
    let tools: any[] = [mobileListFilesTool, mobileReadFileTool];
    if (mode === 'write') tools.push(mobileWriteToFileTool, mobileDeleteFileTool);
    const toolsMap = Object.fromEntries(tools.map(t => [t.name, t]));

    const selectedModel = (model && model.includes("pro")) 
      ? (geminiProModel || "gemini-1.5-pro") 
      : (geminiFlashModel || "gemini-1.5-flash");

    const llm = new ChatGoogleGenerativeAI({
      model: selectedModel,
      temperature: 0.7,
      apiKey: apiKey
    }).bindTools(tools);
    
    // Default Prompt
    let systemPrompt = "You are Think, an expert AI assistant powered by Google Gemini.";
    if (mode === 'write') {
      systemPrompt += "\nYou are in WRITE mode. Use write_file and delete_file when appropriate.";
    } else {
      systemPrompt += "\nYou are in DISCUSS mode. You do not have access to write or delete files.";
    }

    // 4. Execution Loop
    let currentTurnMessages: BaseMessage[] = ContextManager.buildMessages(systemPrompt, history, currentSummary, context);
    let keepLooping = true;
    let turns = 0;
    const MAX_TURNS = 5;

    while (keepLooping && turns < MAX_TURNS) {
      turns++;
      let aggregatedMsg = new AIMessageChunk({ content: "" });
      
      try {
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
                    text += part.text;
                  }
                }
              }
              if (text) {
                onStream({ type: 'content', value: text });
              }
            }
          }
      } catch(e: any) {
          onStream({ type: 'error', value: e.message });
          return;
      }

      const toolCalls = aggregatedMsg.tool_calls;
      
      const assistantMsgId = await MobileDB.appendMessage(
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
          onStream({ type: 'tool_start', tool: call.name });
          
          let result = tool ? await tool.invoke(call.args) : `Error: Tool ${call.name} not found.`;
          
          onStream({ type: 'tool_result', tool: call.name, result: result });
          
          const toolResultId = await MobileDB.appendMessage(
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
  }
};

async function generateSummary(
  currentSummary: object | null,
  history: Message[],
  model: string,
  apiKey: string
): Promise<object | null> {
  const summarizer = new ChatGoogleGenerativeAI({
    model: model, 
    temperature: 0.0,
    apiKey: apiKey
  });

  const summaryPrompt = `
    You are a session analyst. Update JSON summary.
    Current: ${JSON.stringify(currentSummary, null, 2) || "{}"}
    Latest: ${history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}
    Update fields: user_goal, current_stage, constraints, decisions_made, open_questions.
    RULES: ONLY output JSON.
  `;

  try {
    const response = await summarizer.invoke([new HumanMessage(summaryPrompt)]);
    const responseText = response.content.toString();
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : responseText;
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
}
