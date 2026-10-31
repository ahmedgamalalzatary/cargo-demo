import type { Action, Db, Driver, Invoice, InvoiceLine, Module, Order, OrderStatus, Permissions, Staff, Supplier } from '../types'
import { fmtQty } from './format'

export const ZONES = ['مدينة نصر', 'مصر الجديدة', 'المعادي', 'التجمع الخامس', 'وسط البلد', 'الدقي', 'المهندسين', '6 أكتوبر', 'الجيزة', 'شبرا']
export const CATEGORIES = ['مواد غذائية', 'أدوات منزلية', 'منسوجات', 'إلكترونيات', 'منظفات']
export const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'العاشر من رمضان', 'المنصورة', 'طنطا']
export const VEHICLES = ['موتوسيكل', 'فان', 'ربع نقل', 'دراجة']
export const UNITS = ['كرتونة', 'شوال', 'بالة', 'بالتة', 'قطعة']

export const STATUS_ORDER: OrderStatus[] = ['unassigned', 'assigned', 'accepted', 'denied', 'picked', 'delivered', 'failed']
export const STATUS_LABEL: Record<OrderStatus, string> = {
  unassigned: 'غير مسند',
  assigned: 'بانتظار رد المندوب',
  accepted: 'قبله المندوب',
  denied: 'رفضه المندوب',
  picked: 'تم الاستلام',
  delivered: 'تم التوصيل',
  failed: 'فشل التوصيل',
}
/** Orders a dispatcher may still hand to a (different) delivery man. */
export const ASSIGNABLE: OrderStatus[] = ['unassigned', 'assigned', 'accepted', 'denied', 'failed']

export const MODULES: { id: Module; label: string; actions: Action[] }[] = [
  { id: 'suppliers', label: 'الموردون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'stock', label: 'المخزون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'drivers', label: 'المندوبون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'orders', label: 'الطلبات', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reports', label: 'التقارير', actions: ['view', 'export'] },
]

export const emptyPermissions = (): Permissions => ({ suppliers: [], stock: [], drivers: [], orders: [], reports: [] })
const crud: Action[] = ['view', 'create', 'edit', 'delete']

export const PRESETS: { label: string; permissions: Permissions }[] = [
  { label: 'المخزون', permissions: { ...emptyPermissions(), suppliers: crud, stock: crud, orders: ['view'] } },
  { label: 'التوزيع', permissions: { ...emptyPermissions(), stock: ['view'], drivers: ['view', 'edit'], orders: crud } },
  { label: 'التقارير فقط', permissions: { ...emptyPermissions(), reports: ['view', 'export'] } },
  {
    label: 'كل الصلاحيات',
    permissions: { suppliers: crud, stock: crud, drivers: crud, orders: crud, reports: ['view', 'export'] },
  },
]

export function can(user: Staff | null, module: Module, action: Action) {
  if (!user) return false
  return user.role === 'admin' || user.permissions[module].includes(action)
}

export interface RowItem {
  line: InvoiceLine
  invoice: Invoice
  supplier: Supplier
  quantity: number
}

export interface OrderRow extends Order {
  rows: RowItem[]
  quantity: number
  cost: number
  goods: string
  suppliers: Supplier[]
  invoiceIds: string[]
  driver: Driver | null
}

export const unique = <T,>(list: T[]) => [...new Set(list)]
export const lineTotal = (l: InvoiceLine) => l.quantity * l.unitCost
export const invoiceQty = (p: Invoice) => p.lines.reduce((n, l) => n + l.quantity, 0)
export const invoiceCost = (p: Invoice) => p.lines.reduce((n, l) => n + lineTotal(l), 0)
export const invoiceProducts = (p: Invoice) => p.lines.map((l) => l.product).join('، ')
export const orderQty = (o: Order) => o.items.reduce((n, i) => n + i.quantity, 0)
export const sumQty = (orders: Order[]) => orders.reduce((n, o) => n + orderQty(o), 0)
export const goodsText = (rows: RowItem[]) => rows.map((r) => `${fmtQty(r.quantity, r.line.unit)} ${r.line.product}`).join('، ')

export function orderRows(db: Db): OrderRow[] {
  const suppliers = new Map(db.suppliers.map((s) => [s.id, s]))
  const drivers = new Map(db.drivers.map((d) => [d.id, d]))
  const lines = new Map(db.invoices.flatMap((invoice) => invoice.lines.map((line) => [line.id, { line, invoice }] as const)))
  return db.orders.flatMap((o) => {
    const rows = o.items.flatMap((item): RowItem[] => {
      const found = lines.get(item.lineId)
      const supplier = found && suppliers.get(found.invoice.supplierId)
      return found && supplier ? [{ ...found, supplier, quantity: item.quantity }] : []
    })
    if (!rows.length) return []
    return [{
      ...o,
      rows,
      quantity: rows.reduce((n, r) => n + r.quantity, 0),
      cost: rows.reduce((n, r) => n + r.quantity * r.line.unitCost, 0),
      goods: goodsText(rows),
      suppliers: unique(rows.map((r) => r.supplier)),
      invoiceIds: unique(rows.map((r) => r.invoice.id)),
      driver: o.driverId ? drivers.get(o.driverId) ?? null : null,
    }]
  })
}

/** How much of each invoice line is already promised to orders. */
export function allocations(orders: Order[], exceptOrder?: string) {
  const map = new Map<string, number>()
  for (const o of orders) {
    if (o.id === exceptOrder) continue
    for (const i of o.items) map.set(i.lineId, (map.get(i.lineId) ?? 0) + i.quantity)
  }
  return map
}

export interface Piece { id: string; status: OrderStatus; quantity: number }

/** Each order's share of a set of invoice lines, for drawing a cut bar. */
export function piecesOf(orders: Order[], lines: InvoiceLine[]): Piece[] {
  const ids = new Set(lines.map((l) => l.id))
  return orders.flatMap((o) => {
    const quantity = o.items.reduce((n, i) => (ids.has(i.lineId) ? n + i.quantity : n), 0)
    return quantity ? [{ id: o.id, status: o.status, quantity }] : []
  })
}

export type CutState = 'none' | 'part' | 'full'
export const CUT_LABEL: Record<CutState, string> = { none: 'لم تُقسَّم', part: 'مقسَّمة جزئيًا', full: 'مقسَّمة بالكامل' }
export function cutState(total: number, cut: number): CutState {
  return cut === 0 ? 'none' : cut >= total ? 'full' : 'part'
}

export function moveOrder(o: Order, status: OrderStatus, by: string, driverId?: string | null, note?: string): Order {
  const concerned = driverId ?? o.driverId ?? undefined
  return {
    ...o,
    status,
    driverId: driverId === undefined ? o.driverId : driverId,
    events: [...o.events, { at: Date.now(), status, by, note, driverId: concerned }],
  }
}

export function nextId(existing: { id: string }[], prefix: string, start: number) {
  const max = existing.reduce((m, e) => Math.max(m, Number(e.id.replace(/\D/g, '')) || 0), start)
  return `${prefix}${max + 1}`
}

export const emailTaken = (db: Db, email: string, exceptId?: string) =>
  !!email && [...db.staff, ...db.drivers].some((a) => a.email.toLowerCase() === email.toLowerCase() && a.id !== exceptId)

export const pickedAt = (o: Order) => [...o.events].reverse().find((e) => e.status === 'picked')?.at ?? null
export const closedAt = (o: Order) =>
  [...o.events].reverse().find((e) => e.status === 'delivered' || e.status === 'failed')?.at ?? null
