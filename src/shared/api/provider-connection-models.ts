import { invokeRemote } from "./remote-runtime";
import { RUNTIME_COMMANDS } from "./runtime-commands";

export interface ProviderConnectionModelsInput {
  id?: string;
  status?: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderConnectionModelsResult {
  models: string[];
}

export async function fetchProviderConnectionModels(
  connection: ProviderConnectionModelsInput,
): Promise<ProviderConnectionModelsResult> {
  return await invokeRemote<ProviderConnectionModelsResult>(
    RUNTIME_COMMANDS.providerConnectionModels,
    { connection },
  );
}
