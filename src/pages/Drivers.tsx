import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Driver } from '../types'
import { useStore } from '../store'
import { VEHICLES, ZONES, closings, emailTaken, nextId, successRate } from '../lib/domain'
import { DRIVERS, ORDERS, fmtCount, fmtNum, fmtPct } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, FormDrawer, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col, type FieldSpec } from '../components/ui'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', zone: '', vehicle: '', state: '' }
type Row = Driver & { open: number; delivered: number; refunded: number; rate: number | null }
const list = (items: string[]) => items.map((x) => ({ value: x, label: x }))
const STATES = [{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }]

const BASE_FIELDS: FieldSpec[] = [
  { name: 'name', label: 'الاسم بالكامل', required: true, full: true },
  { name: 'email', label: 'بريد الدخول (اختياري، بدونه يدخل باسمه)', type: 'email' },
  { name: 'password', label: 'كلمة مرور الدخول', required: true, check: (v) => (v.length < 6 ? 'استخدم 6 أحرف على الأقل.' : undefined) },
  { name: 'phone', label: 'الهاتف', type: 'tel', required: true },
  { name: 'zone', label: 'المنطقة الأساسية', type: 'select', required: true, options: list(ZONES) },
  { name: 'vehicle', label: 'المركبة', type: 'select', required: true, options: list(VEHICLES) },
  { name: 'plate', label: 'رقم اللوحة' },
  { name: 'active', label: 'الحالة', type: 'select', required: true, options: STATES },
]

