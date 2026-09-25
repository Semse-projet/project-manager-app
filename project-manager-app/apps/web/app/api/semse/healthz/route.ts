import { NextResponse } from "next/server";
import { getDeployProvenance } from "@semse/shared";

export async function GET() {
  const { gitSha, buildTime } = getDeployProvenance();
  return NextResponse.json({
    data: {
      status: "ok",
      service: "semse-web",
      gitSha,
      buildTime
    }
  });
}

