"use client";

import { SemseDigitalTwin } from "./digital-twin/SemseDigitalTwin";

export function SemseConsciousnessMap() {
  return (
    <main className="min-h-screen bg-[#050A12] p-3 text-[#E8EDF3] sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <SemseDigitalTwin variant="legacy" />
      </div>
    </main>
  );
}
