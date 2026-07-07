import { describe, expect, it } from "vitest";

import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import { extractProviderTextResult, type ProviderTextResult } from "./provider-generation";
import fixtureSource from "../../../../test-fixtures/provider-response-parity.json?raw";

type SupportedProviderResponseProvider = Extract<
  ProviderConnectionProvider,
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "nanogpt"
  | "xai"
  | "custom"
>;

const supportedProviderResponseProviders = new Set<ProviderConnectionProvider>([
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "openrouter",
  "nanogpt",
  "xai",
  "custom",
]);

const unsupportedProviderResponseProviders = [
  "openai_chatgpt",
  "claude_subscription",
  "google_vertex",
] as const satisfies ProviderConnectionProvider[];

interface ProviderResponseParityFixtureFile {
  schemaVersion: 1;
  cases: ProviderResponseParityFixture[];
}

interface ProviderResponseParityFixture {
  name: string;
  provider: SupportedProviderResponseProvider;
  payload: unknown;
  expected: ProviderTextResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertFixture(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid provider response parity fixture: ${message}`);
  }
}

function isSupportedProviderResponseProvider(
  value: unknown,
): value is SupportedProviderResponseProvider {
  return (
    typeof value === "string" &&
    supportedProviderResponseProviders.has(value as ProviderConnectionProvider)
  );
}

function parseProviderResponseParityFixtures(source: string): ProviderResponseParityFixtureFile {
  const value = JSON.parse(source) as unknown;
  assertFixture(isRecord(value), "root must be an object");
  assertFixture(value.schemaVersion === 1, "schemaVersion must be 1");
  assertFixture(Array.isArray(value.cases), "cases must be an array");

  const names = new Set<string>();
  const cases = value.cases.map((item, index): ProviderResponseParityFixture => {
    assertFixture(isRecord(item), `cases[${index}] must be an object`);
    assertFixture(
      typeof item.name === "string" && item.name.trim(),
      `cases[${index}].name must be a non-empty string`,
    );
    assertFixture(!names.has(item.name), `duplicate case name: ${item.name}`);
    names.add(item.name);

    assertFixture(
      isSupportedProviderResponseProvider(item.provider),
      `cases[${index}].provider is unsupported: ${String(item.provider)}`,
    );
    assertFixture(
      Object.prototype.hasOwnProperty.call(item, "payload"),
      `cases[${index}].payload is required`,
    );
    assertFixture(isRecord(item.expected), `cases[${index}].expected must be an object`);
    const expectedText = item.expected.text;
    const expectedWarning = item.expected.warning;
    assertFixture(
      typeof expectedText === "string",
      `cases[${index}].expected.text must be a string`,
    );
    assertFixture(
      expectedWarning === undefined || typeof expectedWarning === "string",
      `cases[${index}].expected.warning must be a string when present`,
    );

    return {
      name: item.name,
      provider: item.provider,
      payload: item.payload,
      expected:
        expectedWarning === undefined
          ? { text: expectedText }
          : { text: expectedText, warning: expectedWarning },
    };
  });

  return { schemaVersion: 1, cases };
}

const fixtures = parseProviderResponseParityFixtures(fixtureSource);

describe("provider response parity fixtures", () => {
  it("uses the supported fixture schema", () => {
    expect(fixtures.schemaVersion).toBe(1);
  });

  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      expect(extractProviderTextResult(fixture.provider, fixture.payload)).toEqual(
        fixture.expected,
      );
    });
  }

  it("rejects unsupported fixture providers", () => {
    const invalidSource = JSON.stringify({
      schemaVersion: 1,
      cases: [
        {
          name: "unsupported alias",
          provider: "openai_chatgpt",
          payload: { text: "not reachable" },
          expected: { text: "not reachable" },
        },
      ],
    });

    expect(() => parseProviderResponseParityFixtures(invalidSource)).toThrow(
      "provider is unsupported",
    );
  });

  it("documents unsupported provider extraction paths", () => {
    for (const provider of unsupportedProviderResponseProviders) {
      expect(() => extractProviderTextResult(provider, { text: "not reachable" })).toThrow(
        `${provider} is not supported by the bare-minimum provider adapter yet.`,
      );
    }
  });
});
