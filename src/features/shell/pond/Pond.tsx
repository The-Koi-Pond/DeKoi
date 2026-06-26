import type { NavStorageState, NavViewState } from "../../navigation";
import {
  ClassicThread,
  type ClassicThreadNav,
  MessengerThread,
  type MessengerThreadNav,
} from "../../modes";
import { PondHome, type PondHomeNav } from "./PondHome";
import {
  CompanionsSurface,
  type CompanionsSurfaceNav,
  ConnectionsSurface,
  type ConnectionsSurfaceNav,
  LorebooksSurface,
  type LorebooksSurfaceNav,
  PersonasSurface,
  type PersonasSurfaceNav,
} from "../../catalog";
import "./Pond.css";

interface PondProps {
  nav: PondNav;
}

export type PondNav = Pick<
  NavStorageState,
  "messengerStorageMode" | "messengerStorageStatus"
> &
  Pick<NavViewState, "view"> &
  ClassicThreadNav &
  CompanionsSurfaceNav &
  ConnectionsSurfaceNav &
  LorebooksSurfaceNav &
  MessengerThreadNav &
  PersonasSurfaceNav &
  PondHomeNav;

export function Pond({ nav }: PondProps) {
  const inMessenger = nav.view.kind === "messenger";
  const inClassic = nav.view.kind === "classic";
  const inCompanions = nav.view.kind === "companions";
  const inConnections = nav.view.kind === "connections";
  const inPersonas = nav.view.kind === "personas";
  const inLorebooks = nav.view.kind === "lorebooks";
  const storagePhrase =
    nav.messengerStorageMode === "remote" &&
    nav.messengerStorageStatus !== "error"
      ? "through the remote runtime"
      : nav.messengerStorageMode === "desktop" &&
          nav.messengerStorageStatus !== "error"
        ? "through desktop host storage"
        : "only in this temporary session";
  // Thread views keep a contextual save/runtime banner; Pond home stays quiet.
  const banner = inMessenger
    ? `Reading the water — your Messenger thread is saved ${storagePhrase} as you swim.`
    : inClassic
      ? "Classic scene current — write the scene, then generate the next turn through the shared runtime."
      : null;

  // Catalog surfaces render their own banner — only show the pond banner for
  // pond home / messenger / classic views.
  if (inCompanions) return <CompanionsSurface nav={nav} />;
  if (inConnections) return <ConnectionsSurface nav={nav} />;
  if (inPersonas) return <PersonasSurface nav={nav} />;
  if (inLorebooks) {
    const key =
      nav.view.kind === "lorebooks"
        ? `${nav.view.lorebookId ?? "all"}:${nav.view.mode ?? "view"}`
        : "lorebooks";
    return <LorebooksSurface key={key} nav={nav} />;
  }

  return (
    <main className="pond">
      {banner && (
        <div className="pond-banner">
          <span className="ic" aria-hidden="true">
            ◇
          </span>{" "}
          {banner}
        </div>
      )}
      <div className="pond-inner">
        {inMessenger ? (
          <MessengerThread nav={nav} />
        ) : inClassic ? (
          <ClassicThread nav={nav} />
        ) : (
          <PondHome nav={nav} />
        )}
      </div>
    </main>
  );
}
