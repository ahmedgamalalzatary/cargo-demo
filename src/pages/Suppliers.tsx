import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Supplier } from '../types'
import { useStore } from '../store'
import { CATEGORIES, CITIES, nextId } from '../lib/domain'
import { SUPPLIERS, PURCHASES, fmtCount, fmtMoney, fmtNum } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, FormDrawer, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col, type FieldSpec } from '../components/ui'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', category: '', city: '', state: '' }
type Row = Supplier & { count: number; spend: number }
const list = (items: string[]) => items.map((x) => ({ value: x, label: x }))
const STATES = [{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }]

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'اسم الشركة', required: true, full: true },
  { name: 'contact', label: 'مسؤول التواصل', required: true },
  { name: 'phone', label: 'الهاتف', type: 'tel', required: true },
  { name: 'email', label: 'البريد الإلكتروني', type: 'email', full: true },
  { name: 'city', label: 'المدينة', type: 'select', required: true, options: list(CITIES) },
  { name: 'category', label: 'الفئة', type: 'select', required: true, options: list(CATEGORIES) },
  { name: 'active', label: 'الحالة', type: 'select', required: true, options: STATES },
]

export function Suppliers() {
  const { db, setDb, can, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Supplier } | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(() => {
    const range = periodRange(f.period, f.from, f.to)
    return db.suppliers
      .map((s) => {
        const bought = db.purchases.filter((p) => p.supplierId === s.id && inRange(p.date, range))
        return { ...s, count: bought.length, spend: bought.reduce((n, p) => n + p.quantity * p.unitCost, 0) }
      })
      .filter((s) =>
        (!f.category || s.category === f.category) &&
        (!f.city || s.city === f.city) &&
        (!f.state || (f.state === 'active') === s.active) &&
        (!range || s.count > 0) &&
        textSearch(`${s.name} ${s.contact} ${s.phone} ${s.email} ${s.city} ${s.category}`, f.q))
  }, [db, f])

  const save = (v: Record<string, string>) => {
    const data = { name: v.name.trim(), contact: v.contact.trim(), phone: v.phone.trim(), email: v.email.trim(), city: v.city, category: v.category, active: v.active === 'active' }
    if (form?.item) {
      const id = form.item.id
      setDb((d) => ({ ...d, suppliers: d.suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)) }))
      toast(`تم حفظ ${data.name}`)
    } else {
      setDb((d) => ({ ...d, suppliers: [{ id: nextId(d.suppliers, 'S-', 0), createdAt: Date.now(), ...data }, ...d.suppliers] }))
      toast(`تمت إضافة ${data.name}`)
    }
    setForm(null)
  }

  const canEdit = can('suppliers', 'edit')
  const canDelete = can('suppliers', 'delete')
  const cols: Col<Row>[] = [
    { key: 'name', label: 'المورد', render: (s) => <><strong>{s.name}</strong><small>{s.category}</small></>, sort: (s) => s.name },
    { key: 'contact', label: 'التواصل', render: (s) => <>{s.contact}<small><a dir="ltr" href={`tel:${s.phone}`}>{s.phone}</a></small></>, sort: (s) => s.contact },
    { key: 'city', label: 'المدينة', render: (s) => s.city, sort: (s) => s.city },
    { key: 'count', label: 'المشتريات', right: true, render: (s) => can('purchases', 'view') ? <Link to={`/purchases?supplier=${s.id}`}>{fmtNum(s.count)}</Link> : fmtNum(s.count), sort: (s) => s.count },
    { key: 'spend', label: 'الإنفاق', right: true, render: (s) => fmtMoney(s.spend), sort: (s) => s.spend },
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
  const linked = removing ? db.purchases.filter((p) => p.supplierId === removing.id).length : 0

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

      {form && (
        <FormDrawer title={form.item ? `تعديل ${form.item.name}` : 'إضافة مورد'} action={form.item ? 'حفظ المورد' : 'إضافة المورد'} fields={FIELDS} onSave={save} onClose={() => setForm(null)}
          initial={{ name: form.item?.name ?? '', contact: form.item?.contact ?? '', phone: form.item?.phone ?? '', email: form.item?.email ?? '', city: form.item?.city ?? '', category: form.item?.category ?? '', active: form.item && !form.item.active ? 'inactive' : 'active' }} />
      )}
      {removing && (linked > 0 ? (
        <Confirm title={`لا يمكن حذف ${removing.name}`} onClose={() => setRemoving(null)} body={`يرتبط بهذا المورد ${fmtCount(linked, PURCHASES)}. اجعله غير نشط بدلًا من حذفه لتبقى التقارير صحيحة.`} />
      ) : (
        <Confirm title={`حذف ${removing.name}؟`} action="حذف المورد" body="لا توجد مشتريات من هذا المورد، فلن يتغير شيء آخر." onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, suppliers: d.suppliers.filter((s) => s.id !== removing.id) }))
            toast(`تم حذف ${removing.name}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
