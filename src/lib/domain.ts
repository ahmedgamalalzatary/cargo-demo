import type { Action, Db, Driver, Invoice, Module, Order, OrderItem, OrderStatus, Permissions, Staff, Supplier } from '../types'
import { fmtNum } from './format'

export const ZONES = ['مدينة نصر', 'مصر الجديدة', 'المعادي', 'التجمع الخامس', 'وسط البلد', 'الدقي', 'المهندسين', '6 أكتوبر', 'الجيزة', 'شبرا']
export const CATEGORIES = ['مواد غذائية', 'أدوات منزلية', 'منسوجات', 'إلكترونيات', 'منظفات']
export const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'العاشر من رمضان', 'المنصورة', 'طنطا']
export const SUPPLIER_STATES = [{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }]
export const VEHICLES = ['موتوسيكل', 'فان', 'ربع نقل', 'دراجة']

export const STATUS_ORDER: OrderStatus[] = ['unassigned', 'assigned', 'delivered', 'refunded']
export const STATUS_LABEL: Record<OrderStatus, string> = {
  unassigned: 'غير مسند',
  assigned: 'مع المندوب',
  delivered: 'تم التوصيل',
  refunded: 'مرتجع',
}
/** Orders a dispatcher may still hand to a (different) delivery man. */
export const ASSIGNABLE: OrderStatus[] = ['unassigned', 'assigned', 'refunded']

export type ReturnState = 'pending' | 'back' | 'missing'
export const RETURN_LABEL: Record<ReturnState, string> = { pending: 'بانتظار التأكيد', back: 'رجعت البضاعة', missing: 'لم ترجع البضاعة' }
export const returnState = (o: Order): ReturnState | null =>
  !o.refund ? null : o.refund.back === undefined ? 'pending' : o.refund.back ? 'back' : 'missing'

