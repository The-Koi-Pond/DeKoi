import { PondEye } from "./PondEye";
import "./hero.css";

export function Hero() {
  return (
    <div className="hero">
      <PondEye />
      <h1>DeKoi</h1>
      <p className="sub">
        <span>The pond is calm.</span>
        <span>
          <b>Dive into a pool</b> below, or resume a koi already swimming.
        </span>
      </p>
    </div>
  );
}
