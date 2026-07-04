import { NextResponse } from "next/server";
import { iaStatus } from "@/lib/llmaas";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(iaStatus());
}
