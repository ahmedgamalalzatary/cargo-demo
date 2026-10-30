import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Order, Purchase } from '../types'
import { useStore } from '../store'
import { CUT_LABEL, UNITS, cutState, groupByPurchase, nextId, sumQty } from '../lib/domain'
import { ORDERS, PURCHASES, fmtCount, fmtDate, fmtMoney, fmtNum, fmtQty, toDateInput } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, FormDrawer, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col, type FieldSpec } from '../components/ui'
import { CutBar, StatusLegend } from '../components/CutBar'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', supplier: '', cut: '' }
type Row = Purchase & { supplierName: string; orders: Order[] }

export function usePurchaseFields(): FieldSpec[] {
  const { db } = useStore()
  return [
    { name: 'supplierId', label: 'المورد', type: 'select', required: true, full: true, options: db.suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name })) },
    { name: 'product', label: 'المنتج', required: true, full: true },
    { name: 'quantity', label: 'الكمية', type: 'number', required: true, min: 1 },
    { name: 'unit', label: 'الوحدة', type: 'select', required: true, options: UNITS.map((u) => ({ value: u, label: u })) },
    { name: 'unitCost', label: 'تكلفة الوحدة (ج.م)', type: 'number', required: true, min: 1 },
    { name: 'date', label: 'تاريخ الشراء', type: 'date', required: true },
    { name: 'note', label: 'ملاحظة', type: 'textarea', full: true },
  ]
}

export const purchaseValues = (p?: Purchase): Record<string, string> => ({
  supplierId: p?.supplierId ?? '',
  product: p?.product ?? '',
  quantity: p ? String(p.quantity) : '',
  unit: p?.unit ?? 'كرتونة',
  unitCost: p ? String(p.unitCost) : '',
  date: toDateInput(p?.date ?? Date.now()),
  note: p?.note ?? '',
})

export function Purchases() {
  const { db, setDb, can, toast } = useStore()
  const nav = useNavigate()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Purchase } | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const fields = usePurchaseFields()

  const rows = useMemo<Row[]>(() => {
    const range = periodRange(f.period, f.from, f.to)
    const names = new Map(db.suppliers.map((s) => [s.id, s.name]))
    const groups = groupByPurchase(db.orders)
    return db.purchases
      .map((p) => ({ ...p, supplierName: names.get(p.supplierId) ?? '', orders: groups.get(p.id) ?? [] }))
      .filter((p) =>
        inRange(p.date, range) &&
        (!f.supplier || p.supplierId === f.supplier) &&
        (!f.cut || cutState(p, p.orders) === f.cut) &&
        textSearch(`${p.id} ${p.product} ${p.supplierName} ${p.unit} ${p.note}`, f.q))
  }, [db, f])

  const save = (v: Record<string, string>) => {
    const data = { supplierId: v.supplierId, product: v.product.trim(), quantity: +v.quantity, unit: v.unit, unitCost: +v.unitCost, date: new Date(`${v.date}T12:00:00`).getTime(), note: v.note.trim() }
    if (form?.item) {
      const id = form.item.id
      setDb((d) => ({ ...d, purchases: d.purchases.map((p) => (p.id === id ? { ...p, ...data } : p)) }))
      toast(`تم حفظ ${id}`)
    } else {
      setDb((d) => ({ ...d, purchases: [{ id: nextId(d.purchases, 'PO-', 1000), ...data }, ...d.purchases] }))
      toast('تمت إضافة عملية الشراء')
    }
    setForm(null)
  }

  const canEdit = can('purchases', 'edit')
  const canDelete = can('purchases', 'delete')
  const cols: Col<Row>[] = [
    { key: 'id', label: 'عملية الشراء', render: (p) => <strong className="id">{p.id}</strong>, sort: (p) => p.id },
    { key: 'goods', label: 'البضاعة', render: (p) => <>{p.product}<small>{p.supplierName}</small></>, sort: (p) => p.product },
    {
      key: 'cut', label: 'التقسيم إلى طلبات', render: (p) => (
        <div className="cut-cell">
          <CutBar total={p.quantity} orders={p.orders} />
          <small>{fmtNum(sumQty(p.orders))} من {fmtQty(p.quantity, p.unit)}، {fmtCount(p.orders.length, ORDERS)}</small>
        </div>
      ), sort: (p) => sumQty(p.orders) / p.quantity,
    },
    { key: 'cost', label: 'التكلفة', right: true, render: (p) => fmtMoney(p.quantity * p.unitCost), sort: (p) => p.quantity * p.unitCost },
    { key: 'date', label: 'التاريخ', render: (p) => fmtDate(p.date), sort: (p) => p.date },
  ]
  if (canEdit || canDelete) {
    cols.push({
      key: 'actions', label: '', right: true, render: (p) => (
        <RowActions>
          {canEdit && <IconButton label={`تعديل ${p.id}`} onClick={() => setForm({ item: p })}><Pencil size={16} /></IconButton>}
          {canDelete && <IconButton label={`حذف ${p.id}`} onClick={() => setRemoving(p)}><Trash2 size={16} /></IconButton>}
        </RowActions>
      ),
    })
  }

  return (
    <>
      <PageHead title="المشتريات" count={`${fmtCount(rows.length, PURCHASES)}، بإجمالي ${fmtMoney(rows.reduce((n, p) => n + p.quantity * p.unitCost, 0))}`}>
        {can('purchases', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />إضافة عملية شراء</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث برقم العملية أو البضاعة أو المورد" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select label="التقسيم" all="أي مرحلة" value={f.cut} onChange={(cut) => set({ cut })} options={(['none', 'part', 'full'] as const).map((c) => ({ value: c, label: CUT_LABEL[c] }))} />
      </FilterBar>
      <StatusLegend uncut />
      <Table rows={rows} cols={cols} rowKey={(p) => p.id} onRow={(p) => nav(`/purchases/${p.id}`)} sort={{ key: 'date', dir: -1 }}
        empty={<><h2>لا توجد عمليات مطابقة</h2><p>غيّر البحث أو امسح الفلاتر لعرض عمليات أكثر.</p></>} />

      {form && (
        <FormDrawer title={form.item ? `تعديل ${form.item.id}` : 'إضافة عملية شراء'} action={form.item ? 'حفظ عملية الشراء' : 'إضافة عملية الشراء'} onClose={() => setForm(null)} onSave={save}
          initial={purchaseValues(form.item)}
          fields={fields.map((x) => x.name === 'quantity' && form.item ? { ...x, check: (v) => {
            const cut = sumQty(db.orders.filter((o) => o.purchaseId === form.item?.id))
            return +v < cut ? `تم تقسيم ${fmtNum(cut)} بالفعل إلى طلبات، فأدخل هذا الرقم على الأقل.` : undefined
          } } : x)} />
      )}
      {removing && (removing.orders.length > 0 ? (
        <Confirm title={`لا يمكن حذف ${removing.id}`} onClose={() => setRemoving(null)} body={`تم تقسيم ${fmtCount(removing.orders.length, ORDERS)} منها. احذف هذه الطلبات أولًا.`} />
      ) : (
        <Confirm title={`حذف ${removing.id}؟`} action="حذف عملية الشراء" body={`ستُحذف ${removing.product} من ${removing.supplierName}.`} onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, purchases: d.purchases.filter((p) => p.id !== removing.id) }))
            toast(`تم حذف ${removing.id}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
