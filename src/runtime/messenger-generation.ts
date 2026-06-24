import type {
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../engine/messenger-generation";
import { mockMessengerGenerationAdapter } from "./mock-messenger-generation";

export type MessengerGenerationRuntimeMode = "mock";

export interface MessengerGenerationRuntimeSnapshot {
  mode: MessengerGenerationRuntimeMode;
  label: string;
  adapter: MessengerGenerationAdapter;
}

export function selectMessengerGenerationRuntime(): MessengerGenerationRuntimeSnapshot {
  return {
    mode: "mock",
    label: "Mock generation",
    adapter: mockMessengerGenerationAdapter,
  };
}

export async function generateMessengerResponse(
  request: MessengerGenerationRequest,
): Promise<MessengerGenerationResponse> {
  const runtime = selectMessengerGenerationRuntime();
  return runtime.adapter.generate(request);
}
