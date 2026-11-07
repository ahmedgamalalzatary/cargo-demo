import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Supplier } from '../types'
import { useStore } from '../store'
import { CATEGORIES, CITIES, SUPPLIER_STATES as STATES, successRate } from '../lib/domain'
import { SUPPLIERS, INVOICES, fmtCount, fmtMoney, fmtNum, fmtPct } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col } from '../components/ui'
import { SupplierForm } from '../components/SupplierForm'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', category: '', city: '', state: '' }
type Row = Supplier & { count: number; spend: number; orders: number; open: number; delivered: number; refunded: number; rate: number | null }
const list = (items: string[]) => items.map((x) => ({ value: x, label: x }))

export function Suppliers() {
  const { db, setDb, can, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Supplier } | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(() => {
    const range = periodRange(f.period, f.from, f.to)
    return db.suppliers
      .map((s) => {
        const bought = new Set(db.invoices.filter((p) => p.supplierId === s.id && inRange(p.date, range)).map((p) => p.id))
        const own = db.orders.filter((o) => bought.has(o.invoiceId))
        const delivered = own.filter((o) => o.status === 'delivered').length
        const refunded = own.filter((o) => o.status === 'refunded').length
        return { ...s, count: bought.size, spend: own.reduce((n, o) => n + o.price, 0), orders: own.length, open: own.length - delivered - refunded, delivered, refunded, rate: successRate(delivered, refunded) }
      })
      .filter((s) =>
        (!f.category || s.category === f.category) &&
        (!f.city || s.city === f.city) &&
        (!f.state || (f.state === 'active') === s.active) &&
        (!range || s.count > 0) &&
        textSearch(`${s.name} ${s.contact} ${s.phone} ${s.email} ${s.city} ${s.category}`, f.q))
  }, [db, f])

  const canEdit = can('suppliers', 'edit')
  const canDelete = can('suppliers', 'delete')
  const cols: Col<Row>[] = [
    { key: 'name', label: 'المورد', render: (s) => <><strong>{s.name}</strong><small>{s.category}</small></>, sort: (s) => s.name },
    { key: 'contact', label: 'التواصل', render: (s) => <>{s.contact}<small><a dir="ltr" href={`tel:${s.phone}`}>{s.phone}</a></small></>, sort: (s) => s.contact },
    { key: 'city', label: 'المدينة', render: (s) => s.city, sort: (s) => s.city },
    { key: 'count', label: 'الفواتير', right: true, render: (s) => can('stock', 'view') ? <Link to={`/stock?supplier=${s.id}`}>{fmtNum(s.count)}</Link> : fmtNum(s.count), sort: (s) => s.count },
    { key: 'spend', label: 'إجمالي الطلبات', right: true, render: (s) => fmtMoney(s.spend), sort: (s) => s.spend },
    { key: 'orders', label: 'الطلبات', right: true, render: (s) => fmtNum(s.orders), sort: (s) => s.orders },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (s) => fmtNum(s.delivered), sort: (s) => s.delivered },
    { key: 'refunded', label: 'مرتجع', right: true, render: (s) => fmtNum(s.refunded), sort: (s) => s.refunded },
    { key: 'rate', label: 'نسبة النجاح', right: true, render: (s) => (s.rate === null ? <span className="muted">لا بيانات</span> : fmtPct(s.rate)), sort: (s) => s.rate ?? -1 },
    { key: 'state', label: 'الحالة', render: (s) => s.active ? 'نشط' : <span className="muted">غير نشط</span>, sort: (s) => (s.active ? 0 : 1) },
  ]
  if (canEdit || canDelete) {
    cols.push({
      key: 'actions', label: '', right: true, render: (s) => (
        <RowActions>
          {canEdit && <IconButton label={`تعديل ${s.name}`} onClick={() => setForm({ item: s })}><Pencil size={16} /></IconButton>}
          {canDelete && <IconButton label={`حذف ${s.name}`} onClick={() => setRemoving(s)}><Trash2 size={16} /></IconButton>}
        </RowActions>
      ),
    })
  }
  const linked = removing ? db.invoices.filter((p) => p.supplierId === removing.id).length : 0

  return (
    <>
      <PageHead title="الموردون" count={fmtCount(rows.length, SUPPLIERS)}>
        {can('suppliers', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />إضافة مورد</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالاسم أو مسؤول التواصل أو الهاتف أو المدينة" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter label="اشترينا منه خلال" period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="الفئة" all="كل الفئات" value={f.category} onChange={(category) => set({ category })} options={list(CATEGORIES)} />
        <Select label="المدينة" all="كل المدن" value={f.city} onChange={(city) => set({ city })} options={list(CITIES)} />
        <Select label="الحالة" all="أي حالة" value={f.state} onChange={(state) => set({ state })} options={STATES} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(s) => s.id} sort={{ key: 'spend', dir: -1 }}
        empty={<><h2>لا يوجد موردون مطابقون</h2><p>غيّر البحث أو امسح الفلاتر لعرض موردين أكثر.</p></>} />

      {form && <SupplierForm item={form.item} onClose={() => setForm(null)} onSaved={() => setForm(null)} />}
      {removing && (linked > 0 ? (
        <Confirm title={`لا يمكن حذف ${removing.name}`} onClose={() => setRemoving(null)} body={`يرتبط بهذا المورد ${fmtCount(linked, INVOICES)}. اجعله غير نشط بدلًا من حذفه لتبقى التقارير صحيحة.`} />
      ) : (
        <Confirm title={`حذف ${removing.name}؟`} action="حذف المورد" body="لا توجد فواتير من هذا المورد، فلن يتغير شيء آخر." onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, suppliers: d.suppliers.filter((s) => s.id !== removing.id) }))
            toast(`تم حذف ${removing.name}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
