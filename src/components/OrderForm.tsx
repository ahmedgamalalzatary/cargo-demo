import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Invoice, Order } from '../types'
import { useStore } from '../store'
import { ASSIGNABLE, ZONES, allocations, moveOrder, nextId } from '../lib/domain'
import { fmtMoney, fmtNum, fmtQty } from '../lib/format'
import { Button, Drawer, Field, IconButton } from './ui'

interface Row { key: number; lineId: string; quantity: string }

/* An order can carry any mix of products, from any invoice and any supplier. */
export function OrderForm({ order, invoice, onClose }: { order?: Order; invoice?: Invoice; onClose: () => void }) {
  const { db, setDb, user, toast } = useStore()
  const taken = useMemo(() => allocations(db.orders, order?.id), [db.orders, order?.id])
  const leftOf = (lineId: string, quantity: number) => quantity - (taken.get(lineId) ?? 0)
  const lines = useMemo(() => new Map(db.invoices.flatMap((p) => p.lines.map((l) => [l.id, { line: l, invoice: p }] as const))), [db.invoices])
  const groups = [...db.invoices].sort((a, b) => b.date - a.date)
    .map((p) => ({ invoice: p, lines: p.lines.filter((l) => leftOf(l.id, l.quantity) > 0 || order?.items.some((i) => i.lineId === l.id)) }))
    .filter((g) => g.lines.length > 0)

  const firstLine = invoice?.lines.find((l) => leftOf(l.id, l.quantity) > 0)?.id ?? ''
  const [rows, setRows] = useState<Row[]>(() =>
    order ? order.items.map((i, key) => ({ key, lineId: i.lineId, quantity: String(i.quantity) })) : [{ key: 0, lineId: firstLine, quantity: '' }])
  const [v, setV] = useState({
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
  const setRow = (key: number, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setErrors((s) => ({ ...s, [`line${key}`]: '', [`qty${key}`]: '' }))
  }

  const locked = !!order && !ASSIGNABLE.includes(order.status)
  const goodsLocked = !!order && (locked || order.status === 'failed')
  const drivers = db.drivers.filter((d) => d.active || d.id === order?.driverId)
  const cost = rows.reduce((n, r) => n + (lines.get(r.lineId)?.line.unitCost ?? 0) * (+r.quantity || 0), 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const seen = new Set<string>()
    for (const r of rows) {
      const found = lines.get(r.lineId)
      if (!found) { err[`line${r.key}`] = 'اختر صنفًا من المخزون.'; continue }
      if (seen.has(r.lineId)) err[`line${r.key}`] = 'هذا الصنف موجود بالفعل في الطلب.'
      seen.add(r.lineId)
      const left = leftOf(r.lineId, found.line.quantity)
      if (!Number.isInteger(+r.quantity) || +r.quantity < 1) err[`qty${r.key}`] = 'أدخل رقمًا صحيحًا 1 أو أكثر.'
      else if (+r.quantity > left) err[`qty${r.key}`] = `المتاح ${fmtNum(left)} فقط.`
    }
    if (!(+v.price > 0)) err.price = 'أدخل السعر الذي يدفعه العميل.'
    if (!v.client.trim()) err.client = 'أدخل اسم العميل.'
    if (!/^[0-9+\s-]{7,}$/.test(v.phone.trim())) err.phone = 'أدخل رقم هاتف من 7 أرقام على الأقل.'
    if (!v.address.trim()) err.address = 'أدخل عنوان التوصيل.'
    if (!v.zone) err.zone = 'اختر المنطقة.'
    setErrors(err)
    if (Object.keys(err).length || !user) return

    const driver = db.drivers.find((d) => d.id === v.driverId)
    const fields = {
      items: rows.map((r) => ({ lineId: r.lineId, quantity: +r.quantity })),
      price: +v.price, client: v.client.trim(), phone: v.phone.trim(), address: v.address.trim(), zone: v.zone,
    }
    if (order) {
      setDb((db) => ({
        ...db,
        orders: db.orders.map((o) => {
          if (o.id !== order.id) return o
          const edited = { ...o, ...fields }
          if (locked || (v.driverId || null) === o.driverId) return edited
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
      toast(driver ? `تم إنشاء الطلب وإرساله إلى ${driver.name}` : 'تم إنشاء الطلب')
    }
    onClose()
  }

  return (
    <Drawer wide title={order ? `تعديل ${order.id}` : 'طلب جديد'} onClose={onClose}
      footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="order-form">{order ? 'حفظ الطلب' : 'إنشاء الطلب'}</Button></>}>
      <form id="order-form" className="form-grid" onSubmit={submit} noValidate>
        <fieldset className="lines field-full">
          <legend>الأصناف في هذا الطلب</legend>
          {goodsLocked && <p className="field-hint">خرج هذا الطلب مع المندوب، فلا يمكن تغيير أصنافه.</p>}
          {rows.map((r, i) => {
            const found = lines.get(r.lineId)
            const left = found ? leftOf(r.lineId, found.line.quantity) : 0
            return (
              <div className="line-row line-row-order" key={r.key}>
                <Field label={`الصنف ${fmtNum(i + 1)}`} error={errors[`line${r.key}`]}>
                  <select value={r.lineId} disabled={goodsLocked} onChange={(e) => setRow(r.key, { lineId: e.target.value })}>
                    <option value="">اختر صنفًا</option>
                    {groups.map((g) => (
                      <optgroup key={g.invoice.id} label={g.invoice.id}>
                        {g.lines.map((l) => <option key={l.id} value={l.id}>{l.product}، متاح {fmtQty(leftOf(l.id, l.quantity), l.unit)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label={found ? `الكمية (${found.line.unit})` : 'الكمية'} error={errors[`qty${r.key}`]} hint={found && !goodsLocked ? `المتاح ${fmtNum(left)}` : undefined}>
                  <input type="number" inputMode="numeric" min={1} max={left || undefined} disabled={goodsLocked} value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })} />
                </Field>
                {!goodsLocked && (
                  <IconButton label={`حذف الصنف ${fmtNum(i + 1)}`} disabled={rows.length === 1} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}><Trash2 size={16} /></IconButton>
                )}
              </div>
            )
          })}
          {!goodsLocked && (
            <Button onClick={() => setRows((list) => [...list, { key: Math.max(...list.map((x) => x.key)) + 1, lineId: '', quantity: '' }])}><Plus size={16} aria-hidden />إضافة صنف آخر</Button>
          )}
        </fieldset>
        <Field label="سعر الطلب كله (ج.م)" error={errors.price} hint={cost > 0 ? `تكلفة هذه الأصناف: ${fmtMoney(cost)}` : undefined}>
          <input type="number" min={1} value={v.price} onChange={set('price')} />
        </Field>
        <Field label="العميل" error={errors.client}><input value={v.client} onChange={set('client')} /></Field>
        <Field label="هاتف العميل" error={errors.phone}><input type="tel" dir="ltr" value={v.phone} onChange={set('phone')} /></Field>
        <Field label="المنطقة" error={errors.zone}>
          <select value={v.zone} onChange={set('zone')}>
            <option value="">اختر</option>
            {ZONES.map((z) => <option key={z}>{z}</option>)}
          </select>
        </Field>
        <Field label="عنوان التوصيل" error={errors.address} full><input value={v.address} onChange={set('address')} /></Field>
        <Field label="المندوب" full hint={locked ? 'تم الاستلام بالفعل، فلا يمكن تغييره هنا.' : 'يصله الطلب ليقبله أو يرفضه. يمكنك الإسناد لاحقًا.'}>
          <select value={v.driverId} onChange={set('driverId')} disabled={locked}>
            <option value="">لم يُسند بعد</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}، {d.zone}</option>)}
          </select>
        </Field>
      </form>
    </Drawer>
  )
}
