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
  const { actions, state } = popovers.roleplay;

  if (!state.open) {
    return null;
  }

  return (
    <NewRoleplayThreadPopover
      characterIds={state.characterIds}
      characters={characters}
      companionLabel={labels.getCompanionLabel(state.characterIds)}
      companionMenuOpen={state.companionMenuOpen}
      connectionId={state.connectionId}
      connections={connections}
      lorebookIds={state.lorebookIds}
      lorebookLabel={labels.getLorebookLabel(state.lorebookIds)}
      lorebookMenuOpen={state.lorebookMenuOpen}
      lorebooks={lorebooks}
      name={state.name}
      namePlaceholder={labels.getDraftRoleplayName(state.characterIds)}
      personaId={state.personaId}
      personas={personas}
      onClose={actions.close}
      onCompanionMenuOpenChange={actions.setCompanionMenuOpen}
      onConnectionChange={actions.setConnectionId}
      onLorebookMenuOpenChange={actions.setLorebookMenuOpen}
      onNameChange={actions.setName}
      onPersonaChange={actions.setPersonaId}
      onSubmit={actions.submit}
      onToggleCharacter={actions.toggleCharacter}
      onToggleLorebook={actions.toggleLorebook}
    />
  );
}
