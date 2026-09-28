import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages, UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamAgent } from "./agent-core";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
}

type CanvasStatePart = { type: "data-canvas-state"; data: { elements: any[] } };

const extractCanvasState = (messages: UIMessage[]) => {
  const last = messages.at(-1);
  const part = last?.parts.find(
    (p): p is CanvasStatePart => p.type === "data-canvas-state",
  );
  return part?.data.elements ?? [];
};

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const anthropic = createAnthropic({ apiKey: this.env.OPENAI_API_KEY });

    const canvasState = extractCanvasState(this.messages);

    const result = streamAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: await convertToModelMessages(this.messages),
      canvasState,
    });

    return result.toUIMessageStreamResponse();
  }
}
