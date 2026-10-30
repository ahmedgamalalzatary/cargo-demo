export interface Range {
  from: number
  to: number
}

export const PERIODS = [
  ['all', 'كل الأوقات'],
  ['today', 'اليوم'],
  ['yesterday', 'أمس'],
  ['7d', 'آخر 7 أيام'],
  ['30d', 'آخر 30 يومًا'],
  ['90d', 'آخر 90 يومًا'],
  ['month', 'هذا الشهر'],
  ['lastmonth', 'الشهر الماضي'],
  ['custom', 'تواريخ محددة'],
] as const

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)
const endOfDay = (t: number) => new Date(t).setHours(23, 59, 59, 999)
const DAY = 86400000

export function lastDays(n: number, now = Date.now()): Range {
  return { from: startOfDay(now - (n - 1) * DAY), to: endOfDay(now) }
}
export function dayRange(offset: number, now = Date.now()): Range {
  const t = now - offset * DAY
  return { from: startOfDay(t), to: endOfDay(t) }
}
export function monthRange(offset: number, now = Date.now()): Range {
  const d = new Date(now)
  return {
    from: new Date(d.getFullYear(), d.getMonth() - offset, 1).getTime(),
    to: new Date(d.getFullYear(), d.getMonth() - offset + 1, 0, 23, 59, 59, 999).getTime(),
  }
}

export function periodRange(period: string, from = '', to = ''): Range | null {
  switch (period) {
    case 'today': return dayRange(0)
    case 'yesterday': return dayRange(1)
    case '7d': return lastDays(7)
    case '30d': return lastDays(30)
    case '90d': return lastDays(90)
    case 'month': return monthRange(0)
    case 'lastmonth': return monthRange(1)
    case 'custom':
      if (!from && !to) return null
      return {
        from: from ? new Date(`${from}T00:00:00`).getTime() : 0,
        to: to ? new Date(`${to}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER,
      }
    default: return null
  }
}

export const inRange = (t: number, r: Range | null) => !r || (t >= r.from && t <= r.to)
