import type { Order, OrderItem } from '../types'

export interface ItemDraft { key: number; product: string; category: string; quantity: string }
export interface OrderDraft {
  key: number
  id?: string
  code: string
  client: string
  phone: string
  address: string
  zone: string
  price: string
  fee: string
  items: ItemDraft[]
}
export type Errors = Record<string, string>

export const blankItem = (key: number, category = ''): ItemDraft => ({ key, product: '', category, quantity: '1' })

export function draftOf(o: Order | undefined, key: number, category = ''): OrderDraft {
  return o
    ? {
      key, id: o.id, code: o.code, client: o.client, phone: o.phone, address: o.address, zone: o.zone,
      price: String(o.price), fee: String(o.fee),
      items: o.items.map((i, k) => ({ key: k, product: i.product, category: i.category, quantity: String(i.quantity) })),
    }
    : { key, code: '', client: '', phone: '', address: '', zone: '', price: '', fee: '', items: [blankItem(0, category)] }
}

/** Error keys are `${prefix}${field}`, and `${prefix}${field}${itemKey}` for product rows. */
export function checkDraft(d: OrderDraft, prefix: string): Errors {
  const err: Errors = {}
  const seen = new Set<string>()
  for (const i of d.items) {
    const name = i.product.trim()
    if (!name) err[`${prefix}product${i.key}`] = 'أدخل اسم الصنف.'
    else if (seen.has(`${name}|${i.category}`)) err[`${prefix}product${i.key}`] = 'هذا الصنف مكرر في الطلب.'
    seen.add(`${name}|${i.category}`)
    if (!i.category) err[`${prefix}category${i.key}`] = 'اختر الفئة.'
    if (!Number.isInteger(+i.quantity) || +i.quantity < 1) err[`${prefix}quantity${i.key}`] = 'رقم صحيح 1 أو أكثر.'
  }
  if (!(+d.price > 0)) err[`${prefix}price`] = 'أدخل سعر الطلب.'
  if (d.fee.trim() === '' || Number.isNaN(+d.fee) || +d.fee < 0) err[`${prefix}fee`] = 'أدخل رسوم التوصيل (0 أو أكثر).'
  if (!d.client.trim()) err[`${prefix}client`] = 'أدخل اسم العميل.'
  if (!/^[0-9+\s-]{7,}$/.test(d.phone.trim())) err[`${prefix}phone`] = 'أدخل رقم هاتف من 7 أرقام على الأقل.'
  if (!d.address.trim()) err[`${prefix}address`] = 'أدخل عنوان التوصيل.'
  if (!d.zone) err[`${prefix}zone`] = 'اختر المنطقة.'
  return err
}

export function draftFields(d: OrderDraft) {
  const items: OrderItem[] = d.items.map((i) => ({ product: i.product.trim(), category: i.category, quantity: +i.quantity }))
  return { code: d.code.trim(), items, price: +d.price, fee: +d.fee, client: d.client.trim(), phone: d.phone.trim(), address: d.address.trim(), zone: d.zone }
}

