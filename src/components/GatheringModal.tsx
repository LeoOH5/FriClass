"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Gathering {
  id: string;
  dong_code: string;
  status: "open" | "complete";
  created_by: string;
  note: string | null;
  meeting_at: string | null;
  created_at: string;
  participant_count: number;
  i_joined: boolean;
}

interface Message {
  id: string;
  gathering_id: string;
  user_uuid: string;
  message: string;
  created_at: string;
}

interface GatheringModalProps {
  dongCode: string;
  dongName: string;
  guName: string;
  onClose: () => void;
}

function getUserUUID(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("gamtwi_uuid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gamtwi_uuid", id);
  }
  return id;
}

type Tab = "gatherings" | "chat";

export default function GatheringModal({ dongCode, dongName, guName, onClose }: GatheringModalProps) {
  const [tab, setTab] = useState<Tab>("gatherings");
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formNote, setFormNote] = useState("");
  const [formMeetingAt, setFormMeetingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 채팅 상태
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userUUID = getUserUUID();

  const fetchGatherings = useCallback(async () => {
    try {
      const res = await fetch(`/api/gatherings?dong_code=${dongCode}`);
      if (!res.ok) throw new Error("불러오기 실패");
      const data = await res.json();
      setGatherings(data);
    } catch {
      setError("모임 정보를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [dongCode]);

  useEffect(() => {
    fetchGatherings();
  }, [fetchGatherings]);

  const fetchMessages = useCallback(async (gatheringId: string) => {
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/messages`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setChatError(d.error === "db_error" ? "채팅을 불러오지 못했어요. Supabase messages 테이블을 확인해주세요." : "채팅 로딩 실패");
        return;
      }
      setChatError(null);
      const data = await res.json();
      setMessages(data);
    } catch {
      setChatError("네트워크 오류");
    }
  }, []);

  useEffect(() => {
    if (tab !== "chat" || !selectedGatheringId) return;
    fetchMessages(selectedGatheringId);
    const interval = setInterval(() => fetchMessages(selectedGatheringId), 5000);
    return () => clearInterval(interval);
  }, [tab, selectedGatheringId, fetchMessages]);

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  const handleJoin = async (gatheringId: string) => {
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gathering_id: gatheringId, user_uuid: userUUID }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (d.error === "already_joined") return;
        throw new Error();
      }
      localStorage.setItem(`joined_${gatheringId}`, "1");
      await fetchGatherings();
    } catch {
      setError("참여 신청에 실패했어요.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/gatherings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dong_code: dongCode,
          created_by: userUUID,
          note: formNote || null,
          meeting_at: formMeetingAt || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "생성 실패");
      }
      setShowForm(false);
      setFormNote("");
      setFormMeetingAt("");
      await fetchGatherings();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "모임 생성에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (gatheringId: string) => {
    try {
      await fetch(`/api/gatherings/${gatheringId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete", user_uuid: userUUID }),
      });
      await fetchGatherings();
    } catch {
      setError("완료 처리에 실패했어요.");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?dong=${dongCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 실패 시 무시
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || !selectedGatheringId || sendingMsg) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/gatherings/${selectedGatheringId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_uuid: userUUID, message: msgInput.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setChatError(d.error === "db_error" ? "전송 실패. Supabase messages 테이블을 확인해주세요." : "전송 실패");
        return;
      }
      setChatError(null);
      setMsgInput("");
      await fetchMessages(selectedGatheringId);
    } catch {
      setChatError("네트워크 오류");
    } finally {
      setSendingMsg(false);
    }
  };

  const openGatherings = gatherings.filter((g) => g.status === "open");
  const doneGatherings = gatherings.filter((g) => g.status === "complete");

  const openChatFor = (gatheringId: string) => {
    setSelectedGatheringId(gatheringId);
    setMessages([]);
    setChatError(null);
    setTab("chat");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 드래그 핸들 (모바일) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            <div className="text-xs text-gray-400">{guName}</div>
            <h2 className="text-lg font-bold text-gray-900">{dongName} 감튀 모임</h2>
          </div>
          <div className="flex items-center gap-1 -mr-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="링크 공유"
            >
              {copied ? (
                <span className="text-green-600 font-medium">복사됨 ✓</span>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  공유
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-600 active:bg-gray-100 transition-colors"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 탭 (채팅 모드일 때만) */}
        {tab === "chat" && (
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab("gatherings")}
              className="flex items-center gap-1 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 모임 목록
            </button>
            <div className="flex-1 flex items-center justify-center text-sm font-medium text-amber-600 py-2.5">
              💬 채팅
            </div>
          </div>
        )}

        {/* 모임 목록 탭 */}
        {tab === "gatherings" && (
          <>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {error && (
                <div className="mb-3 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
              )}

              {loading ? (
                <div className="text-center text-gray-400 py-8">불러오는 중...</div>
              ) : openGatherings.length === 0 && !showForm ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">🍟</div>
                  <p className="text-gray-500 text-sm">아직 이 동에 모임이 없어요.</p>
                  <p className="text-gray-400 text-sm">첫 모임을 만들어보세요!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openGatherings.map((g) => {
                    const joined = !!localStorage.getItem(`joined_${g.id}`) || g.i_joined;
                    const isMine = g.created_by === userUUID;
                    return (
                      <div key={g.id} className="border border-amber-100 rounded-xl p-4 bg-amber-50">
                        {g.meeting_at && (
                          <div className="text-xs text-amber-600 font-medium mb-1">
                            📅 {new Date(g.meeting_at).toLocaleString("ko-KR", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                        )}
                        {g.note && <p className="text-sm text-gray-700 mb-2">{g.note}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              🙋 {g.participant_count}명 참여 중
                            </span>
                            <button
                              onClick={() => openChatFor(g.id)}
                              className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
                            >
                              💬 채팅
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {isMine && (
                              <button
                                onClick={() => handleComplete(g.id)}
                                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1"
                              >
                                완료
                              </button>
                            )}
                            <button
                              onClick={() => !joined && handleJoin(g.id)}
                              disabled={joined}
                              className={`text-xs rounded-lg px-3 py-1 font-medium transition-colors ${
                                joined
                                  ? "bg-gray-100 text-gray-400 cursor-default"
                                  : "bg-amber-400 hover:bg-amber-500 text-white"
                              }`}
                            >
                              {joined ? "참여 완료" : "나도 갈게요 🍟"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 새 모임 폼 */}
              {showForm && (
                <form onSubmit={handleCreate} className="mt-4 border border-amber-200 rounded-xl p-4 bg-white">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">새 모임 만들기</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">날짜/시간 (선택)</label>
                      <input
                        type="datetime-local"
                        value={formMeetingAt}
                        onChange={(e) => setFormMeetingAt(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">한줄 메모 (선택, 최대 200자)</label>
                      <input
                        type="text"
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value.slice(0, 200))}
                        placeholder="예) 저녁 7시 이후 가능한 분 환영"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 text-sm bg-amber-400 hover:bg-amber-500 text-white rounded-lg py-2 font-medium disabled:opacity-50"
                      >
                        {submitting ? "등록 중..." : "모임 등록"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* 완료된 모임 */}
              {doneGatherings.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">완료된 모임 {doneGatherings.length}개</p>
                  {doneGatherings.slice(0, 3).map((g) => (
                    <div key={g.id} className="text-xs text-gray-400 py-1 border-b border-gray-50 last:border-0">
                      ✅ {g.note || "모임 완료"} · {g.participant_count}명
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 버튼 */}
            {!showForm && (
              <div
                className="px-5 pt-4 border-t border-gray-100"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full bg-amber-400 active:bg-amber-500 text-white font-semibold rounded-xl py-3.5 transition-colors min-h-[52px]"
                >
                  🍟 새 모임 만들기
                </button>
              </div>
            )}
          </>
        )}

        {/* 채팅 탭 */}
        {tab === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {chatError && (
                <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{chatError}</div>
              )}
              {!chatError && messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  아직 메시지가 없어요. 첫 메시지를 남겨보세요!
                </div>
              )}
              {messages.map((m) => {
                const isMe = m.user_uuid === userUUID;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        isMe
                          ? "bg-amber-400 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}
                    >
                      {m.message}
                      <div className={`text-[10px] mt-0.5 ${isMe ? "text-amber-100" : "text-gray-400"}`}>
                        {new Date(m.created_at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 px-4 pt-3 border-t border-gray-100"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value.slice(0, 500))}
                placeholder="메시지 입력..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-gray-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!msgInput.trim() || sendingMsg}
                className="flex items-center justify-center w-10 h-10 bg-amber-400 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
                aria-label="보내기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
