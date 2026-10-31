import type { Db, OrderStatus } from '../types'
import { STATUS_LABEL, ZONES, type OrderRow } from './domain'
import { dayRange, inRange, lastDays, monthRange, type Range } from './period'

/* Spelling variants of the same Arabic word should match: أ/إ/آ, ة/ه, ى/ي, tashkeel, Arabic-Indic digits. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

const bare = (word: string) => (word.length > 4 && word.startsWith('ال') ? word.slice(2) : word)

export function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

function close(token: string, word: string) {
  const a = bare(token), b = bare(word)
  if (a === b) return true
  if (/\d/.test(a)) return false
  const d = a.length >= 4 ? editDistance(a, b) : 3
  return d <= 1 || (a.length >= 7 && d <= 2)
}

const wordsOf = (text: string) => normalize(text).split(/[^\p{L}\p{N}-]+/u).filter(Boolean)

/** Every word must appear in the text. Longer words tolerate typos. */
export function matchesTerms(text: string, terms: string[]) {
  const hay = normalize(text)
  const words = wordsOf(text)
  return terms.every((t) => hay.includes(t) || words.some((w) => close(t, w)))
}

export const textSearch = (text: string, q: string) => {
  const terms = wordsOf(q)
  return terms.length === 0 || matchesTerms(text, terms)
}

export interface Parsed {
  status?: OrderStatus
  open?: boolean
  driverId?: string
  supplierId?: string
  zone?: string
  range?: Range
  min?: number
  max?: number
  terms: string[]
  chips: string[]
}

const STOP = new Set(['في', 'من', 'الي', 'علي', 'عن', 'مع', 'بتاع', 'بتاعه', 'مين', 'اللي', 'الذي', 'عند', 'طلب', 'طلبات', 'الطلب', 'الطلبات', 'مندوب', 'المندوب', 'مورد', 'المورد', 'عرض', 'اعرض', 'كل', 'و', 'ما', 'هو', 'هي', 'لل'])

/* JavaScript's \b does not see Arabic letters, so word edges are written out. */
const phrase = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'u')

