import { NextResponse } from "next/server";
import { getGatheringCounts } from "@/lib/store";

export async function GET() {
  try {
    const counts = await getGatheringCounts();
    return NextResponse.json(counts);
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
