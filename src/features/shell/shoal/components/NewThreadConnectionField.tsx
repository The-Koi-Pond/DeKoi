import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { NewThreadSelectField } from "./NewThreadSelectField";

interface NewThreadConnectionFieldProps {
  connections: ProviderConnectionRecord[];
  value: string;
  onChange: (connectionId: string) => void;
}

export function NewThreadConnectionField({
  connections,
  value,
  onChange,
}: NewThreadConnectionFieldProps) {
  return (
    <NewThreadSelectField
      disabled={connections.length === 0}
      label="Connection"
      value={value}
      onChange={onChange}
    >
      {connections.map((connection) => (
        <option value={connection.id} key={connection.id}>
          {connection.label}
        </option>
      ))}
    </NewThreadSelectField>
  );
}
