"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import GatheringModal from "@/components/GatheringModal";

const KoreaMap = dynamic(() => import("@/components/KoreaMap"), { ssr: false });

interface SelectedDong {
  code: string;
  name: string;
  guName: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gatheringCounts, setGatheringCounts] = useState<Record<string, number>>({});
  const [selectedDong, setSelectedDong] = useState<SelectedDong | null>(null);

  const initialDong = searchParams.get("dong") ?? undefined;

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/gatherings/counts");
      if (res.ok) {
        const data = await res.json();
        setGatheringCounts(data);
      }
    } catch {
      // 조용히 무시
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  const handleDongClick = (code: string, name: string, guName: string) => {
    router.replace(`/?dong=${code}`, { scroll: false });
    setSelectedDong({ code, name, guName });
  };

  return (
    <main className="flex flex-col h-dvh bg-amber-50">
      <header
        className="flex items-center justify-between px-5 py-3 bg-white border-b border-amber-100 shadow-sm z-20"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍟</span>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">감튀모임</h1>
            <p className="text-xs text-gray-400 leading-tight">내 동네 감자튀김 모임 지도</p>
          </div>
        </div>
        <div className="text-xs text-amber-600 bg-amber-50 rounded-full px-3 py-1 border border-amber-200">
          전국 {Object.values(gatheringCounts).reduce((a, b) => a + b, 0)}개 모임 진행 중
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <KoreaMap
          gatheringCounts={gatheringCounts}
          onDongClick={handleDongClick}
          initialDong={initialDong}
        />
      </div>

      {selectedDong && (
        <GatheringModal
          dongCode={selectedDong.code}
          dongName={selectedDong.name}
          guName={selectedDong.guName}
          onClose={() => {
            setSelectedDong(null);
            router.replace("/", { scroll: false });
            fetchCounts();
          }}
        />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
