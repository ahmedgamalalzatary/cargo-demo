import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Invoice, Order } from '../types'
import { useStore } from '../store'
import { STATUS_LABEL, nextId, productTotals, unique } from '../lib/domain'
import { ORDERS, fmtCount, fmtMoney, fmtNum, toDateInput } from '../lib/format'
import { Button, Drawer, Field, IconButton } from './ui'
import { OrderFields } from './OrderFields'
import { checkDraft, draftFields, draftOf, type Errors, type OrderDraft } from '../lib/orderDraft'
import { SupplierForm } from './SupplierForm'

/* A supplier's purchase invoice is a batch of client orders, each with its own products, price and address. */
export function InvoiceForm({ item, onClose }: { item?: Invoice; onClose: () => void }) {
  const { db, setDb, user, toast } = useStore()
  const existing = useMemo(() => (item ? db.orders.filter((o) => o.invoiceId === item.id) : []), [db.orders, item])
  const [v, setV] = useState({ supplierId: item?.supplierId ?? '', date: toDateInput(item?.date ?? Date.now()), note: item?.note ?? '' })
  const category = db.suppliers.find((s) => s.id === v.supplierId)?.category ?? ''
  const [drafts, setDrafts] = useState<OrderDraft[]>(() => (existing.length ? existing.map((o, k) => draftOf(o, k)) : [draftOf(undefined, 0, category)]))
  const [errors, setErrors] = useState<Errors>({})
  const [addingSupplier, setAddingSupplier] = useState(false)
  const products = useMemo(() => unique(db.orders.flatMap((o) => o.items.map((i) => i.product))).sort(), [db.orders])
  const suppliers = db.suppliers.filter((s) => s.active || s.id === item?.supplierId)
  const byId = new Map(existing.map((o) => [o.id, o]))

  const parsed = drafts.map(draftFields)
  const totals = productTotals(parsed.map((f) => ({ ...f, status: 'unassigned' }) as Order))
  const price = parsed.reduce((n, f) => n + (f.price || 0), 0)
  const fees = parsed.reduce((n, f) => n + (f.fee || 0), 0)

  const clearError = (keys: string[]) => setErrors((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, ''])) }))
  const setDraft = (next: OrderDraft) => setDrafts((list) => list.map((d) => (d.key === next.key ? next : d)))
  const addDraft = () => setDrafts((list) => [...list, draftOf(undefined, Math.max(-1, ...list.map((d) => d.key)) + 1, category)])
  /* Product rows still without a category take the supplier's own category. */
  const pickSupplier = (id: string, cat = db.suppliers.find((s) => s.id === id)?.category) => {
    setV((s) => ({ ...s, supplierId: id }))
    clearError(['supplierId'])
    if (cat) setDrafts((list) => list.map((d) => ({ ...d, items: d.items.map((i) => (i.category ? i : { ...i, category: cat })) })))
  }
  const closedOf = (d: OrderDraft) => {
    const o = d.id ? byId.get(d.id) : undefined
    return !!o && (o.status === 'delivered' || o.status === 'refunded')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    let err: Errors = {}
    if (!v.supplierId) err.supplierId = 'اختر المورد أو أضف موردًا جديدًا.'
    if (!v.date) err.date = 'أدخل تاريخ الفاتورة.'
    for (const d of drafts) err = { ...err, ...checkDraft(d, `o${d.key}-`) }
    setErrors(err)
    if (Object.values(err).some(Boolean) || !user) {
      document.querySelector('.field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    const date = new Date(`${v.date}T12:00:00`).getTime()
    const head = { supplierId: v.supplierId, date, note: v.note.trim() }
    const now = Date.now()
    setDb((d) => {
      const invoiceId = item?.id ?? nextId(d.invoices, 'INV-', 1000)
      const kept = new Set(drafts.flatMap((x) => (x.id ? [x.id] : [])))
      let pool = d.orders
      const created: Order[] = []
      for (const x of drafts) {
        if (x.id) continue
        const id = nextId(pool, 'ORD-', 20000)
        const o: Order = { id, invoiceId, ...draftFields(x), driverId: null, status: 'unassigned', createdAt: now, events: [{ at: now, status: 'unassigned', by: user.name }] }
        pool = [...pool, o]
        created.push(o)
      }
      const edited = new Map(drafts.flatMap((x) => (x.id ? [[x.id, draftFields(x)] as const] : [])))
      const orders = d.orders
        .filter((o) => o.invoiceId !== invoiceId || kept.has(o.id))
        .map((o) => {
          const f = edited.get(o.id)
          if (!f) return o
          const closed = o.status === 'delivered' || o.status === 'refunded'
          return { ...o, ...f, items: closed ? o.items : f.items }
        })
      return {
        ...d,
        invoices: item ? d.invoices.map((p) => (p.id === item.id ? { ...p, ...head } : p)) : [{ id: invoiceId, ...head }, ...d.invoices],
        orders: [...created, ...orders],
      }
    })
    toast(item ? `تم حفظ ${item.id}` : `تمت إضافة الفاتورة، ${fmtCount(drafts.length, ORDERS)}`)
    onClose()
  }

  return (
    <Drawer wide title={item ? `تعديل ${item.id}` : 'فاتورة شراء جديدة'} onClose={onClose}
      footer={<><span className="foot-total">{fmtCount(drafts.length, ORDERS)}، الإجمالي <b>{fmtMoney(price)}</b></span><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="invoice-form">{item ? 'حفظ الفاتورة' : 'إضافة الفاتورة'}</Button></>}>
      <form id="invoice-form" className="form-grid" onSubmit={submit} noValidate>
        <div className="supplier-pick">
          <Field label="المورد" error={errors.supplierId}>
            <select value={v.supplierId} onChange={(e) => pickSupplier(e.target.value)}>
              <option value="">اختر</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Button onClick={() => setAddingSupplier(true)} style={{ marginBottom: errors.supplierId ? 22 : 0 }}><Plus size={16} aria-hidden />مورد جديد</Button>
        </div>
        <Field label="تاريخ الفاتورة" error={errors.date}>
          <input type="date" value={v.date} onChange={(e) => { setV({ ...v, date: e.target.value }); clearError(['date']) }} />
        </Field>

        <div className="order-cards field-full">
          {drafts.map((d, n) => {
            const own = d.id ? byId.get(d.id) : undefined
            const removable = !own || own.status === 'unassigned'
            return (
              <section className="order-card" key={d.key} aria-label={`الطلب ${n + 1}`}>
                <header className="order-card-head">
                  <h3>الطلب {fmtNum(n + 1)}{own && <small>{own.id}، {STATUS_LABEL[own.status]}</small>}</h3>
                  <IconButton label={removable ? `حذف الطلب ${fmtNum(n + 1)}` : `الطلب ${fmtNum(n + 1)} خرج مع مندوب ولا يمكن حذفه من هنا`} disabled={drafts.length === 1 || !removable}
                    onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}><Trash2 size={16} /></IconButton>
                </header>
                <OrderFields draft={d} onChange={setDraft} errors={errors} clearError={clearError} prefix={`o${d.key}-`} products={products} goodsLocked={closedOf(d)} />
              </section>
            )
          })}
          <Button onClick={addDraft}><Plus size={16} aria-hidden />إضافة طلب آخر</Button>
        </div>

        <section className="invoice-summary field-full" aria-label="ملخص الفاتورة">
          <h3 className="totals-head">ملخص الفاتورة</h3>
          <div className="load-numbers">
            <p><b>{fmtNum(drafts.length)}</b> طلبات</p>
            <p><b>{fmtMoney(price)}</b> إجمالي سعر الطلبات</p>
            <p><b>{fmtMoney(fees)}</b> رسوم التوصيل</p>
            <p><b>{fmtNum(totals.reduce((n, t) => n + t.quantity, 0))}</b> قطعة</p>
          </div>
          {totals.some((t) => t.product) && (
            <ul className="totals">
              {totals.filter((t) => t.product).map((t) => <li key={t.key}><span>{t.product}<small>{t.category}</small></span><b>× {fmtNum(t.quantity)}</b></li>)}
            </ul>
          )}
        </section>

        <Field label="ملاحظة" full><textarea rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </form>
      {addingSupplier && (
        <SupplierForm onClose={() => setAddingSupplier(false)} onSaved={(id, cat) => {
          pickSupplier(id, cat)
          setAddingSupplier(false)
        }} />
      )}
    </Drawer>
  )
}
