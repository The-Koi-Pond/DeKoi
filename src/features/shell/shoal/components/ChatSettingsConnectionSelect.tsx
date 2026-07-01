import {
  getProviderConnectionProviderOption,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";

interface ChatSettingsConnectionSelectProps {
  activeMessengerThread: boolean;
  connections: ProviderConnectionRecord[];
  fallbackConnection: ProviderConnectionRecord | null;
  fallbackConnectionPrefix: string;
  hasMissingConnection: boolean;
  messengerConnectionValue: string;
  onConnectionChange: (connectionId: string) => void;
}

export function ChatSettingsConnectionSelect({
  activeMessengerThread,
  connections,
  fallbackConnection,
  fallbackConnectionPrefix,
  hasMissingConnection,
  messengerConnectionValue,
  onConnectionChange,
}: ChatSettingsConnectionSelectProps) {
  const fallbackConnectionProvider = fallbackConnection
    ? getProviderConnectionProviderOption(fallbackConnection.provider)
    : null;

  return (
    <label className="chat-settings-field">
      <span>Provider</span>
      <select
        className="pondsel"
        value={messengerConnectionValue}
        disabled={!activeMessengerThread || connections.length === 0}
        onChange={(event) => onConnectionChange(event.currentTarget.value)}
      >
        {connections.length === 0 ? (
          hasMissingConnection ? (
            <option value={messengerConnectionValue} disabled>
              Missing connection
            </option>
          ) : (
            <option value="">No connections</option>
          )
        ) : (
          <>
            {hasMissingConnection && (
              <option value={messengerConnectionValue} disabled>
                Missing connection
              </option>
            )}
            {!hasMissingConnection && (
              <option value="">
                {fallbackConnectionPrefix} ·{" "}
                {fallbackConnection && fallbackConnectionProvider
                  ? `${fallbackConnection.label} · ${
                      fallbackConnectionProvider.label
                    } · ${fallbackConnection.model || "No model"}`
                  : "No connection"}
              </option>
            )}
            {connections.map((connection) => {
              const provider = getProviderConnectionProviderOption(
                connection.provider,
              );
              const model = connection.model || "No model";

              return (
                <option value={connection.id} key={connection.id}>
                  {connection.label} · {provider.label} · {model}
                </option>
              );
            })}
          </>
        )}
      </select>
    </label>
  );
}
