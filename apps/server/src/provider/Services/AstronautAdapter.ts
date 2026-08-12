import { ServiceMap } from "effect";
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface AstronautAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "astronaut";
}

export class AstronautAdapter extends ServiceMap.Service<AstronautAdapter, AstronautAdapterShape>()(
  "synara/provider/Services/AstronautAdapter",
) {}
