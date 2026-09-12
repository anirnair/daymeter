import type { AppClass } from "./types";

const BROWSER = /\b(chrome|chromium|firefox|safari|edge|brave|arc|vivaldi|opera|comet)\b/i;
const CHAT = /\b(grok|chatgpt|claude|gemini|discord|slack|telegram|signal|messages|zoom|teams)\b/i;
const SOCIAL = /\b(whatsapp|instagram|twitter|x\.com|facebook|messenger|reddit|tiktok|snapchat|linkedin|youtube)\b/i;
const FOOD = /\b(swiggy|zomato|doordash|ubereats|uber eats|grubhub)\b/i;
const SYSTEM =
  /\b(launcher|phonemanager|phone manager|finder|spotlight|settings|system settings|explorer|desktop|dock|coloros)\b/i;

export const CLASS_LABEL: Record<AppClass, string> = {
  browser: "browser",
  chat: "chat",
  social: "social",
  food: "food",
  system: "system",
  other: "app",
};

export const CLASS_ORDER: AppClass[] = ["browser", "chat", "social", "food", "system", "other"];

export function classifyApp(name: string): AppClass {
  const n = (name || "").trim();
  if (!n) return "other";
  if (BROWSER.test(n)) return "browser";
  if (SOCIAL.test(n) || n.includes("instagram") || n.includes("whatsapp")) return "social";
  if (FOOD.test(n) || n.includes("swiggy")) return "food";
  if (SYSTEM.test(n) || n.startsWith("com.android.launcher") || n.includes("phonemanager")) return "system";
  if (CHAT.test(n)) return "chat";
  return "other";
}

export function bandOf(hourFrac: number): "night" | "morning" | "afternoon" | "evening" {
  const h = ((hourFrac % 24) + 24) % 24;
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function halfHour(hourFrac: number): number {
  return Math.floor(hourFrac * 2) / 2;
}
