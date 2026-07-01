import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { NewThreadPopovers } from "../hooks/use-new-thread-popovers";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { MessengerThreadShoalPopover } from "./MessengerThreadShoalPopover";
import { RoleplayThreadShoalPopover } from "./RoleplayThreadShoalPopover";

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
      {!isRoleplaySurface && (
        <MessengerThreadShoalPopover
          characters={characters}
          connections={connections}
          labels={labels}
          personas={personas}
          popovers={popovers}
        />
      )}
      {isRoleplaySurface && (
        <RoleplayThreadShoalPopover
          characters={characters}
          connections={connections}
          labels={labels}
          lorebooks={lorebooks}
          personas={personas}
          popovers={popovers}
        />
      )}
    </>
  );
}
