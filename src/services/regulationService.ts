import Parser from "rss-parser";
import type { MarketKey } from "../types";

/* ------------------------------------------------------------------ *
 * 法规库「一键检查更新」服务层
 *
 * 流程：前端 -> 免费 CORS 代理 -> 目标网站 RSS -> rss-parser 解析 -> 展示
 * 由于浏览器同源策略，网页无法直接请求外部 RSS，必须借助代理。
 *
 * rss-parser（底层依赖 xml2js）在浏览器环境下会引用 Node 核心模块
 * （stream / util / events / timers / string_decoder / buffer / process），
 * 因此需在 vite.config.ts 中通过 vite-plugin-node-polyfills 注入 Node 垫片，
 * 才能通过浏览器打包。解析统一交由 rss-parser 完成（RSS 2.0 + Atom）。
 * ------------------------------------------------------------------ */

export interface RegionConfig {
  label: string;
  /** 该区域你关心的关键词，用于结果高亮 */
  keywords: string[];
  /** Google News RSS 搜索源 */
  rssFeeds: string[];
}

/** 区域配置（6 个区域），与 types.ts 的 MarketKey 对齐 */
export const REGION_CONFIG: Record<MarketKey, RegionConfig> = {
  north_america: {
    label: "北美",
    keywords: ["UL 484", "CSA", "DOE", "EPA", "Energy Star", "NRCan"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=UL+484+update&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=CSA+standard+air+conditioner&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  latin_america: {
    label: "中南美非",
    keywords: ["INMETRO", "NOM", "SEC", "IRAM", "PROCEL", "SONCAP", "KEBS", "NRCS"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=INMETRO+air+conditioner&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=NOM+Mexico+air+conditioner&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  europe_oceania: {
    label: "欧澳",
    keywords: ["CE", "RoHS", "REACH", "ErP", "F-gas", "RCM", "GEMS"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=EU+regulation+air+conditioner&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=CE+marking+update&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  middle_east_africa: {
    label: "中东非",
    keywords: ["SASO 2663", "SASO 2874", "G-mark", "SABER", "ESMA", "KEBS"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=SASO+2663+air+conditioner&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=Saudi+standards+air+conditioner&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  southeast_asia: {
    label: "东南亚",
    keywords: ["TISI", "SNI", "PSB", "SIRIM", "CB", "MEEPS"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=ASEAN+air+conditioner+regulation&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=SNI+Indonesia+air+conditioner&hl=en-US&gl=US&ceid=US:en",
    ],
  },
  china: {
    label: "中国",
    keywords: ["GB 4706.32", "CCC", "CQC", "China energy label", "CEC"],
    rssFeeds: [
      "https://news.google.com/rss/search?q=GB+4706.32+air+conditioner&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=China+CCC+certification+air+conditioner&hl=en-US&gl=US&ceid=US:en",
    ],
  },
};

export type RegionKey = MarketKey;

/** 区域选项（用于下拉选择） */
export const REGION_OPTIONS = Object.entries(REGION_CONFIG).map(([key, value]) => ({
  value: key,
  label: value.label,
}));

export interface RegulationNewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
}

export interface CheckUpdateResult {
  region: string;
  regionLabel: string;
  items: RegulationNewsItem[];
  checkedAt: string;
  hasUpdates: boolean;
  /** 该区域关心的关键词（用于高亮） */
  keywords: string[];
  error?: string;
}

/* 免费 CORS 代理（个人使用足够）。allorigins 返回的 JSON 含 contents 字段；
   corsproxy.io 直接返回 XML 文本，作为兜底提高可用性。 */
const PROXIES: Array<(feedUrl: string) => string> = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

const FETCH_TIMEOUT = 15000;

/* ------------------------------ RSS 解析 ------------------------------ */

let parserSingleton: Parser | null = null;
const getParser = (): Parser => (parserSingleton ??= new Parser());

/** 用 rss-parser 解析 RSS 2.0 与 Atom 字符串，返回前若干条新闻 */
const parseRssXml = async (xml: string, limit = 10): Promise<RegulationNewsItem[]> => {
  try {
    const feed = await getParser().parseString(xml);
    const items = feed.items ?? [];
    return items.slice(0, limit).map((it) => {
      const title = (it.title ?? "").trim() || "无标题";
      const link = it.link || "#";
      const pubDate = it.isoDate || it.pubDate || new Date().toISOString();
      const contentSnippet = it.contentSnippet ? it.contentSnippet.slice(0, 200) : "";
      return { title, link, pubDate, contentSnippet, source: "" };
    });
  } catch (err) {
    console.error("rss-parser 解析失败：", err);
    return [];
  }
};

/* ------------------------------ 抓取 ------------------------------ */

const fetchWithTimeout = async (url: string, ms: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** 抓取单个 RSS 源，依次尝试多个代理，返回标准化新闻条目 */
const fetchRSSFeed = async (feedUrl: string): Promise<RegulationNewsItem[]> => {
  for (const makeProxyUrl of PROXIES) {
    try {
      const proxyUrl = makeProxyUrl(feedUrl);
      const response = await fetchWithTimeout(proxyUrl, FETCH_TIMEOUT);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      let xml = "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        xml = data?.contents ?? "";
      } else {
        xml = await response.text();
      }
      if (!xml) continue;

      const items = (await parseRssXml(xml)).map((it) => ({ ...it, source: feedUrl }));
      if (items.length) return items;
    } catch (error) {
      console.error(`抓取 RSS 失败（代理重试中）: ${feedUrl}`, error);
    }
  }
  console.error(`抓取 RSS 失败: ${feedUrl}`);
  return [];
};

/* ------------------------------ 对外 API ------------------------------ */

/**
 * 检查指定区域的所有 RSS 源。
 * @param regionKey 区域键（MarketKey 或自定义区域字符串）
 * @param labelOverride 自定义区域时用于展示的标签
 */
export const checkRegionUpdates = async (
  regionKey: string,
  labelOverride?: string
): Promise<CheckUpdateResult> => {
  const config = (REGION_CONFIG as Record<string, RegionConfig>)[regionKey];
  const regionLabel = labelOverride ?? config?.label ?? regionKey;
  const feeds =
    config?.rssFeeds ??
    [`https://news.google.com/rss/search?q=${encodeURIComponent(
      `${String(regionKey)} air conditioner certification regulation`
    )}`];
  const keywords = config?.keywords ?? [];

  try {
    const results = await Promise.allSettled(feeds.map((f) => fetchRSSFeed(f)));
    const all: RegulationNewsItem[] = [];
    results.forEach((r) => {
      if (r.status === "fulfilled") all.push(...r.value);
    });

    const seen = new Set<string>();
    const unique = all.filter((it) => {
      const key = it.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      region: regionKey,
      regionLabel,
      items: unique,
      checkedAt: new Date().toISOString(),
      hasUpdates: unique.length > 0,
      keywords,
    };
  } catch (error) {
    return {
      region: regionKey,
      regionLabel,
      items: [],
      checkedAt: new Date().toISOString(),
      hasUpdates: false,
      keywords,
      error: "检查过程中发生错误，请稍后重试或手动访问官网确认。",
    };
  }
};

/** 一键检查所有内置区域 */
export const checkAllRegions = async (): Promise<CheckUpdateResult[]> => {
  const keys = Object.keys(REGION_CONFIG) as MarketKey[];
  return Promise.all(keys.map((k) => checkRegionUpdates(k)));
};

/** 按关键词过滤结果（用于高亮「相关内容」） */
export const filterByKeywords = (
  items: RegulationNewsItem[],
  keywords: string[]
): RegulationNewsItem[] => {
  if (!keywords.length) return items;
  const lower = keywords.map((k) => k.toLowerCase());
  return items.filter((it) => {
    const text = (it.title + " " + (it.contentSnippet || "")).toLowerCase();
    return lower.some((kw) => text.includes(kw));
  });
};
