// Pulls profile details out of what a worker said during voice registration.
// Simple keyword rules (English, Roman Urdu and Urdu) — the worker reviews
// and edits everything before saving.
import type { Service } from "./api";

const SERVICE_WORDS: Record<string, RegExp> = {
  electrician: /electric|wiring|wire|bijli|switch|بجلی|الیکٹر|وائرنگ/i,
  plumber: /plumb|pipe|nalka|leak|tap|sanitary|پلمبر|نل|پائپ/i,
  carpenter: /carpent|wood|furniture|lakri|door|cabinet|بڑھئی|لکڑی|فرنیچر/i,
  "ac-tech": /\bac\b|a\.c|air ?condition|split|inverter|اے ?سی|ائیر کنڈیشن/i,
};

const SKILL_WORDS: [RegExp, string][] = [
  [/wiring|وائرنگ/i, "Wiring"],
  [/repair|marammat|مرمت/i, "Repair"],
  [/install|fitting|lagana|انسٹال/i, "Installation"],
  [/switch|سوئچ/i, "Switch Repair"],
  [/ups|inverter|solar|سولر/i, "UPS & Solar"],
  [/pipe|پائپ/i, "Pipe Fitting"],
  [/leak|لیک/i, "Leak Repair"],
  [/geyser|گیزر/i, "Geyser"],
  [/furniture|فرنیچر/i, "Furniture"],
  [/door|darwaza|دروازہ/i, "Doors"],
  [/kitchen|کچن/i, "Kitchen"],
  [/gas|refill|گیس/i, "AC Gas Refill"],
  [/service|servicing|سروس/i, "Servicing"],
];

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toLatinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(URDU_DIGITS.indexOf(d)));

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chay: 6, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

export type Extracted = {
  name?: string;
  serviceId?: number;
  years?: number;
  area?: string;
  skills: string[];
};

export function extractProfile(raw: string, services: Service[]): Extracted {
  const text = toLatinDigits(raw);
  const result: Extracted = { skills: [] };

  const name = text.match(
    /(?:my name is|i am|i'm|mera naam|naam|میرا نام)\s+([A-Za-z؀-ۿ]+(?:\s+[A-Za-z؀-ۿ]+)?)/i,
  );
  if (name) {
    const cleaned = name[1].replace(/\s+(hai|he|and|aur|ہے)$/i, "").trim();
    result.name = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  for (const service of services) {
    const rule = SERVICE_WORDS[service.slug];
    if (rule?.test(text)) {
      result.serviceId = service.id;
      break;
    }
  }

  const years =
    text.match(/(\d{1,2})\s*(?:\+\s*)?(?:years?|yrs?|saal|sal|سال)/i) ??
    text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaa?r|paa?nch|chay|chhe|saat|aath|nau|das)\s*(?:years?|saal|sal)/i);
  if (years) {
    const n = Number(years[1]);
    result.years = Number.isFinite(n) ? n : NUMBER_WORDS[years[1].toLowerCase()];
  }

  // Islamabad-style sectors (G-11, F-8, I-8/2) or "in <Place>"
  const sector = text.match(/\b([D-Id-i])\s*-?\s*(\d{1,2})(?:\s*\/\s*\d)?\b(?!\s*(?:years?|yrs?|saal|sal))/);
  if (sector) result.area = `${sector[1].toUpperCase()}-${sector[2]}`;

  for (const [rule, label] of SKILL_WORDS) {
    if (rule.test(text) && !result.skills.includes(label)) result.skills.push(label);
  }

  return result;
}
