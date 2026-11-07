import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { RETURN_LABEL, ZONES, closings, confirmReturn, orderRows, refundEvents, type OrderRow, type RefundEvent, type ReturnState } from '../lib/domain'
import { REFUNDS, fmtCount, fmtDateTime, fmtMoney, fmtNum, fmtPct } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { orderText, textSearch } from '../lib/search'
import { Button, FilterBar, PageHead, PeriodFilter, RowActions, SearchBox, Select, StatusPill, Table, useFilters, type Col } from '../components/ui'
import { OrderDetail } from '../components/OrderDetail'

const DEFAULTS = { state: 'pending', q: '', period: 'all', from: '', to: '', driver: '', supplier: '', zone: '' }
const TABS: [string, string][] = [['pending', 'بانتظار التأكيد'], ['back', 'رجعت البضاعة'], ['missing', 'لم ترجع'], ['all', 'كل المرتجعات']]
type Row = RefundEvent & { key: string; order: OrderRow }

/* Every order a delivery man brought back, with his reason, and whether the goods actually came back to us. */
export function Refunds() {
  const { db, setDb, user, can, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [detail, setDetail] = useState<string | null>(null)
  const drivers = useMemo(() => new Map(db.drivers.map((d) => [d.id, d.name])), [db.drivers])
  const orders = useMemo(() => orderRows(db), [db])

  const range = periodRange(f.period, f.from, f.to)
  const inView = useMemo(() => orders.flatMap((order) => refundEvents(order).map((r): Row => ({ ...r, key: `${order.id}-${r.at}`, order })))
    .filter((r) =>
      inRange(r.at, range) &&
      (!f.driver || r.driverId === f.driver) &&
      (!f.supplier || r.order.supplier.id === f.supplier) &&
      (!f.zone || r.order.zone === f.zone) &&
      textSearch(`${orderText(r.order)} ${r.reason} ${drivers.get(r.driverId) ?? ''}`, f.q)), [orders, range, f.driver, f.supplier, f.zone, f.q, drivers])
  const count = (s: ReturnState) => inView.filter((r) => r.state === s).length
  const rows = f.state === 'all' ? inView : inView.filter((r) => r.state === f.state)

  /* Refund rate: refunds out of every delivery attempt that closed in the same view. */
  const attempts = orders.flatMap((o) => closings(o).filter((e) =>
    inRange(e.at, range) && (!f.driver || e.driverId === f.driver) && (!f.supplier || o.supplier.id === f.supplier) && (!f.zone || o.zone === f.zone))).length
  const tiles: [string, string][] = [
    [fmtNum(inView.length), 'إجمالي المرتجعات'],
    [fmtNum(count('pending')), 'بانتظار التأكيد'],
    [fmtNum(count('back')), 'رجعت البضاعة'],
    [fmtNum(count('missing')), 'لم ترجع البضاعة'],
    [attempts ? fmtPct((inView.length / attempts) * 100) : 'لا بيانات', 'نسبة المرتجع'],
    [fmtMoney(inView.reduce((n, r) => n + r.order.price, 0)), 'قيمة المرتجعات'],
  ]

  const edit = can('orders', 'edit')
  const settle = (r: Row, back: boolean) => {
    if (!user) return
    setDb((d) => ({ ...d, orders: d.orders.map((o) => (o.id === r.order.id ? confirmReturn(o, user.name, back) : o)) }))
    toast(`${r.order.id}: ${back ? 'رجعت البضاعة' : 'لم ترجع البضاعة'}`)
  }
  const cols: Col<Row>[] = [
    { key: 'at', label: 'وقت المرتجع', render: (r) => fmtDateTime(r.at), sort: (r) => r.at },
    { key: 'id', label: 'الطلب', render: (r) => <><strong className="id">{r.order.id}</strong><small>{r.order.invoice.id}، {r.order.supplier.name}</small></>, sort: (r) => r.order.id },
    { key: 'reason', label: 'السبب', render: (r) => <span className="reason-text">{r.reason}</span>, sort: (r) => r.reason },
    { key: 'driver', label: 'المندوب', render: (r) => drivers.get(r.driverId) ?? '', sort: (r) => drivers.get(r.driverId) ?? '' },
    { key: 'client', label: 'العميل', render: (r) => <>{r.order.client}<small>{r.order.zone}</small></>, sort: (r) => r.order.client },
    { key: 'goods', label: 'الأصناف', render: (r) => <small className="clamp">{r.order.goods}</small>, sort: (r) => r.order.quantity },
    { key: 'price', label: 'القيمة', right: true, render: (r) => fmtMoney(r.order.price), sort: (r) => r.order.price },
    {
      key: 'state', label: 'البضاعة', render: (r) => (
        <>
          <span className={`ret-${r.state}`}>{RETURN_LABEL[r.state]}</span>
          {!r.current && <small>أُعيد إسناده، الآن: <StatusPill status={r.order.status} /></small>}
        </>
      ), sort: (r) => r.state,
    },
  ]
  if (edit) {
    cols.push({
      key: 'actions', label: '', right: true, render: (r) => r.current ? (
        <RowActions>
          <div className="refund-actions">
            <Button variant={r.state === 'back' ? 'primary' : 'plain'} onClick={() => settle(r, true)}>رجعت</Button>
            <Button variant={r.state === 'missing' ? 'danger' : 'plain'} onClick={() => settle(r, false)}>لم ترجع</Button>
            <Button onClick={() => setDetail(r.order.id)}>إعادة الإسناد</Button>
          </div>
        </RowActions>
      ) : null,
    })
  }

  return (
    <>
      <PageHead title="المرتجعات" count={`${fmtCount(inView.length, REFUNDS)} في هذا العرض، منها ${fmtNum(count('pending'))} بانتظار التأكيد`} />
      <div className="tiles">{tiles.map(([v, l]) => <p key={l}><b>{v}</b>{l}</p>)}</div>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالسبب أو العميل أو المندوب أو رقم الطلب" />
      <FilterBar active={active - (f.state !== DEFAULTS.state ? 1 : 0)} onClear={() => { clear(); set({ state: f.state }) }}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المندوب" all="كل المندوبين" value={f.driver} onChange={(driver) => set({ driver })} options={db.drivers.map((d) => ({ value: d.id, label: d.name }))} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>
      <div className="tabs" role="tablist" aria-label="حالة المرتجع">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={f.state === id} onClick={() => set({ state: id })}>
            {label} <span className="tab-count">{id === 'all' ? inView.length : count(id as ReturnState)}</span>
          </button>
        ))}
      </div>
      <Table key={f.state} rows={rows} cols={cols} rowKey={(r) => r.key} onRow={(r) => setDetail(r.order.id)} sort={{ key: 'at', dir: -1 }}
        empty={inView.length ? <><h2>لا توجد مرتجعات هنا</h2><p>جرّب تبويبًا آخر أو امسح الفلاتر.</p></> : <><h2>لا توجد مرتجعات</h2><p>ستظهر هنا الطلبات التي يرجعها المندوبون مع السبب الذي كتبوه.</p></>} />
      {detail && <OrderDetail key={detail} orderId={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
