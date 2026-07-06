import type { SemseClient } from "../client.js";

export type SatelliteMe = {
  name: string;
  scopes: string[];
};

/** Introspección del propio satélite — smoke de conectividad (SAT-000 anillo 4). */
export class SatellitesResource {
  constructor(private readonly client: SemseClient) {}

  async me(): Promise<SatelliteMe> {
    return this.client.get<SatelliteMe>("/v1/satellites/me");
  }
}
