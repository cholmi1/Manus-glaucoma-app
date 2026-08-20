import { ENV } from "./_core/env";

const EYAK_LIST_ENDPOINT = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";

export type EyakMedicine = {
  name: string;
  company?: string;
  ingredient?: string;
  efficacy?: string;
  usage?: string;
  caution?: string;
};

export function hasEyakServiceKey() {
  return ENV.eyakServiceKey.trim().length > 0;
}

export function isEyakSearchEnabled() {
  return hasEyakServiceKey() && ENV.eyakProxyEnabled;
}

export async function fetchEyakRaw(params: Record<string, string>) {
  if (!hasEyakServiceKey()) throw new Error("e약은요 서비스 키가 설정되지 않았습니다.");
  const url = new URL(EYAK_LIST_ENDPOINT);
  url.searchParams.set("serviceKey", ENV.eyakServiceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("type", "json");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`e약은요 요청 실패 (${response.status})`);
  if (/SERVICE_KEY|AUTH|UNAUTHORIZED|인증키/i.test(body)) throw new Error("e약은요 서비스 키 인증에 실패했습니다.");
  return body;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim() : undefined;
}

export async function searchEyak(query: string): Promise<EyakMedicine[]> {
  if (!isEyakSearchEnabled()) throw new Error("e약은요 검색은 인증키 검증 후 활성화됩니다.");
  const raw = await fetchEyakRaw({ itemName: query });
  const parsed = JSON.parse(raw) as { body?: { items?: Array<Record<string, unknown>> | { item?: Array<Record<string, unknown>> } } };
  const items = Array.isArray(parsed.body?.items) ? parsed.body.items : parsed.body?.items?.item ?? [];
  return items.map(item => ({
    name: asText(item.itemName) ?? "이름 없음",
    company: asText(item.entpName),
    ingredient: asText(item.ingrName),
    efficacy: asText(item.efcyQesitm),
    usage: asText(item.useMethodQesitm),
    caution: asText(item.atpnWarnQesitm) ?? asText(item.atpnQesitm),
  }));
}
