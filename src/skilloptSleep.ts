import { invoke } from "@tauri-apps/api/core";
import type { SkillOptRunResult, SkillOptSleepStatus } from "./quackStore/types";

export type { SkillOptSleepStatus, SkillOptRunResult };

export const skilloptSleep = {
  status: () => invoke<SkillOptSleepStatus>("skillopt_sleep_status"),
  dryRun: () => invoke<SkillOptRunResult>("skillopt_sleep_dry_run"),
  adopt: () => invoke<SkillOptRunResult>("skillopt_sleep_adopt"),
};
