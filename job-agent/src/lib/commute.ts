/** 通勤参照点：北京朝阳酒仙桥大山子社区（798/大山子附近） */
export const COMMUTE_HOME = {
  label: "北京朝阳酒仙桥大山子社区",
  lng: 116.4988,
  lat: 39.9842,
} as const;

export interface CommuteEstimate {
  homeLabel: string;
  workAddress: string;
  distanceKm: number;
  subwayMinutes: number;
  eBikeMinutes: number;
  method: "landmark" | "district" | "fallback";
  note?: string;
}

/** 北京常见地标/商圈坐标（用于地址关键词匹配） */
const BEIJING_LANDMARKS: { keyword: string; lng: number; lat: number }[] = [
  { keyword: "天元港中心", lng: 116.4562, lat: 39.9558 },
  { keyword: "三元桥", lng: 116.4565, lat: 39.9612 },
  { keyword: "望京", lng: 116.4815, lat: 39.9962 },
  { keyword: "国贸", lng: 116.4615, lat: 39.9093 },
  { keyword: "CBD", lng: 116.4605, lat: 39.9145 },
  { keyword: "中关村", lng: 116.3105, lat: 39.9834 },
  { keyword: "西二旗", lng: 116.3065, lat: 40.0534 },
  { keyword: "上地", lng: 116.3078, lat: 40.0305 },
  { keyword: "五道口", lng: 116.3375, lat: 39.9927 },
  { keyword: "三里屯", lng: 116.4545, lat: 39.9375 },
  { keyword: "亮马桥", lng: 116.4612, lat: 39.9495 },
  { keyword: "酒仙桥", lng: 116.4955, lat: 39.9785 },
  { keyword: "大山子", lng: 116.4985, lat: 39.9845 },
  { keyword: "798", lng: 116.4955, lat: 39.9848 },
  { keyword: "亦庄", lng: 116.5065, lat: 39.8065 },
  { keyword: "通州", lng: 116.6565, lat: 39.9095 },
  { keyword: "昌平", lng: 116.2315, lat: 40.2205 },
  { keyword: "顺义", lng: 116.6545, lat: 40.1305 },
  { keyword: "大兴", lng: 116.3415, lat: 39.7265 },
  { keyword: "丰台", lng: 116.2875, lat: 39.8585 },
  { keyword: "石景山", lng: 116.2225, lat: 39.9065 },
  { keyword: "海淀", lng: 116.2985, lat: 39.9595 },
  { keyword: "朝阳", lng: 116.4435, lat: 39.9215 },
  { keyword: "东城", lng: 116.4165, lat: 39.9285 },
  { keyword: "西城", lng: 116.3665, lat: 39.9155 },
];

const BEIJING_DISTRICTS: { keyword: string; lng: number; lat: number }[] = [
  { keyword: "朝阳区", lng: 116.4435, lat: 39.9215 },
  { keyword: "海淀区", lng: 116.2985, lat: 39.9595 },
  { keyword: "东城区", lng: 116.4165, lat: 39.9285 },
  { keyword: "西城区", lng: 116.3665, lat: 39.9155 },
  { keyword: "丰台区", lng: 116.2875, lat: 39.8585 },
  { keyword: "石景山区", lng: 116.2225, lat: 39.9065 },
  { keyword: "通州区", lng: 116.6565, lat: 39.9095 },
  { keyword: "昌平区", lng: 116.2315, lat: 40.2205 },
  { keyword: "大兴区", lng: 116.3415, lat: 39.7265 },
  { keyword: "顺义区", lng: 116.6545, lat: 40.1305 },
  { keyword: "房山区", lng: 116.1435, lat: 39.7355 },
  { keyword: "门头沟区", lng: 116.1025, lat: 39.9375 },
];

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 球面直线距离（公里） */
export function haversineKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number }
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** 道路距离约为直线距离的 1.35 倍（北京城区经验值） */
function roadDistanceKm(straightKm: number): number {
  return straightKm * 1.35;
}

function geocodeBeijingAddress(address: string): {
  lng: number;
  lat: number;
  method: CommuteEstimate["method"];
} {
  const normalized = address.replace(/\s+/g, "");

  for (const place of BEIJING_LANDMARKS) {
    if (normalized.includes(place.keyword)) {
      return { lng: place.lng, lat: place.lat, method: "landmark" };
    }
  }

  for (const district of BEIJING_DISTRICTS) {
    if (normalized.includes(district.keyword)) {
      return { lng: district.lng, lat: district.lat, method: "district" };
    }
  }

  if (/北京/.test(normalized)) {
    return { lng: 116.4074, lat: 39.9042, method: "fallback" };
  }

  return { lng: 116.4074, lat: 39.9042, method: "fallback" };
}

/**
 * 估算通勤时间（基于坐标距离 + 北京通勤经验系数）
 * - 地铁：含进出站、等车、换乘，等效约 22km/h
 * - 电动车：城区均速约 20km/h，含红绿灯与找位
 */
export function estimateCommute(workAddress: string): CommuteEstimate | null {
  const trimmed = workAddress.trim();
  if (!trimmed || trimmed.length < 4) return null;

  const dest = geocodeBeijingAddress(trimmed);
  const straightKm = haversineKm(COMMUTE_HOME, dest);
  const distanceKm = Math.round(roadDistanceKm(straightKm) * 10) / 10;

  // 同区域（<1.5km）特殊处理
  if (distanceKm < 1.5) {
    return {
      homeLabel: COMMUTE_HOME.label,
      workAddress: trimmed,
      distanceKm,
      subwayMinutes: 12,
      eBikeMinutes: 8,
      method: dest.method,
      note: "同区域短途",
    };
  }

  const subwayMinutes = Math.round(14 + (distanceKm / 22) * 60);
  const eBikeMinutes = Math.round(5 + (distanceKm / 20) * 60);

  const note =
    dest.method === "landmark"
      ? "基于地标坐标估算"
      : dest.method === "district"
        ? "基于区县中心估算，填写更详细地址会更准"
        : "未能精确匹配地址，结果为粗估";

  return {
    homeLabel: COMMUTE_HOME.label,
    workAddress: trimmed,
    distanceKm,
    subwayMinutes,
    eBikeMinutes,
    method: dest.method,
    note,
  };
}

export function formatCommuteMinutes(minutes: number): string {
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `约 ${h} 小时 ${m} 分钟` : `约 ${h} 小时`;
}
