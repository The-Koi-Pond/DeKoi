import { invokeRemote } from "./remote-runtime";
import { RUNTIME_COMMANDS } from "./runtime-commands";

export interface ProviderConnectionCheckInput {
  id?: string;
  status?: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ProviderConnectionCheckResult {
  success: boolean;
  message: string;
}

export async function checkProviderConnection(
  connection: ProviderConnectionCheckInput,
): Promise<ProviderConnectionCheckResult> {
  return await invokeRemote<ProviderConnectionCheckResult>(
    RUNTIME_COMMANDS.providerConnectionCheck,
    { connection },
  );
}
