import { Switch } from "../../../shared/ui/primitives/Switch";

interface LorebookGroupScoringActivationFieldProps {
  onUseGroupScoringChange: (useGroupScoring: boolean) => void;
  useGroupScoring: boolean;
}

export function LorebookGroupScoringActivationField({
  onUseGroupScoringChange,
  useGroupScoring,
}: LorebookGroupScoringActivationFieldProps) {
  return (
    <div className="catalog-editor-field catalog-editor-toggle">
      <span className="catalog-toggle-label">Use group scoring</span>
      <Switch
        checked={useGroupScoring}
        onChange={onUseGroupScoringChange}
        ariaLabel="Use group scoring"
      />
    </div>
  );
}
