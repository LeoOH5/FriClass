import { supabase } from "./supabase";

export interface Gathering {
  id: string;
  dong_code: string;
  status: "open" | "complete";
  created_by: string;
  note: string | null;
  meeting_at: string | null;
  created_at: string;
}

export interface GatheringWithCount extends Gathering {
  participant_count: number;
  i_joined: boolean;
}

export interface Message {
  id: string;
  gathering_id: string;
  user_uuid: string;
  message: string;
  created_at: string;
}

export async function getGatheringsByDong(
  dongCode: string,
  userUUID?: string
): Promise<GatheringWithCount[]> {
  const { data, error } = await supabase
    .from("gatherings")
    .select(
      `*, participant_count:participants(count)`
    )
    .eq("dong_code", dongCode)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((g) => {
    const count =
      Array.isArray(g.participant_count) && g.participant_count.length > 0
        ? (g.participant_count[0] as { count: number }).count
        : 0;
    return {
      ...g,
      participant_count: count,
      i_joined: false,
    };
  });
}

export async function createGathering(params: {
  dong_code: string;
  created_by: string;
  note?: string | null;
  meeting_at?: string | null;
}): Promise<Gathering> {
  const { data, error } = await supabase
    .from("gatherings")
    .insert({
      dong_code: params.dong_code,
      created_by: params.created_by,
      note: params.note ?? null,
      meeting_at: params.meeting_at ?? null,
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGatheringStatus(
  id: string,
  status: "open" | "complete",
  userUUID: string
): Promise<void> {
  const { error } = await supabase
    .from("gatherings")
    .update({ status })
    .eq("id", id)
    .eq("created_by", userUUID);

  if (error) throw error;
}

export async function joinGathering(
  gatheringId: string,
  userUUID: string
): Promise<void> {
  const { error } = await supabase
    .from("participants")
    .insert({ gathering_id: gatheringId, user_uuid: userUUID });

  if (error) {
    if (error.code === "23505") throw new Error("already_joined");
    throw error;
  }
}

export async function getGatheringCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("gatherings")
    .select("dong_code")
    .eq("status", "open");

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.dong_code] = (counts[row.dong_code] ?? 0) + 1;
  }
  return counts;
}

export async function getMessages(gatheringId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  gatheringId: string,
  userUUID: string,
  message: string
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ gathering_id: gatheringId, user_uuid: userUUID, message })
    .select()
    .single();

  if (error) throw error;
  return data;
}
