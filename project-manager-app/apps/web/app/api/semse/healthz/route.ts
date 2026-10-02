import { NextResponse } from "next/server";
import { getDeployProvenance } from "@semse/shared";

export async function GET() {
  const { gitSha, buildTime, deploymentId, environment, imageDigest } = getDeployProvenance();
  return NextResponse.json({
    data: {
      status: "ok",
      service: "semse-web",
      gitSha,
      buildTime,
      deploymentId,
      environment,
      imageDigest
    }
  });
}