export const MODULES: { id: Module; label: string; actions: Action[] }[] = [
  { id: 'suppliers', label: 'الموردون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'stock', label: 'المخزون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'drivers', label: 'المندوبون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'orders', label: 'الطلبات والمرتجعات', actions: ['view', 'create', 'edit', 'delete'] },
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

export interface OrderRow extends Order {
  invoice: Invoice
  supplier: Supplier
  driver: Driver | null
  quantity: number
  goods: string
  /** What the delivery man collects from the client. */
  collect: number
}

export const unique = <T,>(list: T[]) => [...new Set(list)]
export const itemsQty = (items: OrderItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const orderQty = (o: Order) => itemsQty(o.items)
export const sumQty = (orders: Order[]) => orders.reduce((n, o) => n + orderQty(o), 0)
export const goodsText = (items: OrderItem[]) => items.map((i) => `${fmtNum(i.quantity)} × ${i.product}`).join('، ')

export function orderRows(db: Db): OrderRow[] {
  const suppliers = new Map(db.suppliers.map((s) => [s.id, s]))
  const drivers = new Map(db.drivers.map((d) => [d.id, d]))
  const invoices = new Map(db.invoices.map((p) => [p.id, p]))
  return db.orders.flatMap((o) => {
    const invoice = invoices.get(o.invoiceId)
    const supplier = invoice && suppliers.get(invoice.supplierId)
    if (!invoice || !supplier) return []
    return [{
      ...o,
      invoice,
      supplier,
      driver: o.driverId ? drivers.get(o.driverId) ?? null : null,
      quantity: orderQty(o),
      goods: goodsText(o.items),
      collect: o.price + o.fee,
    }]
  })
}

/** Total quantity of each product (by name and category) across a set of orders. */
export interface ProductTotal { key: string; product: string; category: string; quantity: number; delivered: number; refunded: number; open: number; orders: number }
export function productTotals(orders: Order[]): ProductTotal[] {
  const map = new Map<string, ProductTotal>()
  for (const o of orders) {
    for (const i of o.items) {
      const key = `${i.product.trim()}|${i.category}`
      const row = map.get(key) ?? { key, product: i.product.trim(), category: i.category, quantity: 0, delivered: 0, refunded: 0, open: 0, orders: 0 }
      row.quantity += i.quantity
      if (o.status === 'delivered') row.delivered += i.quantity
      else if (o.status === 'refunded') row.refunded += i.quantity
      else row.open += i.quantity
      row.orders++
      map.set(key, row)
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity)
}

export type StatusCounts = Record<OrderStatus, number>
export function statusCounts(orders: Order[]): StatusCounts {
  const c: StatusCounts = { unassigned: 0, assigned: 0, delivered: 0, refunded: 0 }
  for (const o of orders) c[o.status]++
  return c
}
/** Delivered share of closed orders, or null when none are closed yet. */
export const successRate = (delivered: number, refunded: number) => (delivered + refunded ? (delivered / (delivered + refunded)) * 100 : null)

export function moveOrder(o: Order, status: OrderStatus, by: string, driverId?: string | null, note?: string): Order {
  const concerned = driverId ?? o.driverId ?? undefined
  return {
    ...o,
    status,
    driverId: driverId === undefined ? o.driverId : driverId,
    /* Handing the order out again closes its earlier refund. The event log keeps it. */
    refund: status === 'refunded' ? o.refund : undefined,
    events: [...o.events, { at: Date.now(), status, by, note, driverId: concerned }],
  }
}

export function refundOrder(o: Order, by: string, reason: string): Order {
  const moved = moveOrder(o, 'refunded', by, undefined, reason)
  return { ...moved, refund: { reason, at: Date.now(), driverId: o.driverId ?? '' } }
}

export const NOTE_BACK = 'تم استلام المرتجع من المندوب'
export const NOTE_MISSING = 'لم يُرجع المندوب البضاعة'

/** Every refund an order has had, newest last. Only the last one can still be open, and only while the order is refunded. */
export interface RefundEvent { at: number; reason: string; driverId: string; state: ReturnState; current: boolean }
export function refundEvents(o: Order): RefundEvent[] {
  const out: RefundEvent[] = []
  o.events.forEach((e, i) => {
    if (e.status !== 'refunded' || o.events[i - 1]?.status === 'refunded') return
    let state: ReturnState = 'pending'
    for (let j = i + 1; j < o.events.length && o.events[j].status === 'refunded'; j++) {
      if (o.events[j].note === NOTE_BACK) state = 'back'
      else if (o.events[j].note === NOTE_MISSING) state = 'missing'
    }
    out.push({ at: e.at, reason: e.note ?? '', driverId: e.driverId ?? '', state, current: false })
  })
  if (o.status === 'refunded' && out.length) out[out.length - 1].current = true
  return out
}

export function confirmReturn(o: Order, by: string, back: boolean): Order {
  if (!o.refund) return o
  return {
    ...o,
    refund: { ...o.refund, back },
    events: [...o.events, { at: Date.now(), status: 'refunded', by, note: back ? NOTE_BACK : NOTE_MISSING, driverId: o.refund.driverId }],
  }
}

export function nextId(existing: { id: string }[], prefix: string, start: number) {
  const max = existing.reduce((m, e) => Math.max(m, Number(e.id.replace(/\D/g, '')) || 0), start)
  return `${prefix}${max + 1}`
}

export const emailTaken = (db: Db, email: string, exceptId?: string) =>
  !!email && [...db.staff, ...db.drivers].some((a) => a.email.toLowerCase() === email.toLowerCase() && a.id !== exceptId)

/** Closing events (delivered or refunded by the delivery man), oldest first. A reassigned order can have several. */
/* Return confirmations are logged as refunded events right after the refund, so only the first in a run counts. */
export const closings = (o: Order) =>
  o.events.filter((e, i) => e.status === 'delivered' || (e.status === 'refunded' && o.events[i - 1]?.status !== 'refunded'))
export const closedAt = (o: Order) => {
  const list = closings(o)
  return list.length ? list[list.length - 1].at : null
}
/** When the order was last handed to a delivery man before time `before`. */
export function assignedAt(o: Order, before = Infinity) {
  return [...o.events].reverse().find((e) => e.status === 'assigned' && e.at <= before)?.at ?? null
}
