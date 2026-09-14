import { AIChatAgent } from "@cloudflare/ai-chat";
import { convertToModelMessages } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamAgent } from "./agent-core";

interface Env extends Cloudflare.Env {
  OPENAI_API_KEY: string;
  TAVILY_API_KEY: string;
  UPSTASH_VECTOR_REST_URL: string;
  UPSTASH_VECTOR_REST_TOKEN: string;
}

export class DesignAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const anthropic = createAnthropic({ apiKey: this.env.OPENAI_API_KEY });
    const model = anthropic("claude-haiku-4-5-20251001");
    const messages = await convertToModelMessages(this.messages);

    const result = streamAgent({
      model,
      messages,
      env: {
        TAVILY_API_KEY: this.env.TAVILY_API_KEY,
        UPSTASH_VECTOR_REST_URL: this.env.UPSTASH_VECTOR_REST_URL,
        UPSTASH_VECTOR_REST_TOKEN: this.env.UPSTASH_VECTOR_REST_TOKEN,
      },
    });

    return result.toUIMessageStreamResponse();
  }
}
