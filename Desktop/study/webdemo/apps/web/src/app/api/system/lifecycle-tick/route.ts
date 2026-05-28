import { NextResponse } from "next/server";
import { applyLifecyclePolicies } from "@/lib/server/device-runtime";

export async function POST() {
  const now = new Date().toISOString();
  applyLifecyclePolicies({ now });

  return NextResponse.json({
    ok: true,
    evaluatedAt: now
  });
}