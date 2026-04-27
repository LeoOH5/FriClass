import { NextRequest, NextResponse } from "next/server";
import { joinGathering } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gathering_id, user_uuid } = body;
    if (!gathering_id || !user_uuid) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    await joinGathering(gathering_id, user_uuid);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "already_joined") {
      return NextResponse.json({ error: "already_joined" }, { status: 409 });
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
