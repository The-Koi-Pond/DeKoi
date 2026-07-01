import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { NewThreadPopovers } from "../hooks/use-new-thread-popovers";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { NewMessengerThreadPopover } from "./NewMessengerThreadPopover";

interface MessengerThreadShoalPopoverProps {
  characters: ShoalNav["characters"];
  connections: ProviderConnectionRecord[];
  labels: NewThreadLabels;
  personas: ShoalNav["personas"];
  popovers: NewThreadPopovers;
}

export function MessengerThreadShoalPopover({
  characters,
  connections,
  labels,
  personas,
  popovers,
}: MessengerThreadShoalPopoverProps) {
  if (!popovers.newMessengerOpen) {
    return null;
  }

  return (
    <NewMessengerThreadPopover
      characterIds={popovers.newMessengerCharacterIds}
      characters={characters}
      companionLabel={labels.getCompanionLabel(
        popovers.newMessengerCharacterIds,
      )}
      companionMenuOpen={popovers.newMessengerCompanionMenuOpen}
      connectionId={popovers.newMessengerConnectionId}
      connections={connections}
      name={popovers.newMessengerName}
      namePlaceholder={labels.getDraftCompanionName(
        popovers.newMessengerCharacterIds,
      )}
      personaId={popovers.newMessengerPersonaId}
      personas={personas}
      onClose={popovers.closeNewMessengerThreadPopover}
      onCompanionMenuOpenChange={popovers.setNewMessengerCompanionMenuOpen}
      onConnectionChange={popovers.setNewMessengerConnectionId}
      onNameChange={(name) => {
        popovers.setNewMessengerName(name);
        popovers.setNewMessengerNameEdited(true);
      }}
      onPersonaChange={popovers.setNewMessengerPersonaId}
      onSubmit={popovers.handleCreateMessengerThread}
      onToggleCharacter={popovers.toggleNewMessengerCharacter}
    />
  );
}
