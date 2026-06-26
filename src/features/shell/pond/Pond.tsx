import type { NavViewState } from "../../navigation";
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
  NavViewState,
  "view"
> &
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
  const inThread = inMessenger || inClassic;
  const inCompanions = nav.view.kind === "companions";
  const inConnections = nav.view.kind === "connections";
  const inPersonas = nav.view.kind === "personas";
  const inLorebooks = nav.view.kind === "lorebooks";
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
    <main className={`pond${inThread ? " pond-thread-surface" : ""}`}>
      <div className={`pond-inner${inThread ? " pond-inner-thread" : ""}`}>
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
