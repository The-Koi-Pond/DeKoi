import { useState } from "react";

type NonNegativeActivationInputState =
  | {
      initialValue: number;
      value?: never;
      onChange?: never;
    }
  | {
      initialValue?: never;
      value: string;
      onChange: (value: string) => void;
    };

export type NonNegativeActivationInputProps = {
  fallback: number;
  id: string;
  onCommit: (value: number) => void;
  reader: (value: string, fallback: number) => number;
} & NonNegativeActivationInputState;

export function NonNegativeActivationInput(props: NonNegativeActivationInputProps) {
  const [localDraft, setLocalDraft] = useState(
    props.initialValue === undefined ? "" : String(props.initialValue),
  );
  const draft = props.value ?? localDraft;

  function setDraft(value: string) {
    if (props.onChange) {
      props.onChange(value);
    } else {
      setLocalDraft(value);
    }
  }

  function commitDraft() {
    const value = props.reader(draft, props.fallback);
    setDraft(String(value));
    props.onCommit(value);
  }

  return (
    <input
      id={props.id}
      className="pondinput"
      type="number"
      min={0}
      step={1}
      value={draft}
      onBlur={commitDraft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : undefined)}
    />
  );
}

export function NullableActivationInput({
  id,
  initialValue,
  max,
  onCommit,
  reader,
}: {
  id: string;
  initialValue: number | null;
  max?: number;
  onCommit: (value: number | null) => void;
  reader: (value: string, fallback: number | null) => number | null;
}) {
  const [draft, setDraft] = useState(initialValue?.toString() ?? "");

  function commitDraft() {
    const parsedValue = reader(draft, initialValue);
    setDraft(parsedValue?.toString() ?? "");
    onCommit(parsedValue);
  }

  return (
    <input
      id={id}
      className="pondinput"
      type="number"
      min={0}
      max={max}
      step={1}
      value={draft}
      onBlur={commitDraft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : undefined)}
    />
  );
}
