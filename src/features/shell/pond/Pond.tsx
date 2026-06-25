import type { NavContextType } from "../../navigation";
import { ClassicThread } from "../../modes";
import { PondHome } from "./PondHome";
import { MessengerThread } from "../../modes";
import {
  CompanionsSurface,
  LorebooksSurface,
  PersonasSurface,
} from "../../catalog";
import "./Pond.css";

interface PondProps {
  nav: NavContextType;
}

export function Pond({ nav }: PondProps) {
  const inMessenger = nav.view.kind === "messenger";
  const inClassic = nav.view.kind === "classic";
  const inCompanions = nav.view.kind === "companions";
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
  // The banner copy is contextual: the "pick a koi" hint is for the Pond home;
  // once inside Messenger it would be misleading, so show a calmer status line.
  const banner = inMessenger
    ? `Reading the water — your Messenger thread is saved ${storagePhrase} as you swim.`
    : inClassic
      ? "Classic scene current — write the scene, then generate the next turn through the shared runtime."
      : "Cast a line to read the water — pick a koi from the Shoal to see its tracker.";

  // Catalog surfaces render their own banner — only show the pond banner for
  // pond home / messenger / classic views.
  if (inCompanions) return <CompanionsSurface />;
  if (inPersonas) return <PersonasSurface />;
  if (inLorebooks) {
    const key =
      nav.view.kind === "lorebooks"
        ? `${nav.view.lorebookId ?? "all"}:${nav.view.mode ?? "view"}`
        : "lorebooks";
    return <LorebooksSurface key={key} />;
  }

  return (
    <main className="pond">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">
          ◇
        </span>{" "}
        {banner}
      </div>
      <div className="pond-inner">
        {inMessenger ? (
          <MessengerThread />
        ) : inClassic ? (
          <ClassicThread />
        ) : (
          <PondHome nav={nav} />
        )}
      </div>
    </main>
  );
}
