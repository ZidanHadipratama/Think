import { BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { Message } from "../db";

export interface ChatContext {
  filename: string;
  content: string;
}

export class ContextManager {
  static buildMessages(
    systemPrompt: string,
    history: Message[],
    summary: object | null,
    context?: ChatContext | null
  ): BaseMessage[] {
    
    let finalSystemPrompt = systemPrompt;
    if (summary) {
      const summaryText = `
---
## Current Session Summary
${JSON.stringify(summary, null, 2)}
---
      `;
      finalSystemPrompt = summaryText + "\n" + systemPrompt;
    }

    const messages: BaseMessage[] = [new SystemMessage(finalSystemPrompt)];

    // 1. Inject Tool/Doc Context
    if (context) {
      messages.push(new SystemMessage(
        `<Document name='${context.filename}'>\n${context.content}\n</Document>`
      ));
    }

    // 2. Process History
    const fullSequence = history; // currentMessages was unused

    // 3. Truncation / Token Safety
    const LIMIT = 20;
    let effectiveSequence = fullSequence;
    if (fullSequence.length > LIMIT) {
      effectiveSequence = fullSequence.slice(-LIMIT);
    }

    for (const msg of effectiveSequence) {
      if (msg.type === 'tool_use') {
        let toolArgs: any = {};
        try {
          if (msg.tool_args) toolArgs = JSON.parse(msg.tool_args);
        } catch (e) {
          console.error("Failed to parse tool_args", e);
        }

        let toolCalls: any[] = [];
        if (Array.isArray(toolArgs)) {
          toolCalls = toolArgs;
        } else {
          toolCalls = [{
            name: msg.tool_name,
            args: toolArgs,
            id: msg.tool_call_id,
            type: 'tool_call'
          }];
        }

        messages.push(new AIMessage({
          content: msg.content || "",
          tool_calls: toolCalls
        }));

      } else if (msg.type === 'tool_result') {
        messages.push(new ToolMessage({
          content: msg.content,
          tool_call_id: msg.tool_call_id || "unknown",
          name: msg.tool_name || "tool"
        }));
      } else if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }

    return messages;
  }
}
