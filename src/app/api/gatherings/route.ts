import { NextRequest, NextResponse } from "next/server";
import { getGatheringsByDong, createGathering } from "@/lib/store";

export async function GET(req: NextRequest) {
  const dongCode = req.nextUrl.searchParams.get("dong_code");
  if (!dongCode) {
    return NextResponse.json({ error: "dong_code required" }, { status: 400 });
  }
  try {
    const gatherings = await getGatheringsByDong(dongCode);
    return NextResponse.json(gatherings);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dong_code, created_by, note, meeting_at } = body;
    if (!dong_code || !created_by) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    const gathering = await createGathering({ dong_code, created_by, note, meeting_at });
    return NextResponse.json(gathering, { status: 201 });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
