import type { MessengerGenerationAdapter } from "../../../engine/generation/messenger-generation";
import {
  generateWithConfiguredProvider,
  providerErrorMessage,
} from "./provider-generation";

export const providerMessengerGenerationAdapter: MessengerGenerationAdapter = {
  providerKind: "external-provider",
  async generate(request) {
    try {
      return await generateWithConfiguredProvider(request);
    } catch (error) {
      throw new Error(
        `Provider Messenger generation failed. ${providerErrorMessage(error)}`,
        { cause: error },
      );
    }
  },
};
