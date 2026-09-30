import { useState, useCallback, useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  newElementWith,
} from "@excalidraw/excalidraw";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import { serializeCanvasState } from "./context/canvas-state";
import { findOverlaps } from "./context/overlaps";
import { applyCrossCallBindings, mergeBoundElements } from "./context/cross-call-bindings";
import "./App.css";

// One agent instance per page load. The canvas state lives only in the
// browser, so persisting chat history across refreshes would leave a dead
// conversation referencing diagrams that no longer exist.
const sessionId = crypto.randomUUID();

// Recursively drop null valued fields. Our tool schemas use optional
// fields now, so this is mostly a no-op safety net; kept in case a field
// is ever nullable again. The Excalidraw skeleton helper expects
// undefined for "use the default," not null, and chokes on `label: null`
// or `start: null`.
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

// The `style` object bundles strokeColor/backgroundColor/fillStyle/
// strokeWidth/roughness/opacity into one optional parameter (see
// element-schema.ts for why), but `convertToExcalidrawElements` and
// `newElementWith` expect those properties flat. Unwrap it before handing
// elements/fields off to Excalidraw.
function flattenStyle(value: Record<string, unknown>): Record<string, unknown> {
  const { style, ...rest } = value;
  return style && typeof style === "object"
    ? { ...rest, ...(style as Record<string, unknown>) }
    : rest;
}

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Hold the latest excalidrawAPI in a ref so onToolCall (captured once at
  // hook init) always reads the live API instead of a stale closure copy.
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({ agent: "design-agent", name: sessionId });

  // All four canvas tools are client side. The worker streams the call here,
  // we apply it to the live Excalidraw scene, and submit the result via
  // addToolOutput so the agent loop resumes.
  const { messages, sendMessage, status } = useAgentChat({
    agent,
    onToolCall: async ({ toolCall, addToolOutput }) => {
      const api = excalidrawAPIRef.current;
      if (!api) {
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { error: "canvas not ready" } });
        return;
      }

      if (toolCall.toolName === "queryCanvas") {
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: { summary: serializeCanvasState(api.getSceneElements() as unknown[]) },
        });
        return;
      }

      if (toolCall.toolName === "addElements") {
        const { elements } = toolCall.input as { elements: Record<string, unknown>[] };
        // Unwrap the bundled `style` object and strip any null fields
        // before handing to convertToExcalidrawElements, which expects
        // style properties flat and undefined (not null) for defaults.
        const cleaned = elements.map((el) => stripNulls(flattenStyle(el))) as Record<
          string,
          unknown
        >[];
        const newOnes = convertToExcalidrawElements(cleaned as never, { regenerateIds: false });

        // Patch arrow bindings that reference shapes already on the canvas
        // (the helper only resolves bindings within its own input batch).
        // See src/context/cross-call-bindings.ts for the gory details.
        const existingScene = api.getSceneElements();
        const { arrowsByTargetId } = applyCrossCallBindings(
          cleaned,
          newOnes as unknown as { id: string; startBinding?: unknown; endBinding?: unknown }[],
          existingScene as unknown as { id: string }[]
        );
        const patchedExisting = existingScene.map((el) => {
          const incoming = arrowsByTargetId.get(el.id);
          if (!incoming || incoming.length === 0) return el;
          const merged = mergeBoundElements(
            el as unknown as { id: string; boundElements?: readonly { id: string; type: string }[] },
            incoming
          );
          return newElementWith(el, { boundElements: merged } as never);
        });

        const next = [...patchedExisting, ...newOnes];
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        api.scrollToContent(next, { fitToContent: true });
        // Detect overlaps in the post-add scene and surface them in the
        // tool result so the agent's next reasoning step sees collisions
        // and can self correct via updateElements. Same finding the
        // noOverlaps eval scorer would report.
        const overlaps = findOverlaps(next as unknown[]);
        addToolOutput({
          toolCallId: toolCall.toolCallId,
          output: { added: newOnes.length, overlaps },
        });
        return;
      }

      if (toolCall.toolName === "updateElements") {
        const { updates } = toolCall.input as {
          updates: { id: string; fields: Record<string, unknown> }[];
        };
        const byId = new Map(
          updates.map((u) => [
            u.id,
            stripNulls(flattenStyle(u.fields)) as Record<string, unknown>,
          ])
        );
        const next = api.getSceneElements().map((el) => {
          const fields = byId.get(el.id);
          return fields && Object.keys(fields).length > 0
            ? newElementWith(el, fields as never)
            : el;
        });
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { updated: byId.size } });
        return;
      }

      if (toolCall.toolName === "removeElements") {
        const { ids } = toolCall.input as { ids: string[] };
        const remove = new Set(ids);
        const next = api.getSceneElements().filter((el) => !remove.has(el.id));
        api.updateScene({ elements: next, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { removed: remove.size } });
        return;
      }
    },
  });

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel
        messages={messages}
        sendMessage={sendMessage}
        status={status}
      />
      <a href="#viewer" className="viewer-launch" title="Open diagram viewer for human scoring">
        viewer
      </a>
    </div>
  );
}
