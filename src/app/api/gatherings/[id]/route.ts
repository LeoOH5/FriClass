import { NextRequest, NextResponse } from "next/server";
import { updateGatheringStatus } from "@/lib/store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, user_uuid } = body;
    if (!status || !user_uuid) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    await updateGatheringStatus(id, status, user_uuid);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
