import { NextRequest, NextResponse } from "next/server";
import { getMessages, sendMessage } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await getMessages(id);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { user_uuid, message } = body;
    if (!user_uuid || !message?.trim()) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ error: "too_long" }, { status: 400 });
    }
    const msg = await sendMessage(id, user_uuid, message.trim());
    return NextResponse.json(msg, { status: 201 });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
