import { useMemo, useState, type FormEvent } from 'react'
import type { Invoice, Order } from '../types'
import { useStore } from '../store'
import { ASSIGNABLE, moveOrder, nextId, unique } from '../lib/domain'
import { fmtDate } from '../lib/format'
import { Button, Drawer, Field } from './ui'
import { OrderFields } from './OrderFields'
import { checkDraft, draftFields, draftOf, type Errors, type OrderDraft } from '../lib/orderDraft'

/* One order: edit an existing one, or add one to a purchase invoice. */
export function OrderForm({ order, invoice, onClose }: { order?: Order; invoice?: Invoice; onClose: () => void }) {
  const { db, setDb, user, toast } = useStore()
  const [invoiceId, setInvoiceId] = useState(order?.invoiceId ?? invoice?.id ?? '')
  const category = db.suppliers.find((s) => s.id === db.invoices.find((p) => p.id === invoiceId)?.supplierId)?.category ?? ''
  const [draft, setDraft] = useState<OrderDraft>(() => draftOf(order, 0, category))
  const [driverId, setDriverId] = useState(order?.driverId ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const products = useMemo(() => unique(db.orders.flatMap((o) => o.items.map((i) => i.product))).sort(), [db.orders])
  const names = new Map(db.suppliers.map((s) => [s.id, s.name]))
  const invoices = [...db.invoices].sort((a, b) => b.date - a.date)
  const closed = !!order && (order.status === 'delivered' || order.status === 'refunded')
  const locked = !!order && !ASSIGNABLE.includes(order.status)
  const drivers = db.drivers.filter((d) => d.active || d.id === order?.driverId)
  const clearError = (keys: string[]) => setErrors((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, ''])) }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err = checkDraft(draft, '')
    if (!invoiceId) err.invoiceId = 'اختر فاتورة الشراء.'
    setErrors(err)
    if (Object.values(err).some(Boolean) || !user) return
    const fields = draftFields(draft)
    const driver = db.drivers.find((d) => d.id === driverId)
    if (order) {
      setDb((d) => ({
        ...d,
        orders: d.orders.map((o) => {
          if (o.id !== order.id) return o
          const edited = { ...o, ...fields, items: closed ? o.items : fields.items, invoiceId }
          if (locked || (driverId || null) === o.driverId) return edited
          return driver
            ? moveOrder(edited, 'assigned', user.name, driver.id, `أُسند إلى ${driver.name}`)
            : moveOrder(edited, 'unassigned', user.name, null, 'أُزيل المندوب')
        }),
      }))
      toast(`تم حفظ ${order.id}`)
    } else {
      const now = Date.now()
      setDb((d) => {
        let created: Order = { id: nextId(d.orders, 'ORD-', 20000), invoiceId, ...fields, driverId: null, status: 'unassigned', createdAt: now, events: [{ at: now, status: 'unassigned', by: user.name }] }
        if (driver) created = moveOrder(created, 'assigned', user.name, driver.id, `أُسند إلى ${driver.name}`)
        return { ...d, orders: [created, ...d.orders] }
      })
      toast(driver ? `تم إنشاء الطلب وإسناده إلى ${driver.name}` : 'تم إنشاء الطلب')
    }
    onClose()
  }

  return (
    <Drawer wide title={order ? `تعديل ${order.id}` : 'طلب جديد'} onClose={onClose}
      footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="order-form">{order ? 'حفظ الطلب' : 'إنشاء الطلب'}</Button></>}>
      <form id="order-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="فاتورة الشراء" error={errors.invoiceId} full>
          <select value={invoiceId} disabled={!!invoice && !order} onChange={(e) => { setInvoiceId(e.target.value); clearError(['invoiceId']) }}>
            <option value="">اختر</option>
            {invoices.map((p) => <option key={p.id} value={p.id}>{p.id}، {names.get(p.supplierId)}، {fmtDate(p.date)}</option>)}
          </select>
        </Field>
        <div className="field-full">
          <OrderFields draft={draft} onChange={setDraft} errors={errors} clearError={clearError} prefix="" products={products} goodsLocked={closed} />
        </div>
        <Field label="المندوب" full hint={locked ? 'تم توصيل هذا الطلب، فلا يمكن تغيير المندوب.' : 'يخرج الطلب معه مباشرة، ثم يسجّل التوصيل أو المرتجع.'}>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} disabled={locked}>
            <option value="">لم يُسند بعد</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}، {d.zone}</option>)}
          </select>
        </Field>
      </form>
    </Drawer>
  )
}
