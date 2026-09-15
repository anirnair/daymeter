import { classifyApp } from "./classify";
import type { AppClass, Intent } from "./types";

const MAKE =
  /\b(grok|chatgpt|claude|gemini|cursor|vscode|code|xcode|terminal|iterm|warp|notion|obsidian|linear|jira|figma|slack|zoom|teams|notes|mail|outlook|calendar)\b/i;
const CONSUME =
  /\b(instagram|whatsapp|twitter|facebook|messenger|reddit|tiktok|snapchat|linkedin|youtube|netflix|hotstar|spotify|prime|reel)\b/i;
const LIFE =
  /\b(swiggy|zomato|doordash|ubereats|uber eats|grubhub|maps|photos|camera|health|fitness|clock|weather|paytm|gpay|phonepe)\b/i;
const SYSTEM =
  /\b(launcher|phonemanager|phone manager|finder|spotlight|settings|system settings|explorer|desktop|dock|coloros)\b/i;

export const INTENT_LABEL: Record<Intent, string> = {
  make: "make",
  consume: "consume",
  life: "life",
  system: "system",
};

export const INTENT_ORDER: Intent[] = ["make", "consume", "life", "system"];

export function classifyIntent(name: string, cls?: AppClass, title?: string, url?: string): Intent {
  const hay = `${name} ${title ?? ""} ${url ?? ""}`.trim();
  if (!hay) return "system";
  if (CONSUME.test(hay) || hay.includes("instagram") || hay.includes("whatsapp") || hay.includes("youtube")) {
    return "consume";
  }
  if (LIFE.test(hay) || hay.includes("swiggy")) return "life";
  if (SYSTEM.test(hay) || name.startsWith("com.android.launcher") || hay.includes("phonemanager")) {
    return "system";
  }
  if (MAKE.test(hay)) return "make";
  const kind = cls ?? classifyApp(name);
  if (kind === "social") return "consume";
  if (kind === "food") return "life";
  if (kind === "system") return "system";
  if (kind === "chat" || kind === "browser" || kind === "other") return "make";
  return "system";
}
