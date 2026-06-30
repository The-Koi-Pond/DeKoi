import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { NewThreadPopovers } from "../hooks/use-new-thread-popovers";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { NewMessengerThreadPopover } from "./NewMessengerThreadPopover";
import { NewRoleplayThreadPopover } from "./NewRoleplayThreadPopover";

interface ThreadShoalPopoversProps {
  characters: ShoalNav["characters"];
  connections: ProviderConnectionRecord[];
  isRoleplaySurface: boolean;
  labels: NewThreadLabels;
  lorebooks: ShoalNav["lorebooks"];
  personas: ShoalNav["personas"];
  popovers: NewThreadPopovers;
}

export function ThreadShoalPopovers({
  characters,
  connections,
  isRoleplaySurface,
  labels,
  lorebooks,
  personas,
  popovers,
}: ThreadShoalPopoversProps) {
  return (
    <>
      {!isRoleplaySurface && popovers.newMessengerOpen && (
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
      )}
      {isRoleplaySurface && popovers.newRoleplayOpen && (
        <NewRoleplayThreadPopover
          characterIds={popovers.newRoleplayCharacterIds}
          characters={characters}
          companionLabel={labels.getCompanionLabel(
            popovers.newRoleplayCharacterIds,
          )}
          companionMenuOpen={popovers.newRoleplayCompanionMenuOpen}
          connectionId={popovers.newRoleplayConnectionId}
          connections={connections}
          lorebookIds={popovers.newRoleplayLorebookIds}
          lorebookLabel={labels.getLorebookLabel(popovers.newRoleplayLorebookIds)}
          lorebookMenuOpen={popovers.newRoleplayLorebookMenuOpen}
          lorebooks={lorebooks}
          name={popovers.newRoleplayName}
          namePlaceholder={labels.getDraftRoleplayName(
            popovers.newRoleplayCharacterIds,
          )}
          personaId={popovers.newRoleplayPersonaId}
          personas={personas}
          onClose={popovers.closeNewRoleplayThreadPopover}
          onCompanionMenuOpenChange={popovers.setNewRoleplayCompanionMenuOpen}
          onConnectionChange={popovers.setNewRoleplayConnectionId}
          onLorebookMenuOpenChange={popovers.setNewRoleplayLorebookMenuOpen}
          onNameChange={(name) => {
            popovers.setNewRoleplayName(name);
            popovers.setNewRoleplayNameEdited(true);
          }}
          onPersonaChange={popovers.setNewRoleplayPersonaId}
          onSubmit={popovers.handleCreateRoleplayThread}
          onToggleCharacter={popovers.toggleNewRoleplayCharacter}
          onToggleLorebook={popovers.toggleNewRoleplayLorebook}
        />
      )}
    </>
  );
}
