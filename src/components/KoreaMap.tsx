"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { geoMercator, geoContains } from "d3-geo";

type Level = "country" | "province" | "municipality";

interface GatheringCounts {
  [dongCode: string]: number;
}

interface KoreaMapProps {
  gatheringCounts?: GatheringCounts;
  onDongClick?: (dongCode: string, dongName: string, guName: string) => void;
  initialDong?: string;
}

interface ProvinceFeature {
  properties: { code: string; name: string };
}

interface MuniFeature {
  properties: { code: string; name: string };
}

interface GeoFeature {
  type: string;
  properties: { code: string; name: string };
  geometry: object;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

const KOREA_PROJECTION = {
  scale: 5500,
  center: [127.5, 36.0] as [number, number],
};

function fitToContainer(
  features: GeoFeature[],
  width: number,
  height: number
): { scale: number; center: [number, number] } {
  const padding = 48;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projection = (geoMercator() as any).fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    { type: "FeatureCollection", features }
  );
  const scale: number = projection.scale();
  const center = projection.invert([width / 2, height / 2]) as [
    number,
    number,
  ];
  return { scale, center };
}

export default function KoreaMap({
  gatheringCounts = {},
  onDongClick,
  initialDong,
}: KoreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<Level>("country");
  const [selectedProvince, setSelectedProvince] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [dongGeo, setDongGeo] = useState<GeoFeatureCollection | null>(null);
  const [muniGeo, setMuniGeo] = useState<GeoFeatureCollection | null>(null);
  const [projectionConfig, setProjectionConfig] = useState(KOREA_PROJECTION);
  const [hoveredInfo, setHoveredInfo] = useState<{ code: string; name: string } | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [provincesGeo, setProvincesGeo] = useState<GeoFeatureCollection | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/geo/provinces.json")
      .then((r) => r.json())
      .then(setProvincesGeo);
    fetch("/geo/municipalities.json")
      .then((r) => r.json())
      .then(setMuniGeo);
  }, []);

  useEffect(() => {
    if (!selectedMuni) return;
    setDongGeo(null);
    fetch(`/geo/dongs/${selectedMuni.code}.json`)
      .then((r) => r.json())
      .then(setDongGeo)
      .catch(() => setDongGeo(null));
  }, [selectedMuni]);

  // 동 GeoJSON 로드되면 해당 구만 꽉 차게 투영 조정
  useEffect(() => {
    if (!dongGeo || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setProjectionConfig(fitToContainer(dongGeo.features, width, height));
  }, [dongGeo]);

  const handleProvinceClick = useCallback(
    (geo: ProvinceFeature) => {
      if (!muniGeo || !containerRef.current) return;
      const { code, name } = geo.properties;
      const filtered = muniGeo.features.filter((f) =>
        f.properties.code.startsWith(code)
      );
      const { width, height } = containerRef.current.getBoundingClientRect();
      setSelectedProvince({ code, name });
      setSelectedMuni(null);
      setDongGeo(null);
      setLevel("province");
      setProjectionConfig(fitToContainer(filtered, width, height));
    },
    [muniGeo]
  );

  const handleMuniClick = useCallback(
    (geo: MuniFeature) => {
      if (
        !selectedProvince ||
        !geo.properties.code.startsWith(selectedProvince.code)
      )
        return;
      const { code, name } = geo.properties;

      setSelectedMuni({ code, name });
      setLevel("municipality");
    },
    [selectedProvince]
  );

  const handleDongClick = useCallback(
    (geo: { properties: { code: string; name: string } }) => {
      if (onDongClick && selectedMuni) {
        onDongClick(
          geo.properties.code,
          geo.properties.name,
          selectedMuni.name
        );
      }
    },
    [onDongClick, selectedMuni]
  );

  const handleBack = useCallback(() => {
    if (level === "municipality") {
      setLevel("province");
      setSelectedMuni(null);
      setDongGeo(null);
      if (selectedProvince && muniGeo && containerRef.current) {
        const filtered = muniGeo.features.filter((f) =>
          f.properties.code.startsWith(selectedProvince.code)
        );
        const { width, height } = containerRef.current.getBoundingClientRect();
        setProjectionConfig(fitToContainer(filtered, width, height));
      }
    } else if (level === "province") {
      setLevel("country");
      setSelectedProvince(null);
      setProjectionConfig(KOREA_PROJECTION);
    }
  }, [level, selectedProvince, muniGeo]);

  const handleLocate = useCallback(() => {
    if (!provincesGeo || !muniGeo || !containerRef.current) return;
    if (!navigator.geolocation) {
      setLocationError("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const { width, height } = containerRef.current!.getBoundingClientRect();

        // 시도 찾기
        const province = provincesGeo.features.find((f) => geoContains(f, pt));
        if (!province) {
          setLocating(false);
          setLocationError("대한민국 영역 안에 있지 않습니다.");
          return;
        }

        // 해당 시도의 시군구 필터링 후 줌
        const muniFeatures = muniGeo.features.filter((f) =>
          f.properties.code.startsWith(province.properties.code)
        );
        setSelectedProvince(province.properties);
        setSelectedMuni(null);
        setDongGeo(null);
        setLevel("province");
        setProjectionConfig(fitToContainer(muniFeatures, width, height));

        // 시군구 찾기
        const muni = muniFeatures.find((f) => geoContains(f, pt));
        if (muni) {
          setSelectedMuni(muni.properties);
          setLevel("municipality");
        }

        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("위치 권한이 거부되었습니다.");
        } else {
          setLocationError("위치를 가져올 수 없습니다.");
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [provincesGeo, muniGeo]);

  // 딥링크: initialDong이 있고 geo 데이터 준비되면 자동 드릴다운
  useEffect(() => {
    if (!initialDong || !provincesGeo || !muniGeo || !containerRef.current) return;
    if (level !== "country") return; // 이미 이동한 경우 재실행 방지

    const provinceCode = initialDong.slice(0, 2);
    const muniCode = initialDong.slice(0, 5);
    const { width, height } = containerRef.current.getBoundingClientRect();

    const province = provincesGeo.features.find(
      (f) => f.properties.code === provinceCode
    );
    if (!province) return;

    const muniFeatures = muniGeo.features.filter((f) =>
      f.properties.code.startsWith(provinceCode)
    );
    const muni = muniFeatures.find((f) => f.properties.code === muniCode);

    setSelectedProvince(province.properties);
    setSelectedMuni(null);
    setDongGeo(null);
    setLevel("province");
    setProjectionConfig(fitToContainer(muniFeatures, width, height));

    if (muni) {
      setSelectedMuni(muni.properties);
      setLevel("municipality");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDong, provincesGeo, muniGeo]);

  const getDongColor = (code: string) => {
    const count = gatheringCounts[code] ?? 0;
    if (count === 0) return "#d1fae5";
    if (count === 1) return "#fef3c7";
    if (count <= 3) return "#fcd34d";
    return "#f59e0b";
  };

  // 시군구는 모두 탐색 단계 — 동 단위에서 모임 수 표시
  const getMuniColor = (_code: string) => "#fde68a";

  const safeTop = { top: "max(1rem, env(safe-area-inset-top))" } as React.CSSProperties;
  const safeBottom = { bottom: "max(1rem, env(safe-area-inset-bottom))" } as React.CSSProperties;

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ touchAction: "manipulation" }}>
      {/* 뒤로가기 */}
      {level !== "country" && (
        <button
          onClick={handleBack}
          className="absolute left-4 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 shadow-sm active:bg-gray-100 transition-colors min-h-[44px]"
          style={safeTop}
        >
          ← {level === "province" ? "전국" : selectedProvince?.name}
        </button>
      )}

      {/* 현재 위치 */}
      <div
        className="absolute right-4 z-10 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 shadow-sm"
        style={safeTop}
      >
        {level === "country" && "대한민국"}
        {level === "province" && selectedProvince?.name}
        {level === "municipality" &&
          `${selectedProvince?.name} · ${selectedMuni?.name}`}
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={projectionConfig}
        style={{ width: "100%", height: "100%" }}
      >
        {/* 전국: 시도만 */}
        {level === "country" && (
          <Geographies geography="/geo/provinces.json">
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() =>
                    handleProvinceClick(geo as unknown as ProvinceFeature)
                  }
                  onMouseEnter={() =>
                    setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                  }
                  onMouseLeave={() => setHoveredInfo(null)}
                  onTouchStart={() =>
                    setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                  }
                  style={{
                    default: {
                      fill: "#d1d5db",
                      stroke: "#6b7280",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: "#fde68a",
                      stroke: "#d97706",
                      strokeWidth: 1,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: { fill: "#fbbf24", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
        )}

        {/* 시도 선택: 해당 시도의 시군구만 */}
        {level === "province" && muniGeo && (
          <Geographies geography={muniGeo}>
            {({ geographies }) =>
              geographies
                .filter((geo) =>
                  selectedProvince
                    ? (geo.properties.code as string).startsWith(selectedProvince.code)
                    : false
                )
                .map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() =>
                      handleMuniClick(geo as unknown as MuniFeature)
                    }
                    onMouseEnter={() =>
                      setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                    }
                    onMouseLeave={() => setHoveredInfo(null)}
                    onTouchStart={() =>
                      setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                    }
                    style={{
                      default: {
                        fill: getMuniColor(geo.properties.code as string),
                        stroke: "#d97706",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: "#fbbf24",
                        stroke: "#b45309",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: { fill: "#f59e0b", outline: "none" },
                    }}
                  />
                ))
            }
          </Geographies>
        )}

        {/* 시군구 선택: 해당 구의 동만 */}
        {level === "municipality" && dongGeo && (
          <Geographies geography={dongGeo}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() =>
                    handleDongClick(
                      geo as unknown as {
                        properties: { code: string; name: string };
                      }
                    )
                  }
                  onMouseEnter={() =>
                    setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                  }
                  onMouseLeave={() => setHoveredInfo(null)}
                  onTouchStart={() =>
                    setHoveredInfo({ code: geo.properties.code as string, name: geo.properties.name as string })
                  }
                  style={{
                    default: {
                      fill: getDongColor(geo.properties.code as string),
                      stroke: "#d97706",
                      strokeWidth: 0.2,
                      outline: "none",
                    },
                    hover: {
                      fill: "#fbbf24",
                      stroke: "#b45309",
                      strokeWidth: 0.4,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: { fill: "#f59e0b", outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
        )}
      </ComposableMap>

      {/* 동 로딩 중 */}
      {level === "municipality" && !dongGeo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg px-4 py-2 shadow text-sm text-gray-500">
            지도 불러오는 중...
          </div>
        </div>
      )}

      {/* 내 위치 버튼 */}
      <button
        onClick={handleLocate}
        disabled={locating}
        className="absolute right-4 z-10 flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 shadow-sm active:bg-gray-100 transition-colors min-h-[44px] disabled:opacity-50"
        style={{ bottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 3.5rem))" }}
        aria-label="내 위치로 이동"
      >
        {locating ? (
          <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        )}
        내 위치
      </button>

      {/* 위치 오류 메시지 */}
      {locationError && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700 shadow-sm whitespace-nowrap"
          style={{ bottom: "max(8rem, calc(env(safe-area-inset-bottom) + 7rem))" }}
        >
          {locationError}
          <button
            onClick={() => setLocationError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 범례 (접기 가능) */}
      <div className="absolute left-4 z-10" style={safeBottom}>
        {legendOpen ? (
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-xs text-gray-600 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">모임 수</span>
              <button
                onClick={() => setLegendOpen(false)}
                className="ml-4 text-gray-400 hover:text-gray-600 text-base leading-none"
                aria-label="범례 닫기"
              >
                ✕
              </button>
            </div>
            {(
              [
                { color: "#d1fae5", label: "없음" },
                { color: "#fef3c7", label: "1개" },
                { color: "#fcd34d", label: "2–3개" },
                { color: "#f59e0b", label: "4개+" },
              ] as const
            ).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 py-0.5">
                <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setLegendOpen(true)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 shadow-sm active:bg-gray-50 min-h-[36px]"
          >
            범례
          </button>
        )}
      </div>

      {/* 호버/터치 툴팁 */}
      {hoveredInfo && (
        <div
          className="absolute right-4 z-10 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm pointer-events-none"
          style={safeBottom}
        >
          <div className="font-medium text-gray-800">{hoveredInfo.name}</div>
          {level === "municipality" && dongGeo ? (
            <div className="text-gray-500 text-xs mt-0.5">
              모임 {gatheringCounts[hoveredInfo.code] ?? 0}개 · 탭해서 참여
            </div>
          ) : (
            <div className="text-gray-400 text-xs mt-0.5">탭해서 확대</div>
          )}
        </div>
      )}
    </div>
  );
}
