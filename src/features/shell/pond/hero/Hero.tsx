import { PondEye } from "./PondEye";
import "./hero.css";

export function Hero() {
  return (
    <div className="hero">
      <PondEye />
      <div className="eyebrow">The Pond · character story engine</div>
      <h1>DeKoi</h1>
      <p className="sub">
        The pond is calm. <b>Dive into a pool</b> below, or resume a koi already
        swimming.
      </p>
    </div>
  );
}
