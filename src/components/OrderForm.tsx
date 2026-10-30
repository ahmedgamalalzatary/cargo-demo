import { useMemo, useState, type FormEvent } from 'react'
import type { Order, Purchase } from '../types'
import { useStore } from '../store'
import { ZONES, groupByPurchase, moveOrder, nextId, sumQty } from '../lib/domain'
import { fmtMoney, fmtNum, fmtQty } from '../lib/format'
import { Button, Drawer, Field } from './ui'
import { CutBar } from './CutBar'

export function OrderForm({ order, purchase: fixed, onClose }: { order?: Order; purchase?: Purchase; onClose: () => void }) {
  const { db, setDb, user, toast } = useStore()
  const groups = useMemo(() => groupByPurchase(db.orders), [db.orders])
  const leftOf = (p: Purchase) => p.quantity - sumQty((groups.get(p.id) ?? []).filter((o) => o.id !== order?.id))
  const options = db.purchases.filter((p) => leftOf(p) > 0 || p.id === order?.purchaseId).sort((a, b) => b.date - a.date)
  const [v, setV] = useState({
    purchaseId: order?.purchaseId ?? fixed?.id ?? '',
    quantity: order ? String(order.quantity) : '',
    price: order ? String(order.price) : '',
    client: order?.client ?? '',
    phone: order?.phone ?? '',
    address: order?.address ?? '',
    zone: order?.zone ?? '',
    driverId: order?.driverId ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((s) => ({ ...s, [k]: e.target.value }))
    setErrors((s) => ({ ...s, [k]: '' }))
  }

  const purchase = db.purchases.find((p) => p.id === v.purchaseId)
  const others = purchase ? (groups.get(purchase.id) ?? []).filter((o) => o.id !== order?.id) : []
  const left = purchase ? leftOf(purchase) : 0
  const qty = Math.max(0, Math.min(+v.quantity || 0, left))
  const driverLocked = !!order && order.status !== 'unassigned' && order.status !== 'assigned'
  const drivers = db.drivers.filter((d) => d.active || d.id === order?.driverId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!purchase) err.purchaseId = 'اختر عملية الشراء المراد التقسيم منها.'
    if (!Number.isInteger(+v.quantity) || +v.quantity < 1) err.quantity = 'أدخل رقمًا صحيحًا 1 أو أكثر.'
    else if (purchase && +v.quantity > left) err.quantity = `المتبقي في عملية الشراء ${fmtNum(left)} فقط.`
    if (!(+v.price > 0)) err.price = 'أدخل السعر الذي يدفعه العميل.'
    if (!v.client.trim()) err.client = 'أدخل اسم العميل.'
    if (!/^[0-9+\s-]{7,}$/.test(v.phone.trim())) err.phone = 'أدخل رقم هاتف من 7 أرقام على الأقل.'
    if (!v.address.trim()) err.address = 'أدخل عنوان التوصيل.'
    if (!v.zone) err.zone = 'اختر المنطقة.'
    setErrors(err)
    if (Object.keys(err).length || !user || !purchase) return
    const driver = db.drivers.find((d) => d.id === v.driverId)
    const fields = { purchaseId: v.purchaseId, quantity: +v.quantity, price: +v.price, client: v.client.trim(), phone: v.phone.trim(), address: v.address.trim(), zone: v.zone }
    if (order) {
      setDb((db) => ({
        ...db,
        orders: db.orders.map((o) => {
          if (o.id !== order.id) return o
          const edited = { ...o, ...fields }
          if (driverLocked || (v.driverId || null) === o.driverId) return edited
          return driver
            ? moveOrder(edited, 'assigned', user.name, driver.id, `أُسند إلى ${driver.name}`)
            : moveOrder(edited, 'unassigned', user.name, null, 'أُزيل المندوب')
        }),
      }))
      toast(`تم حفظ ${order.id}`)
    } else {
      const now = Date.now()
      setDb((db) => {
        const id = nextId(db.orders, 'ORD-', 20000)
        let created: Order = { id, ...fields, driverId: null, status: 'unassigned', createdAt: now, events: [{ at: now, status: 'unassigned', by: user.name }] }
        if (driver) created = moveOrder(created, 'assigned', user.name, driver.id, `أُسند إلى ${driver.name}`)
        return { ...db, orders: [created, ...db.orders] }
      })
      toast(`تم تقسيم ${fmtQty(+v.quantity, purchase.unit)} من ${purchase.id}`)
    }
    onClose()
  }

  return (
    <Drawer title={order ? `تعديل ${order.id}` : 'تقسيم طلب جديد'} onClose={onClose}
      footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="order-form">{order ? 'حفظ الطلب' : 'تقسيم الطلب'}</Button></>}>
      <form id="order-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="عملية الشراء" error={errors.purchaseId} full>
          <select value={v.purchaseId} onChange={set('purchaseId')} disabled={!!fixed || !!order}>
            <option value="">اختر عملية شراء بها كمية متبقية</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.id}، {p.product}، متبقي {fmtQty(leftOf(p), p.unit)}</option>)}
          </select>
        </Field>
        {purchase && (
          <div className="field-full cut-preview">
            <CutBar total={purchase.quantity} orders={others} preview={qty} large />
            <p>سيتبقى {fmtNum(left - qty)} من {fmtQty(purchase.quantity, purchase.unit)} بعد هذا التقسيم</p>
          </div>
        )}
        <Field label={purchase ? `الكمية (${purchase.unit})` : 'الكمية'} error={errors.quantity}>
          <input type="number" inputMode="numeric" min={1} max={left || undefined} value={v.quantity} onChange={set('quantity')} />
        </Field>
        <Field label="السعر (ج.م)" error={errors.price} hint={purchase && qty > 0 ? `تكلفة هذه الكمية: ${fmtMoney(qty * purchase.unitCost)}` : undefined}>
          <input type="number" min={1} value={v.price} onChange={set('price')} />
        </Field>
        <Field label="العميل" error={errors.client}><input value={v.client} onChange={set('client')} /></Field>
        <Field label="هاتف العميل" error={errors.phone}><input type="tel" dir="ltr" value={v.phone} onChange={set('phone')} /></Field>
        <Field label="عنوان التوصيل" error={errors.address} full><input value={v.address} onChange={set('address')} /></Field>
        <Field label="المنطقة" error={errors.zone}>
          <select value={v.zone} onChange={set('zone')}>
            <option value="">اختر</option>
            {ZONES.map((z) => <option key={z}>{z}</option>)}
          </select>
        </Field>
        <Field label="المندوب" hint={driverLocked ? 'تم الاستلام بالفعل، فلا يمكن تغييره هنا.' : 'يمكنك الإسناد لاحقًا.'}>
          <select value={v.driverId} onChange={set('driverId')} disabled={driverLocked}>
            <option value="">لم يُسند بعد</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}، {d.zone}</option>)}
          </select>
        </Field>
      </form>
    </Drawer>
  )
}
