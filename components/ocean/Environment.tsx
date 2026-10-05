import { Sky } from "./Sky";
import { Clouds } from "./Clouds";
import { Ocean } from "./Ocean";
import { Underwater } from "./Underwater";
import { Lighting } from "./Lighting";
import { Fish } from "./Fish";
import { Island } from "./Island";
import type { RefObject } from "react";
import type { SwimMotion } from "./SwimMotion";
import type { WaveState } from "./waves";

export function Environment({ motion, water }: { motion: SwimMotion; water: RefObject<WaveState> }) {
  return <><Sky /><Clouds motion={motion} /><Island motion={motion} /><Ocean water={water} motion={motion} /><Underwater water={water} motion={motion} /><Fish /><Lighting /></>;
}