/** Reads a plain-language query such as "فشل في الجيزة الأسبوع الماضي أكثر من 500". */
export function parseQuery(query: string, db: Db): Parsed {
  const out: Parsed = { terms: [], chips: [] }
  let s = ` ${normalize(query).trim()} `
  const take = (re: RegExp) => {
    const m = s.match(re)
    if (m) s = s.replace(re, ' ')
    return m
  }

  let m: RegExpMatchArray | null
  if (take(phrase('النهارده|اليوم'))) { out.range = dayRange(0); out.chips.push('اليوم') }
  else if (take(phrase('امبارح|امس'))) { out.range = dayRange(1); out.chips.push('أمس') }
  else if ((m = take(phrase('(?:اخر|احدث)\\s+(\\d+)\\s+(?:يوم|يوما|ايام)')))) { out.range = lastDays(+m[1]); out.chips.push(`آخر ${m[1]} يوم`) }
  else if (take(phrase('(?:هذا\\s+)?الاسبوع\\s+(?:الماضي|اللي\\s+فات)'))) { out.range = { from: lastDays(14).from, to: lastDays(7).from - 1 }; out.chips.push('الأسبوع الماضي') }
  else if (take(phrase('(?:هذا\\s+)?الاسبوع(?:\\s+ده)?'))) { out.range = lastDays(7); out.chips.push('آخر 7 أيام') }
  else if (take(phrase('الشهر\\s+(?:الماضي|اللي\\s+فات)'))) { out.range = monthRange(1); out.chips.push('الشهر الماضي') }
  else if (take(phrase('(?:هذا\\s+)?الشهر(?:\\s+ده)?'))) { out.range = monthRange(0); out.chips.push('هذا الشهر') }

  if ((m = s.match(/(?:اكثر من|اعلي من|فوق|>)\s*(\d+)/))) { s = s.replace(m[0], ' '); out.min = +m[1]; out.chips.push(`أكثر من ${m[1]} ج.م`) }
  if ((m = s.match(/(?:اقل من|تحت|<)\s*(\d+)/))) { s = s.replace(m[0], ' '); out.max = +m[1]; out.chips.push(`أقل من ${m[1]} ج.م`) }

  const statuses: [string, OrderStatus][] = [
    ['فشل(?:\\s+التوصيل)?|فاشل|فاشله|مرتجع|مرتجعه', 'failed'],
    ['غير\\s+مسند|غير\\s+مسنده|مش\\s+مسند|منتظر', 'unassigned'],
    ['تم\\s+الاستلام|استلام|استلم|استلمها|استلمه', 'picked'],
    ['تم\\s+التوصيل|توصيل|وصل|وصلت|اتوصل|مكتمل', 'delivered'],
    ['رفض|رفضه|مرفوض|مرفوضه', 'denied'],
    ['قبل|قبله|مقبول|مقبوله', 'accepted'],
    ['مسند|مسنده|بانتظار(?:\\s+الرد)?', 'assigned'],
  ]
  if (take(phrase('لم\\s+يصل|لم\\s+تصل|لسه\\s+موصلش|مفتوح|مفتوحه'))) { out.open = true; out.chips.push('لم يصل بعد') }
  else for (const [re, st] of statuses) {
    if (take(phrase(re))) { out.status = st; out.chips.push(STATUS_LABEL[st]); break }
  }

  for (const z of [...ZONES].sort((a, b) => b.length - a.length)) {
    const name = normalize(z)
    const alt = name.startsWith('ال') ? `|${name.slice(2)}` : ''
    if (take(phrase(name + alt))) { out.zone = z; out.chips.push(z); break }
  }

  const nameWords = (name: string) => wordsOf(name).filter((w) => w.length > 2)
  const productWords = new Set(db.invoices.flatMap((p) => p.lines.flatMap((l) => wordsOf(l.product))))
  for (const token of s.split(/\s+/).filter(Boolean)) {
    if (STOP.has(token)) continue
    if (productWords.has(token)) { out.terms.push(token); continue }
    const onDriver = out.driverId && nameWords(db.drivers.find((d) => d.id === out.driverId)?.name ?? '').some((w) => close(token, w))
    const onSupplier = out.supplierId && nameWords(db.suppliers.find((x) => x.id === out.supplierId)?.name ?? '').some((w) => close(token, w))
    if (onDriver || onSupplier) continue
    const driver = !out.driverId && db.drivers.find((d) => nameWords(d.name).some((w) => close(token, w)))
    if (driver) { out.driverId = driver.id; out.chips.push(driver.name); continue }
    const supplier = !out.supplierId && db.suppliers.find((x) => nameWords(x.name).some((w) => close(token, w)))
    if (supplier) { out.supplierId = supplier.id; out.chips.push(supplier.name); continue }
    out.terms.push(token)
  }
  if (out.terms.length) out.chips.push(`يحتوي على "${out.terms.join(' ')}"`)
  return out
}

export const orderText = (o: OrderRow) =>
  [o.id, ...o.invoiceIds, o.client, o.phone, o.address, o.zone, ...o.rows.map((r) => r.line.product), ...o.suppliers.map((s) => s.name), o.driver?.name ?? ''].join(' ')

export function matchesParsed(o: OrderRow, p: Parsed, at = o.createdAt) {
  if (p.status && o.status !== p.status) return false
  if (p.open && (o.status === 'delivered' || o.status === 'failed')) return false
  if (p.driverId && o.driverId !== p.driverId) return false
  if (p.supplierId && !o.suppliers.some((s) => s.id === p.supplierId)) return false
  if (p.zone && o.zone !== p.zone) return false
  if (p.min !== undefined && o.price <= p.min) return false
  if (p.max !== undefined && o.price >= p.max) return false
  if (p.range && !inRange(at, p.range)) return false
  return matchesTerms(orderText(o), p.terms)
}
