import { describe, expect, it } from "vitest";

import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import type {
  GenerationParameters,
  GenerationPromptMessage,
} from "../../../engine/generation/generation";
import fixtureSource from "../../../../test-fixtures/provider-parameter-payloads.json?raw";
import { buildProviderPayload } from "./provider-parameter-adaptation";

interface FixtureCase {
  name: string;
  provider: ProviderConnectionProvider;
  model: string;
  messages: GenerationPromptMessage[];
  parameters: GenerationParameters;
  expected?: Record<string, unknown>;
  expectedError?: string;
}

const fixtures = JSON.parse(fixtureSource) as { schemaVersion: number; cases: FixtureCase[] };

describe("provider parameter payload parity", () => {
  it("uses the hand-authored fixture schema", () => {
    expect(fixtures.schemaVersion).toBe(1);
  });

  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      const build = () =>
        buildProviderPayload({
          provider: fixture.provider,
          model: fixture.model,
          messages: fixture.messages,
          parameters: fixture.parameters,
        });

      if (fixture.expectedError) {
        expect(build).toThrow(fixture.expectedError);
      } else {
        expect(build()).toEqual(fixture.expected);
      }
    });
  }
});
