import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Invoice } from '../types'
import { useStore } from '../store'
import { UNITS, allocations, nextId, unique } from '../lib/domain'
import { fmtMoney, fmtNum, toDateInput } from '../lib/format'
import { Button, Drawer, Field, IconButton } from './ui'

interface Row { key: number; id?: string; product: string; quantity: string; unit: string; unitCost: string }
const blank = (key: number): Row => ({ key, product: '', quantity: '', unit: 'كرتونة', unitCost: '' })

export function InvoiceForm({ item, onClose }: { item?: Invoice; onClose: () => void }) {
  const { db, setDb, toast } = useStore()
  const [v, setV] = useState({ supplierId: item?.supplierId ?? '', date: toDateInput(item?.date ?? Date.now()), note: item?.note ?? '' })
  const [rows, setRows] = useState<Row[]>(() =>
    item ? item.lines.map((l, key) => ({ key, id: l.id, product: l.product, quantity: String(l.quantity), unit: l.unit, unitCost: String(l.unitCost) })) : [blank(0)])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const taken = useMemo(() => allocations(db.orders), [db.orders])
  const known = useMemo(() => unique(db.invoices.flatMap((p) => p.lines.map((l) => l.product))), [db.invoices])
  const suppliers = db.suppliers.filter((s) => s.active || s.id === item?.supplierId)
  const total = rows.reduce((n, r) => n + (+r.quantity || 0) * (+r.unitCost || 0), 0)

  const setRow = (key: number, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setErrors((s) => ({ ...s, ...Object.fromEntries(Object.keys(patch).map((k) => [`${k}${key}`, ''])) }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!v.supplierId) err.supplierId = 'اختر المورد.'
    if (!v.date) err.date = 'أدخل تاريخ الفاتورة.'
    for (const r of rows) {
      const cut = r.id ? taken.get(r.id) ?? 0 : 0
      if (!r.product.trim()) err[`product${r.key}`] = 'أدخل اسم الصنف.'
      if (!Number.isInteger(+r.quantity) || +r.quantity < 1) err[`quantity${r.key}`] = 'أدخل رقمًا صحيحًا 1 أو أكثر.'
      else if (+r.quantity < cut) err[`quantity${r.key}`] = `تم تقسيم ${fmtNum(cut)} بالفعل.`
      if (!(+r.unitCost > 0)) err[`unitCost${r.key}`] = 'أدخل التكلفة.'
    }
    setErrors(err)
    if (Object.keys(err).length) return

    const data = { supplierId: v.supplierId, date: new Date(`${v.date}T12:00:00`).getTime(), note: v.note.trim() }
    setDb((d) => {
      let pool = d.invoices.flatMap((p) => p.lines)
      const lines = rows.map((r) => {
        const id = r.id ?? nextId(pool, 'L-', 0)
        const line = { id, product: r.product.trim(), quantity: +r.quantity, unit: r.unit, unitCost: +r.unitCost }
        pool = [...pool, line]
        return line
      })
      return item
        ? { ...d, invoices: d.invoices.map((p) => (p.id === item.id ? { ...p, ...data, lines } : p)) }
        : { ...d, invoices: [{ id: nextId(d.invoices, 'INV-', 1000), ...data, lines }, ...d.invoices] }
    })
    toast(item ? `تم حفظ ${item.id}` : 'تمت إضافة الفاتورة إلى المخزون')
    onClose()
  }

  return (
    <Drawer wide title={item ? `تعديل ${item.id}` : 'فاتورة شراء جديدة'} onClose={onClose}
      footer={<><span className="foot-total">الإجمالي <b>{fmtMoney(total)}</b></span><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="invoice-form">{item ? 'حفظ الفاتورة' : 'إضافة الفاتورة'}</Button></>}>
      <form id="invoice-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="المورد" error={errors.supplierId}>
          <select value={v.supplierId} onChange={(e) => { setV({ ...v, supplierId: e.target.value }); setErrors((s) => ({ ...s, supplierId: '' })) }}>
            <option value="">اختر</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الفاتورة" error={errors.date}>
          <input type="date" value={v.date} onChange={(e) => { setV({ ...v, date: e.target.value }); setErrors((s) => ({ ...s, date: '' })) }} />
        </Field>

        <fieldset className="lines field-full">
          <legend>أصناف الفاتورة</legend>
          <datalist id="known-products">{known.map((p) => <option key={p} value={p} />)}</datalist>
          {rows.map((r, i) => {
            const cut = r.id ? taken.get(r.id) ?? 0 : 0
            return (
              <div className="line-row line-row-invoice" key={r.key}>
                <Field label={`الصنف ${fmtNum(i + 1)}`} error={errors[`product${r.key}`]}>
                  <input list="known-products" value={r.product} onChange={(e) => setRow(r.key, { product: e.target.value })} />
                </Field>
                <Field label="الكمية" error={errors[`quantity${r.key}`]}>
                  <input type="number" inputMode="numeric" min={Math.max(cut, 1)} value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })} />
                </Field>
                <Field label="الوحدة">
                  <select value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="تكلفة الوحدة" error={errors[`unitCost${r.key}`]}>
                  <input type="number" min={1} value={r.unitCost} onChange={(e) => setRow(r.key, { unitCost: e.target.value })} />
                </Field>
                <IconButton label={cut ? `الصنف ${fmtNum(i + 1)} مقسَّم إلى طلبات ولا يمكن حذفه` : `حذف الصنف ${fmtNum(i + 1)}`} disabled={rows.length === 1 || cut > 0}
                  onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}><Trash2 size={16} /></IconButton>
              </div>
            )
          })}
          <Button onClick={() => setRows((list) => [...list, blank(Math.max(...list.map((x) => x.key)) + 1)])}><Plus size={16} aria-hidden />إضافة صنف آخر</Button>
        </fieldset>

        <Field label="ملاحظة" full><textarea rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </form>
    </Drawer>
  )
}
