const LOCALE = 'ar-EG-u-nu-latn'
const num = new Intl.NumberFormat(LOCALE)
const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const dayTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const short = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })

export const fmtNum = (n: number) => num.format(Math.round(n))
export const fmtMoney = (n: number) => `${num.format(Math.round(n))} ج.م`
export const fmtDate = (t: number) => day.format(t)
export const fmtDateTime = (t: number) => dayTime.format(t)
export const fmtShort = (t: number) => short.format(t)
export const fmtPct = (n: number) => `${Math.round(n)}%`

export function fmtDuration(ms: number) {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} دقيقة`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} س ${mins % 60} د`
  return `${Math.floor(h / 24)} يوم ${h % 24} س`
}

/* Arabic counted nouns: 2 has its own form, 3 to 10 take the plural, the rest the singular. */
export type Noun = [one: string, two: string, few: string]
export const ORDERS: Noun = ['طلب', 'طلبان', 'طلبات']
export const INVOICES: Noun = ['فاتورة', 'فاتورتان', 'فواتير']
export const PRODUCTS: Noun = ['صنف', 'صنفان', 'أصناف']
export const SUPPLIERS: Noun = ['مورد', 'موردان', 'موردين']
export const DRIVERS: Noun = ['مندوب', 'مندوبان', 'مندوبين']
export const REFUNDS: Noun = ['مرتجع', 'مرتجعان', 'مرتجعات']
export const ACCOUNTS: Noun = ['حساب', 'حسابان', 'حسابات']
export const FILTERS: Noun = ['فلتر', 'فلتران', 'فلاتر']
export function fmtCount(n: number, [one, two, few]: Noun) {
  if (n === 2) return two
  return `${fmtNum(n)} ${n >= 3 && n <= 10 ? few : one}`
}

export const toDateInput = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
