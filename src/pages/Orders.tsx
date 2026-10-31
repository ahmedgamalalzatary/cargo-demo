import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { ASSIGNABLE, STATUS_LABEL, STATUS_ORDER, ZONES, moveOrder, orderRows, type OrderRow } from '../lib/domain'
import { ORDERS, PRODUCTS, fmtCount, fmtDateTime, fmtMoney } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { matchesParsed, parseQuery } from '../lib/search'
import { Button, Confirm, FilterBar, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, StatusPill, Table, useFilters, type Col } from '../components/ui'
import { OrderForm } from '../components/OrderForm'
import { OrderDetail } from '../components/OrderDetail'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', status: '', driver: '', supplier: '', zone: '' }

export function Orders() {
  const { db, setDb, can, user, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [detail, setDetail] = useState<string | null>(null)
  const [form, setForm] = useState<{ id?: string } | null>(null)
  const [removing, setRemoving] = useState<OrderRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDriver, setBulkDriver] = useState('')

  const parsed = useMemo(() => parseQuery(f.q, db), [f.q, db])
  const rows = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return orderRows(db).filter((o) =>
      inRange(o.createdAt, range) &&
      (!f.status || o.status === f.status) &&
      (!f.driver || o.driverId === f.driver) &&
      (!f.supplier || o.suppliers.some((s) => s.id === f.supplier)) &&
      (!f.zone || o.zone === f.zone) &&
      matchesParsed(o, parsed))
  }, [db, f, parsed])

  const canEdit = can('orders', 'edit')
  const canDelete = can('orders', 'delete')
  const cols: Col<OrderRow>[] = [
    { key: 'id', label: 'الطلب', render: (o) => <strong className="id">{o.id}</strong>, sort: (o) => o.id },
    { key: 'status', label: 'الحالة', render: (o) => <StatusPill status={o.status} />, sort: (o) => STATUS_ORDER.indexOf(o.status) },
    { key: 'goods', label: 'الأصناف', render: (o) => <>{o.goods}<small>{o.rows.length > 1 ? `${fmtCount(o.rows.length, PRODUCTS)}، ` : ''}{o.suppliers.map((s) => s.name).join('، ')}</small></>, sort: (o) => o.rows.length },
    { key: 'client', label: 'العميل', render: (o) => <>{o.client}<small>{o.zone}</small></>, sort: (o) => o.client },
    { key: 'driver', label: 'المندوب', render: (o) => o.driver?.name ?? <span className="muted">غير مسند</span>, sort: (o) => o.driver?.name ?? '' },
    { key: 'price', label: 'السعر', right: true, render: (o) => fmtMoney(o.price), sort: (o) => o.price },
    { key: 'created', label: 'تاريخ الإنشاء', render: (o) => fmtDateTime(o.createdAt), sort: (o) => o.createdAt },
  ]
  if (canEdit || canDelete) {
    cols.push({
      key: 'actions', label: '', right: true, render: (o) => (
        <RowActions>
          {canEdit && <IconButton label={`تعديل ${o.id}`} onClick={() => setForm({ id: o.id })}><Pencil size={16} /></IconButton>}
          {canDelete && <IconButton label={`حذف ${o.id}`} onClick={() => setRemoving(o)}><Trash2 size={16} /></IconButton>}
        </RowActions>
      ),
    })
  }

  const assignable = rows.filter((o) => selected.has(o.id) && ASSIGNABLE.includes(o.status))
  const bulkAssign = () => {
    const driver = db.drivers.find((d) => d.id === bulkDriver)
    if (!driver || !user) return
    const ids = new Set(assignable.map((o) => o.id))
    setDb((d) => ({ ...d, orders: d.orders.map((o) => (ids.has(o.id) ? moveOrder(o, 'assigned', user.name, driver.id, `أُسند إلى ${driver.name}`) : o)) }))
    toast(`تم إسناد ${fmtCount(ids.size, ORDERS)} إلى ${driver.name}`)
    setSelected(new Set())
    setBulkDriver('')
  }

  const editing = form?.id ? db.orders.find((o) => o.id === form.id) : undefined
  return (
    <>
      <PageHead title="الطلبات" count={`${fmtCount(rows.length, ORDERS)}، بإجمالي ${fmtMoney(rows.reduce((n, o) => n + o.price, 0))}`}>
        {can('orders', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />طلب جديد</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} chips={parsed.chips} placeholder='جرّب: فشل التوصيل في الجيزة الأسبوع الماضي أكثر من 500، أو: كريم أرز' />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="الحالة" all="كل الحالات" value={f.status} onChange={(status) => set({ status })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <Select label="المندوب" all="كل المندوبين" value={f.driver} onChange={(driver) => set({ driver })} options={db.drivers.map((d) => ({ value: d.id, label: d.name }))} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>

      {canEdit && assignable.length > 0 && (
        <div className="bulk">
          <strong>تم تحديد {assignable.length}</strong>
          <select aria-label="مندوب الطلبات المحددة" value={bulkDriver} onChange={(e) => setBulkDriver(e.target.value)}>
            <option value="">اختر مندوبًا</option>
            {db.drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}، {d.zone}</option>)}
          </select>
          <Button variant="primary" disabled={!bulkDriver} onClick={bulkAssign}>إسناد المحدد</Button>
        </div>
      )}

      <Table rows={rows} cols={cols} rowKey={(o) => o.id} onRow={(o) => setDetail(o.id)} sort={{ key: 'created', dir: -1 }}
        selected={canEdit ? selected : undefined} onSelect={setSelected}
        empty={<><h2>لا توجد طلبات مطابقة</h2><p>غيّر البحث أو امسح الفلاتر لعرض طلبات أكثر.</p></>} />

      {detail && <OrderDetail key={detail} orderId={detail} onClose={() => setDetail(null)} onEdit={canEdit ? () => { setForm({ id: detail }); setDetail(null) } : undefined} />}
      {form && <OrderForm order={editing} onClose={() => setForm(null)} />}
      {removing && (
        <Confirm title={`حذف ${removing.id}؟`} action="حذف الطلب" onClose={() => setRemoving(null)}
          body={`ستعود أصنافه إلى المخزون (${removing.goods})، ويُحذف سجل الطلب.`}
          onConfirm={() => {
            setDb((d) => ({ ...d, orders: d.orders.filter((o) => o.id !== removing.id) }))
            toast(`تم حذف ${removing.id}`)
            setRemoving(null)
          }} />
      )}
    </>
  )
}
