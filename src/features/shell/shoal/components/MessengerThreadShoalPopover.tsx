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
  const { actions, state } = popovers.messenger;

  if (!state.open) {
    return null;
  }

  return (
    <NewMessengerThreadPopover
      characterIds={state.characterIds}
      characters={characters}
      companionLabel={labels.getCompanionLabel(state.characterIds)}
      companionMenuOpen={state.companionMenuOpen}
      connectionId={state.connectionId}
      connections={connections}
      name={state.name}
      namePlaceholder={labels.getDraftCompanionName(state.characterIds)}
      personaId={state.personaId}
      personas={personas}
      onClose={actions.close}
      onCompanionMenuOpenChange={actions.setCompanionMenuOpen}
      onConnectionChange={actions.setConnectionId}
      onNameChange={actions.setName}
      onPersonaChange={actions.setPersonaId}
      onSubmit={actions.submit}
      onToggleCharacter={actions.toggleCharacter}
    />
  );
}
