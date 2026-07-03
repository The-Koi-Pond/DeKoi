import {
  getProviderConnectionProviderOption,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import { ChatSettingsDropdown, type ChatSettingsDropdownOption } from "./ChatSettingsDropdown";

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
  const options: ChatSettingsDropdownOption[] =
    connections.length === 0
      ? [
          hasMissingConnection
            ? {
                disabled: true,
                label: "Missing connection",
                value: messengerConnectionValue,
              }
            : { disabled: true, label: "No connections", value: "" },
        ]
      : [
          ...(hasMissingConnection
            ? [
                {
                  disabled: true,
                  label: "Missing connection",
                  value: messengerConnectionValue,
                },
              ]
            : [
                {
                  label:
                    fallbackConnection && fallbackConnectionProvider
                      ? `${fallbackConnectionPrefix} · ${
                          fallbackConnection.label
                        } · ${fallbackConnectionProvider.label} · ${
                          fallbackConnection.model || "No model"
                        }`
                      : `${fallbackConnectionPrefix} · No connection`,
                  value: "",
                },
              ]),
          ...connections.map((connection) => {
            const provider = getProviderConnectionProviderOption(connection.provider);
            const model = connection.model || "No model";

            return {
              label: `${connection.label} · ${provider.label} · ${model}`,
              value: connection.id,
            };
          }),
        ];

  return (
    <div className="chat-settings-field chat-settings-dropdown-field">
      <span id="chat-settings-provider-label">Provider</span>
      <ChatSettingsDropdown
        value={messengerConnectionValue}
        labelledBy="chat-settings-provider-label"
        menuId="chat-settings-provider-menu"
        options={options}
        disabled={!activeMessengerThread || connections.length === 0}
        onChange={onConnectionChange}
      />
    </div>
  );
}
