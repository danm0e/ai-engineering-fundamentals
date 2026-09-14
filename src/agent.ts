import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamAgent } from "./agent-core";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const anthropic = createAnthropic({ apiKey: this.env.OPENAI_API_KEY });

    const result = streamAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      messages: await convertToModelMessages(this.messages),
    });

    return result.toUIMessageStreamResponse();
  }
}
