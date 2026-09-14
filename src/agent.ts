import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamAgent } from "./agent-core";
import type { ExcalidrawElement } from "./schemas";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
}

// Pull canvas state out of the user's just-arrived message. The client
// attaches it as a `data-canvas-state` part on every outgoing message via
// App.tsx — that's the only way to send extra payload alongside a message
// in the Cloudflare AI Chat protocol, since useAgentChat / AIChatAgent only
// understand UIMessage on the wire. onChatMessage runs because the user
// sent a message, so the last message in the array is always theirs.
type CanvasStatePart = {
  type: "data-canvas-state";
  data: { elements: ExcalidrawElement[] };
};

function extractCanvasState(messages: UIMessage[]): ExcalidrawElement[] {
  const last = messages.at(-1);
  const part = last?.parts.find(
    (p): p is CanvasStatePart => (p as { type?: string }).type === "data-canvas-state"
  );
  return part?.data.elements ?? [];
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const anthropic = createAnthropic({ apiKey: this.env.OPENAI_API_KEY });
    const model = anthropic("claude-haiku-4-5-20251001");

    const canvasState = extractCanvasState(this.messages);
    const messages = await convertToModelMessages(this.messages);

    const result = streamAgent({
      model,
      messages,
      canvasState,
    });

    return result.toUIMessageStreamResponse();
  }
}
