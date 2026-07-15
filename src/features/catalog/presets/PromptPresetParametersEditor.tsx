import type { Dispatch, ReactNode, SetStateAction } from "react";

import {
  GENERATION_PARAMETER_SPEC,
  STANDARD_GENERATION_PARAMETER_KEYS,
  isGenerationEnumParameterKey,
  isGenerationNumericParameterKey,
  isGenerationStringArrayParameterKey,
  type GenerationDraftParameterEntry,
  type StandardGenerationParameterKey,
  type StandardGenerationParameterValue,
} from "../../../engine/generation-core/generation-parameter-contract";
import {
  promptPresetDraftParameterEntry,
  promptPresetDraftParameterError,
  withPromptPresetDraftParameterEntry,
  type PromptPresetDraftState,
} from "./prompt-preset-draft";

const PARAMETER_PRESENTATION = {
  maxTokens: { label: "Max Tokens", step: 1 },
  temperature: { label: "Temperature", step: 0.05 },
  topP: { label: "Top P", step: 0.05 },
  topK: { label: "Top K", step: 1 },
  minP: { label: "Min P", step: 0.05 },
  frequencyPenalty: { label: "Frequency Penalty", step: 0.05 },
  presencePenalty: { label: "Presence Penalty", step: 0.05 },
  reasoningEffort: { label: "Reasoning Effort" },
  verbosity: { label: "Verbosity" },
  serviceTier: { label: "Service Tier" },
  stopSequences: { label: "Stop Sequences" },
} as const satisfies Record<StandardGenerationParameterKey, { label: string; step?: number }>;

export function PromptPresetParametersEditor({
  draft,
  onDraftChange,
}: {
  draft: PromptPresetDraftState;
  onDraftChange: Dispatch<SetStateAction<PromptPresetDraftState>>;
}) {
  const setEntry = <Key extends StandardGenerationParameterKey>(
    key: Key,
    entry: GenerationDraftParameterEntry<StandardGenerationParameterValue<Key>>,
  ) => onDraftChange((current) => withPromptPresetDraftParameterEntry(current, key, entry));

  const renderParameter = <Key extends StandardGenerationParameterKey>(
    key: Key,
    control: ReactNode,
  ) => {
    const label = PARAMETER_PRESENTATION[key].label;
    const current = promptPresetDraftParameterEntry(draft.parameters, key);
    const error = promptPresetDraftParameterError(key, current);
    return (
      <div className="prompt-parameter-row" key={key}>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-parameter-${key}`}>{label}</label>
          {control}
          {error && (
            <p role="alert" className="catalog-field-hint">
              {error}
            </p>
          )}
        </div>
        <label className="prompt-parameter-send">
          <input
            type="checkbox"
            aria-label={`Send ${label}`}
            checked={current?.send ?? false}
            onChange={(event) =>
              setEntry(key, { send: event.target.checked, value: current?.value ?? null })
            }
          />{" "}
          Send
        </label>
      </div>
    );
  };

  return (
    <section className="catalog-editor-section" aria-labelledby="preset-generation-heading">
      <h4 id="preset-generation-heading">Generation Parameters</h4>
      <p className="catalog-field-hint">
        Send off omits the preset setting. Providers may omit, adapt, or reject unsupported fields.
        Anthropic requires Max Tokens; if it is omitted, generation stops before HTTP.
      </p>
      <div className="prompt-parameters-grid">
        {STANDARD_GENERATION_PARAMETER_KEYS.map((key) => {
          if (isGenerationNumericParameterKey(key)) {
            const current = promptPresetDraftParameterEntry(draft.parameters, key);
            const spec = GENERATION_PARAMETER_SPEC[key];
            return renderParameter(
              key,
              <input
                id={`preset-parameter-${key}`}
                className="pondinput"
                type="number"
                min={spec.minimum}
                max={spec.maximum}
                step={PARAMETER_PRESENTATION[key].step}
                value={current?.value == null ? "" : String(current.value)}
                onChange={(event) =>
                  setEntry(key, {
                    send: current?.send ?? false,
                    value: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />,
            );
          }

          if (isGenerationEnumParameterKey(key)) {
            const current = promptPresetDraftParameterEntry(draft.parameters, key);
            const options = GENERATION_PARAMETER_SPEC[key].options;
            return renderParameter(
              key,
              <select
                id={`preset-parameter-${key}`}
                className="pondinput"
                value={current?.value ?? ""}
                onChange={(event) =>
                  setEntry(key, {
                    send: current?.send ?? false,
                    value: options.find((option) => option === event.target.value) ?? null,
                  })
                }
              >
                <option value="">Choose…</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>,
            );
          }

          if (isGenerationStringArrayParameterKey(key)) {
            const current = promptPresetDraftParameterEntry(draft.parameters, key);
            return renderParameter(
              key,
              <textarea
                id={`preset-parameter-${key}`}
                className="pondinput pondtextarea"
                rows={4}
                value={current?.value?.join("\n") ?? ""}
                onChange={(event) =>
                  setEntry(key, {
                    send: current?.send ?? false,
                    value: event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />,
            );
          }

          return null;
        })}
      </div>
      {draft.parameters.customParameters && (
        <p className="catalog-field-hint">
          {Object.keys(draft.parameters.customParameters).length} custom parameter(s) are sent only
          through enabled Custom (OAI-Compatible) connections.
        </p>
      )}
    </section>
  );
}
