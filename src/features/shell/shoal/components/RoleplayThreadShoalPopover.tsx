import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { NewThreadPopovers } from "../hooks/use-new-thread-popovers";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { NewRoleplayThreadPopover } from "./NewRoleplayThreadPopover";

interface RoleplayThreadShoalPopoverProps {
  characters: ShoalNav["characters"];
  connections: ProviderConnectionRecord[];
  labels: NewThreadLabels;
  lorebooks: ShoalNav["lorebooks"];
  personas: ShoalNav["personas"];
  popovers: NewThreadPopovers;
}

export function RoleplayThreadShoalPopover({
  characters,
  connections,
  labels,
  lorebooks,
  personas,
  popovers,
}: RoleplayThreadShoalPopoverProps) {
  if (!popovers.newRoleplayOpen) {
    return null;
  }

  return (
    <NewRoleplayThreadPopover
      characterIds={popovers.newRoleplayCharacterIds}
      characters={characters}
      companionLabel={labels.getCompanionLabel(popovers.newRoleplayCharacterIds)}
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
  );
}
