import {
  getProviderConnectionProviderOption,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import { ChatSettingsDrawer, ChatSettingsNotice } from "./ChatSettingsBlocks";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface MissingConnectionResolution {
  actionLabel: string;
  connectionId: string | null;
}

interface ChatSettingsConnectionDrawerProps {
  activeMessengerThread: boolean;
  connections: ProviderConnectionRecord[];
  fallbackConnection: ProviderConnectionRecord | null;
  fallbackConnectionPrefix: string;
  hasMissingConnection: boolean;
  messengerConnectionValue: string;
  missingConnectionResolution: MissingConnectionResolution;
  open: boolean;
  summary: string;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsConnectionDrawer({
  activeMessengerThread,
  connections,
  fallbackConnection,
  fallbackConnectionPrefix,
  hasMissingConnection,
  messengerConnectionValue,
  missingConnectionResolution,
  open,
  summary,
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
  onToggle,
}: ChatSettingsConnectionDrawerProps) {
  const fallbackConnectionProvider = fallbackConnection
    ? getProviderConnectionProviderOption(fallbackConnection.provider)
    : null;

  return (
    <ChatSettingsDrawer
      drawerId="connection"
      open={open}
      summary={summary}
      title="Connection"
      onToggle={onToggle}
    >
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
      {hasMissingConnection && (
        <ChatSettingsNotice
          actionLabel={missingConnectionResolution.actionLabel}
          onAction={() =>
            onResolveMissingConnection(missingConnectionResolution.connectionId)
          }
        >
          This thread points to a connection that is no longer saved. Choose
          another connection or clear the missing reference.
        </ChatSettingsNotice>
      )}
      {activeMessengerThread &&
        connections.length === 0 &&
        !hasMissingConnection && (
          <ChatSettingsNotice
            actionLabel="Create connection"
            onAction={onCreateConnection}
          >
            Create a connection before Messenger can generate replies.
          </ChatSettingsNotice>
        )}
    </ChatSettingsDrawer>
  );
}