export function Drivers() {
  const { db, setDb, can, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Driver } | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(() => {
    const range = periodRange(f.period, f.from, f.to)
    return db.drivers
      .map((d) => {
        /* Read from the order log, so a refund still counts after the order goes to someone else. */
        const closed = db.orders.flatMap((o) => closings(o).filter((e) => e.driverId === d.id && inRange(e.at, range)))
        const delivered = closed.filter((e) => e.status === 'delivered').length
        const refunded = closed.length - delivered
        const open = db.orders.filter((o) => o.driverId === d.id && o.status === 'assigned').length
        return { ...d, open, delivered, refunded, rate: successRate(delivered, refunded) }
      })
      .filter((d) =>
        (!f.zone || d.zone === f.zone) &&
        (!f.vehicle || d.vehicle === f.vehicle) &&
        (!f.state || (f.state === 'active') === d.active) &&
        textSearch(`${d.name} ${d.email} ${d.phone} ${d.vehicle} ${d.plate} ${d.zone}`, f.q))
  }, [db, f])

  const save = (v: Record<string, string>) => {
    const data = { name: v.name.trim(), email: v.email.trim().toLowerCase(), password: v.password.trim(), phone: v.phone.trim(), zone: v.zone, vehicle: v.vehicle, plate: v.plate.trim(), active: v.active === 'active' }
    if (form?.item) {
      const id = form.item.id
      setDb((d) => ({ ...d, drivers: d.drivers.map((x) => (x.id === id ? { ...x, ...data } : x)) }))
      toast(`تم حفظ ${data.name}`)
    } else {
      setDb((d) => ({ ...d, drivers: [{ id: nextId(d.drivers, 'D-', 0), joinedAt: Date.now(), ...data }, ...d.drivers] }))
      toast(`تمت إضافة ${data.name}`)
    }
    setForm(null)
  }

  const canEdit = can('drivers', 'edit')
  const canDelete = can('drivers', 'delete')
  const cols: Col<Row>[] = [
    { key: 'name', label: 'المندوب', render: (d) => <><strong>{d.name}</strong><small><a dir="ltr" href={`tel:${d.phone}`}>{d.phone}</a></small></>, sort: (d) => d.name },
    { key: 'vehicle', label: 'المركبة', render: (d) => <>{d.vehicle}<small>{d.plate || 'بدون لوحة'}</small></>, sort: (d) => d.vehicle },
    { key: 'zone', label: 'المنطقة الأساسية', render: (d) => d.zone, sort: (d) => d.zone },
    { key: 'open', label: 'معه الآن', right: true, render: (d) => can('orders', 'view') ? <Link to={`/orders?driver=${d.id}`}>{fmtNum(d.open)}</Link> : fmtNum(d.open), sort: (d) => d.open },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (d) => fmtNum(d.delivered), sort: (d) => d.delivered },
    { key: 'refunded', label: 'مرتجع', right: true, render: (d) => can('orders', 'view') ? <Link to={`/refunds?driver=${d.id}&state=all`}>{fmtNum(d.refunded)}</Link> : fmtNum(d.refunded), sort: (d) => d.refunded },
    { key: 'rate', label: 'نسبة النجاح', right: true, render: (d) => (d.rate === null ? <span className="muted">لا بيانات</span> : fmtPct(d.rate)), sort: (d) => d.rate ?? -1 },
    { key: 'state', label: 'الحالة', render: (d) => d.active ? 'نشط' : <span className="muted">غير نشط</span>, sort: (d) => (d.active ? 0 : 1) },
  ]
  if (canEdit || canDelete) {
    cols.push({
      key: 'actions', label: '', right: true, render: (d) => (
        <RowActions>
          {canEdit && <IconButton label={`تعديل ${d.name}`} onClick={() => setForm({ item: d })}><Pencil size={16} /></IconButton>}
          {canDelete && <IconButton label={`حذف ${d.name}`} onClick={() => setRemoving(d)}><Trash2 size={16} /></IconButton>}
        </RowActions>
      ),
    })
  }
  const linked = removing ? db.orders.filter((o) => o.driverId === removing.id || o.events.some((e) => e.driverId === removing.id)).length : 0
  const fields = BASE_FIELDS.map((x) => (x.name === 'email'
    ? { ...x, check: (v: string) => (emailTaken(db, v.trim(), form?.item?.id) ? 'هذا البريد مستخدم في حساب آخر.' : undefined) }
    : x))

  return (
    <>
      <PageHead title="المندوبون" count={`${fmtCount(rows.length, DRIVERS)}، النشط منهم ${fmtNum(rows.filter((d) => d.active).length)}`}>
        {can('drivers', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />إضافة مندوب</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالاسم أو الهاتف أو اللوحة أو المنطقة" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter label="احتساب الطلبات خلال" period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المنطقة الأساسية" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={list(ZONES)} />
        <Select label="المركبة" all="كل المركبات" value={f.vehicle} onChange={(vehicle) => set({ vehicle })} options={list(VEHICLES)} />
        <Select label="الحالة" all="أي حالة" value={f.state} onChange={(state) => set({ state })} options={STATES} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(d) => d.id} sort={{ key: 'delivered', dir: -1 }}
        empty={<><h2>لا يوجد مندوبون مطابقون</h2><p>غيّر البحث أو امسح الفلاتر لعرض مندوبين أكثر.</p></>} />

      {form && (
        <FormDrawer title={form.item ? `تعديل ${form.item.name}` : 'إضافة مندوب'} action={form.item ? 'حفظ المندوب' : 'إضافة المندوب'} fields={fields} onSave={save} onClose={() => setForm(null)}
          initial={{ name: form.item?.name ?? '', email: form.item?.email ?? '', password: form.item?.password ?? '', phone: form.item?.phone ?? '', zone: form.item?.zone ?? '', vehicle: form.item?.vehicle ?? '', plate: form.item?.plate ?? '', active: form.item && !form.item.active ? 'inactive' : 'active' }} />
      )}
      {removing && (linked > 0 ? (
        <Confirm title={`لا يمكن حذف ${removing.name}`} onClose={() => setRemoving(null)} body={`يرتبط بهذا المندوب ${fmtCount(linked, ORDERS)}. اجعله غير نشط بدلًا من حذفه ليبقى سجل الاستلام صحيحًا.`} />
      ) : (
        <Confirm title={`حذف ${removing.name}؟`} action="حذف المندوب" body="لا توجد طلبات لهذا المندوب، فلن يتغير شيء آخر." onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, drivers: d.drivers.filter((x) => x.id !== removing.id) }))
            toast(`تم حذف ${removing.name}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
