import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const orgs = await prisma.organisation.findMany({
    orderBy: { nomHatvp: "asc" },
    select: { nomHatvp: true, numeroHatvp: true, secteur: true }
  });
  return NextResponse.json(orgs);
}
