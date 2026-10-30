import type { Action, Db, Driver, Module, Order, OrderStatus, Permissions, Purchase, Staff, Supplier } from '../types'

export const ZONES = ['مدينة نصر', 'مصر الجديدة', 'المعادي', 'التجمع الخامس', 'وسط البلد', 'الدقي', 'المهندسين', '6 أكتوبر', 'الجيزة', 'شبرا']
export const CATEGORIES = ['مواد غذائية', 'أدوات منزلية', 'منسوجات', 'إلكترونيات', 'منظفات']
export const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'العاشر من رمضان', 'المنصورة', 'طنطا']
export const VEHICLES = ['موتوسيكل', 'فان', 'ربع نقل', 'دراجة']
export const UNITS = ['كرتونة', 'شوال', 'بالة', 'بالتة', 'قطعة']

export const STATUS_ORDER: OrderStatus[] = ['unassigned', 'assigned', 'picked', 'delivered', 'failed']
export const STATUS_LABEL: Record<OrderStatus, string> = {
  unassigned: 'غير مسند',
  assigned: 'مسند',
  picked: 'تم الاستلام',
  delivered: 'تم التوصيل',
  failed: 'فشل التوصيل',
}

export const MODULES: { id: Module; label: string; actions: Action[] }[] = [
  { id: 'suppliers', label: 'الموردون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'purchases', label: 'المشتريات', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'drivers', label: 'المندوبون', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'orders', label: 'الطلبات', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reports', label: 'التقارير', actions: ['view', 'export'] },
]

export const emptyPermissions = (): Permissions => ({ suppliers: [], purchases: [], drivers: [], orders: [], reports: [] })
const crud: Action[] = ['view', 'create', 'edit', 'delete']

export const PRESETS: { label: string; permissions: Permissions }[] = [
  { label: 'المشتريات', permissions: { ...emptyPermissions(), suppliers: crud, purchases: crud, orders: ['view'] } },
  { label: 'التوزيع', permissions: { ...emptyPermissions(), purchases: ['view'], drivers: ['view', 'edit'], orders: crud } },
  { label: 'التقارير فقط', permissions: { ...emptyPermissions(), reports: ['view', 'export'] } },
  {
    label: 'كل الصلاحيات',
    permissions: { suppliers: crud, purchases: crud, drivers: crud, orders: crud, reports: ['view', 'export'] },
  },
]

export function can(user: Staff | null, module: Module, action: Action) {
  if (!user) return false
  return user.role === 'admin' || user.permissions[module].includes(action)
}

export interface OrderRow extends Order {
  purchase: Purchase
  supplier: Supplier
  driver: Driver | null
}

export function orderRows(db: Db): OrderRow[] {
  const purchases = new Map(db.purchases.map((p) => [p.id, p]))
  const suppliers = new Map(db.suppliers.map((s) => [s.id, s]))
  const drivers = new Map(db.drivers.map((d) => [d.id, d]))
  return db.orders.flatMap((o) => {
    const purchase = purchases.get(o.purchaseId)
    const supplier = purchase && suppliers.get(purchase.supplierId)
    if (!purchase || !supplier) return []
    return [{ ...o, purchase, supplier, driver: o.driverId ? drivers.get(o.driverId) ?? null : null }]
  })
}

export function groupByPurchase(orders: Order[]) {
  const map = new Map<string, Order[]>()
  for (const o of orders) {
    const list = map.get(o.purchaseId)
    if (list) list.push(o)
    else map.set(o.purchaseId, [o])
  }
  return map
}

export const sumQty = (orders: Order[]) => orders.reduce((n, o) => n + o.quantity, 0)

export type CutState = 'none' | 'part' | 'full'
export const CUT_LABEL: Record<CutState, string> = { none: 'لم تُقسَّم', part: 'مقسَّمة جزئيًا', full: 'مقسَّمة بالكامل' }
export function cutState(p: Purchase, orders: Order[]): CutState {
  const cut = sumQty(orders)
  return cut === 0 ? 'none' : cut >= p.quantity ? 'full' : 'part'
}

export function moveOrder(o: Order, status: OrderStatus, by: string, driverId?: string | null, note?: string): Order {
  return {
    ...o,
    status,
    driverId: driverId === undefined ? o.driverId : driverId,
    events: [...o.events, { at: Date.now(), status, by, note }],
  }
}

export function nextId(existing: { id: string }[], prefix: string, start: number) {
  const max = existing.reduce((m, e) => Math.max(m, Number(e.id.replace(/\D/g, '')) || 0), start)
  return `${prefix}${max + 1}`
}

export const pickedAt = (o: Order) => [...o.events].reverse().find((e) => e.status === 'picked')?.at ?? null
export const closedAt = (o: Order) =>
  [...o.events].reverse().find((e) => e.status === 'delivered' || e.status === 'failed')?.at ?? null
