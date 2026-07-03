import { Switch } from "../../../shared/ui/primitives/Switch";
import {
  NonNegativeActivationInput,
  type NonNegativeActivationInputProps,
} from "../shared/ActivationInputs";

interface LorebookRecursionActivationFieldsProps {
  maxRecursionStepsInput: NonNegativeActivationInputProps;
  onRecursiveScanChange: (recursiveScan: boolean) => void;
  recursiveScan: boolean;
}

export function LorebookRecursionActivationFields({
  maxRecursionStepsInput,
  onRecursiveScanChange,
  recursiveScan,
}: LorebookRecursionActivationFieldsProps) {
  return (
    <>
      <div className="catalog-editor-field catalog-editor-toggle">
        <span className="catalog-toggle-label">Recursive scan</span>
        <Switch
          checked={recursiveScan}
          onChange={onRecursiveScanChange}
          ariaLabel="Recursive scan"
        />
      </div>
      <div className="catalog-editor-field">
        <label htmlFor={maxRecursionStepsInput.id}>Max recursion steps</label>
        <NonNegativeActivationInput {...maxRecursionStepsInput} />
      </div>
    </>
  );
}
