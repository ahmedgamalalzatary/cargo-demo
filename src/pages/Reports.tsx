import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { OrderStatus } from '../types'
import { useStore } from '../store'
import { STATUS_LABEL, STATUS_ORDER, ZONES, assignedAt, closedAt, closings, orderRows, refundEvents, successRate, sumQty, type OrderRow } from '../lib/domain'
import { ORDERS, downloadCsv, fmtCount, fmtDate, fmtDateTime, fmtDuration, fmtMoney, fmtNum, fmtPct, fmtShort } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { matchesParsed, parseQuery } from '../lib/search'
import { Button, FilterBar, PageHead, PeriodFilter, SearchBox, Select, StatusLegend, StatusPill, Table, useFilters, type Col } from '../components/ui'

const DEFAULTS = { tab: 'overview', q: '', period: '30d', from: '', to: '', status: '', driver: '', supplier: '', zone: '' }
const TABS = [['overview', 'نظرة عامة'], ['refunds', 'المرتجعات'], ['drivers', 'المندوبون'], ['suppliers', 'الموردون']] as const
const EXAMPLES = ['مرتجع في الجيزة آخر 30 يوم', 'كريم هذا الأسبوع', 'تم التوصيل أكثر من 1000 هذا الشهر', 'غلال الدلتا لم يصل']
const STACK: OrderStatus[] = ['delivered', 'assigned', 'unassigned', 'refunded']
const DAY = 86400000

interface Bucket { label: string; from: number; counts: Record<OrderStatus, number>; total: number }

function buckets(rows: OrderRow[]): Bucket[] {
  if (!rows.length) return []
  const times = rows.map((o) => o.createdAt)
  const start = new Date(Math.min(...times)).setHours(0, 0, 0, 0)
  const span = Math.max(...times) - start
  const size = span > 35 * DAY ? 7 * DAY : DAY
  const n = Math.floor(span / size) + 1
  const out: Bucket[] = Array.from({ length: n }, (_, i) => ({
    label: fmtShort(start + i * size),
    from: start + i * size,
    counts: { unassigned: 0, assigned: 0, delivered: 0, refunded: 0 },
    total: 0,
  }))
  for (const o of rows) {
    const b = out[Math.floor((o.createdAt - start) / size)]
    b.counts[o.status]++
    b.total++
  }
  return out
}

function StackedColumns({ data }: { data: Bucket[] }) {
  const max = Math.max(...data.map((b) => b.total), 1)
  const top = Math.max(4, Math.ceil(max / 4) * 4)
  const every = Math.ceil(data.length / 8)
  return (
    <div className="chart">
      <div className="chart-plot">
        {[1, 0.75, 0.5, 0.25, 0].map((t) => <div className="grid-line" key={t} style={{ bottom: `${t * 100}%` }}><span>{top * t}</span></div>)}
        <div className="columns">
          {data.map((b, i) => (
            <div className="column" key={b.from} tabIndex={0} aria-label={`${b.label}: ${fmtCount(b.total, ORDERS)}`}>
              <div className="column-stack">
                {STACK.map((s) => b.counts[s] > 0 && <i key={s} className={`seg seg-${s}`} style={{ height: `${(b.counts[s] / top) * 100}%` }} />)}
              </div>
              <div className={`tip${i > data.length / 2 ? ' tip-left' : ''}`} role="tooltip">
                <strong>{b.label}، {fmtCount(b.total, ORDERS)}</strong>
                {STACK.filter((s) => b.counts[s] > 0).map((s) => <span key={s}><i className={`seg seg-${s}`} />{STATUS_LABEL[s]}<b>{b.counts[s]}</b></span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-x">
        {data.map((b, i) => <span key={b.from}>{i % every === 0 ? b.label : ''}</span>)}
      </div>
    </div>
  )
}

function Overview({ rows }: { rows: OrderRow[] }) {
  const [asTable, setAsTable] = useState(false)
  const delivered = rows.filter((o) => o.status === 'delivered')
  const refunded = rows.filter((o) => o.status === 'refunded').length
  const rate = successRate(delivered.length, refunded)
  const times = delivered.flatMap((o) => {
    const c = closedAt(o), p = c && assignedAt(o, c)
    return p && c ? [c - p] : []
  })
  const zones = ZONES.map((z) => ({ zone: z, n: rows.filter((o) => o.zone === z).length })).filter((z) => z.n).sort((a, b) => b.n - a.n)
  const data = buckets(rows)
  const tiles: [string, string][] = [
    [fmtNum(rows.length), 'طلب'],
    [fmtNum(sumQty(rows)), 'قطعة'],
    [fmtMoney(delivered.reduce((n, o) => n + o.price, 0)), 'قيمة ما تم توصيله'],
    [fmtMoney(delivered.reduce((n, o) => n + o.fee, 0)), 'رسوم التوصيل المحصلة'],
    [fmtNum(refunded), 'مرتجع الآن'],
    [rate === null ? 'لا بيانات' : fmtPct(rate), 'نسبة نجاح التوصيل'],
    [times.length ? fmtDuration(times.reduce((a, b) => a + b, 0) / times.length) : 'لا بيانات', 'متوسط الوقت من الإسناد للتوصيل'],
  ]
  return (
    <>
      <div className="tiles">
        {tiles.map(([v, l]) => <p key={l}><b>{v}</b>{l}</p>)}
      </div>
      <div className="report-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>الطلبات حسب تاريخ الإنشاء وحالتها الحالية</h2>
            <Button onClick={() => setAsTable(!asTable)}>{asTable ? 'عرض الرسم' : 'عرض الجدول'}</Button>
          </div>
          {asTable ? (
            <div className="table-wrap panel-table">
              <table className="table table-plain">
                <thead><tr><th>بداية الفترة</th>{STACK.map((s) => <th key={s} className="right">{STATUS_LABEL[s]}</th>)}<th className="right">الإجمالي</th></tr></thead>
                <tbody>{data.map((b) => <tr key={b.from}><td data-label="بداية الفترة">{fmtDate(b.from)}</td>{STACK.map((s) => <td key={s} data-label={STATUS_LABEL[s]} className="right">{b.counts[s]}</td>)}<td data-label="الإجمالي" className="right">{b.total}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <>
              <StackedColumns data={data} />
              <StatusLegend />
            </>
          )}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>الطلبات حسب المنطقة</h2></div>
          <ul className="hbars">
            {zones.map((z) => (
              <li key={z.zone}>
                <span>{z.zone}</span>
                <i style={{ width: `${(z.n / zones[0].n) * 100}%` }} />
                <b>{z.n}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

export function Reports() {
  const { db, can } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const tab = f.tab as (typeof TABS)[number][0]
  const parsed = useMemo(() => parseQuery(f.q, db), [f.q, db])
  const base = useMemo(() => orderRows(db).filter((o) =>
    (!f.status || o.status === f.status) &&
    (!f.driver || o.driverId === f.driver) &&
    (!f.supplier || o.supplier.id === f.supplier) &&
    (!f.zone || o.zone === f.zone)), [db, f.status, f.driver, f.supplier, f.zone])
  const range = periodRange(f.period, f.from, f.to)
  const rows = useMemo(() => base.filter((o) => inRange(o.createdAt, range) && matchesParsed(o, parsed)), [base, range, parsed])

  /* Every refund in the period, read from the order log so reassigned orders still count. */
  const refunds = useMemo(() => base.flatMap((o) => refundEvents(o)
    .filter((r) => inRange(r.at, range) && matchesParsed(o, parsed, r.at))
    .map((r) => ({ ...r, key: `${o.id}-${r.at}`, order: o, driver: db.drivers.find((d) => d.id === r.driverId)?.name ?? '' }))), [base, range, parsed, db.drivers])

  const driverStats = useMemo(() => db.drivers.map((d) => {
    const closed = rows.flatMap((o) => closings(o).filter((e) => e.driverId === d.id).map((e) => ({ o, e })))
    const delivered = closed.filter((x) => x.e.status === 'delivered')
    const refunded = closed.length - delivered.length
    const times = delivered.flatMap(({ o, e }) => { const p = assignedAt(o, e.at); return p ? [e.at - p] : [] })
    const own = rows.filter((o) => o.driverId === d.id)
    return {
      id: d.id, name: d.name, zone: d.zone, orders: own.length, units: sumQty(own), open: own.filter((o) => o.status === 'assigned').length,
      delivered: delivered.length, refunded,
      rate: successRate(delivered.length, refunded) ?? -1,
      value: delivered.reduce((n, x) => n + x.o.collect, 0),
      time: times.length ? times.reduce((a, b) => a + b, 0) / times.length : -1,
    }
  }).filter((d) => d.orders > 0 || d.delivered + d.refunded > 0), [db.drivers, rows])

  const supplierStats = useMemo(() => db.suppliers.map((s) => {
    const own = rows.filter((o) => o.supplier.id === s.id)
    const delivered = own.filter((o) => o.status === 'delivered')
    const refunded = own.filter((o) => o.status === 'refunded').length
    return {
      id: s.id, name: s.name, category: s.category, invoices: new Set(own.map((o) => o.invoiceId)).size,
      orders: own.length, units: sumQty(own), total: own.reduce((n, o) => n + o.price, 0),
      delivered: delivered.length, refunded, rate: successRate(delivered.length, refunded) ?? -1,
      value: delivered.reduce((n, o) => n + o.price, 0),
    }
  }).filter((s) => s.orders > 0), [db.suppliers, rows])

  const refundCols: Col<(typeof refunds)[number]>[] = [
    { key: 'at', label: 'وقت المرتجع', render: (r) => fmtDateTime(r.at), sort: (r) => r.at },
    { key: 'id', label: 'الطلب', render: (r) => <><strong className="id">{r.order.id}</strong><small>{r.order.supplier.name}</small></>, sort: (r) => r.order.id },
    { key: 'reason', label: 'السبب', render: (r) => <span className="reason-text">{r.reason}</span>, sort: (r) => r.reason },
    { key: 'driver', label: 'المندوب', render: (r) => r.driver, sort: (r) => r.driver },
    { key: 'client', label: 'العميل', render: (r) => <>{r.order.client}<small>{r.order.zone}</small></>, sort: (r) => r.order.client },
    { key: 'state', label: 'البضاعة', render: (r) => <>{(r.state === 'pending' ? 'بانتظار التأكيد' : r.state === 'back' ? 'رجعت' : 'لم ترجع')}{!r.current && <small>الآن: <StatusPill status={r.order.status} /></small>}</>, sort: (r) => r.state },
    { key: 'price', label: 'القيمة', right: true, render: (r) => fmtMoney(r.order.price), sort: (r) => r.order.price },
  ]
  const driverCols: Col<(typeof driverStats)[number]>[] = [
    { key: 'name', label: 'المندوب', render: (d) => <><strong>{d.name}</strong><small>{d.zone}</small></>, sort: (d) => d.name },
    { key: 'orders', label: 'الطلبات', right: true, render: (d) => fmtNum(d.orders), sort: (d) => d.orders },
    { key: 'units', label: 'القطع', right: true, render: (d) => fmtNum(d.units), sort: (d) => d.units },
    { key: 'open', label: 'معه الآن', right: true, render: (d) => fmtNum(d.open), sort: (d) => d.open },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (d) => fmtNum(d.delivered), sort: (d) => d.delivered },
    { key: 'refunded', label: 'مرتجع', right: true, render: (d) => fmtNum(d.refunded), sort: (d) => d.refunded },
    { key: 'rate', label: 'نسبة النجاح', right: true, render: (d) => (d.rate < 0 ? <span className="muted">لا بيانات</span> : fmtPct(d.rate)), sort: (d) => d.rate },
    { key: 'time', label: 'متوسط الوقت', right: true, render: (d) => (d.time < 0 ? <span className="muted">لا بيانات</span> : fmtDuration(d.time)), sort: (d) => d.time },
    { key: 'value', label: 'التحصيل', right: true, render: (d) => fmtMoney(d.value), sort: (d) => d.value },
  ]
  const supplierCols: Col<(typeof supplierStats)[number]>[] = [
    { key: 'name', label: 'المورد', render: (s) => <><strong>{s.name}</strong><small>{s.category}</small></>, sort: (s) => s.name },
    { key: 'invoices', label: 'الفواتير', right: true, render: (s) => fmtNum(s.invoices), sort: (s) => s.invoices },
    { key: 'orders', label: 'الطلبات', right: true, render: (s) => fmtNum(s.orders), sort: (s) => s.orders },
    { key: 'units', label: 'القطع', right: true, render: (s) => fmtNum(s.units), sort: (s) => s.units },
    { key: 'total', label: 'إجمالي الطلبات', right: true, render: (s) => fmtMoney(s.total), sort: (s) => s.total },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (s) => fmtNum(s.delivered), sort: (s) => s.delivered },
    { key: 'refunded', label: 'مرتجع', right: true, render: (s) => fmtNum(s.refunded), sort: (s) => s.refunded },
    { key: 'rate', label: 'نسبة النجاح', right: true, render: (s) => (s.rate < 0 ? <span className="muted">لا بيانات</span> : fmtPct(s.rate)), sort: (s) => s.rate },
    { key: 'value', label: 'قيمة ما تم توصيله', right: true, render: (s) => fmtMoney(s.value), sort: (s) => s.value },
  ]

  const exportCsv = () => {
    if (tab === 'refunds') {
      downloadCsv('refunds', [['وقت المرتجع', 'الطلب', 'كود الطلب', 'الفاتورة', 'المورد', 'السبب', 'المندوب', 'العميل', 'المنطقة', 'البضاعة', 'القيمة'],
        ...refunds.map((r) => [fmtDateTime(r.at), r.order.id, r.order.code, r.order.invoice.id, r.order.supplier.name, r.reason, r.driver, r.order.client, r.order.zone, (r.state === 'pending' ? 'بانتظار التأكيد' : r.state === 'back' ? 'رجعت' : 'لم ترجع'), r.order.price])])
    } else if (tab === 'drivers') {
      downloadCsv('delivery-men', [['المندوب', 'المنطقة', 'الطلبات', 'القطع', 'معه الآن', 'تم التوصيل', 'مرتجع', 'نسبة النجاح %', 'التحصيل'],
        ...driverStats.map((d) => [d.name, d.zone, d.orders, d.units, d.open, d.delivered, d.refunded, d.rate < 0 ? '' : Math.round(d.rate), d.value])])
    } else if (tab === 'suppliers') {
      downloadCsv('suppliers', [['المورد', 'الفئة', 'الفواتير', 'الطلبات', 'القطع', 'إجمالي الطلبات', 'تم التوصيل', 'مرتجع', 'نسبة النجاح %', 'قيمة ما تم توصيله'],
        ...supplierStats.map((s) => [s.name, s.category, s.invoices, s.orders, s.units, s.total, s.delivered, s.refunded, s.rate < 0 ? '' : Math.round(s.rate), s.value])])
    } else {
      downloadCsv('orders', [['الطلب', 'كود الطلب', 'الحالة', 'سبب المرتجع', 'الفاتورة', 'المورد', 'الأصناف', 'الكمية', 'العميل', 'المنطقة', 'المندوب', 'السعر', 'رسوم التوصيل', 'تاريخ الإنشاء'],
        ...rows.map((o) => [o.id, o.code, STATUS_LABEL[o.status], o.refund?.reason ?? '', o.invoice.id, o.supplier.name, o.goods, o.quantity, o.client, o.zone, o.driver?.name ?? '', o.price, o.fee, fmtDateTime(o.createdAt)])])
    }
  }

  const noMatch = <><h2>لا توجد نتائج مطابقة</h2><p>جرّب فترة أطول أو امسح الفلاتر.</p></>
  const activeFilters = active
  return (
    <>
      <PageHead title="التقارير" count={`${fmtCount(rows.length, ORDERS)} في هذا العرض`}>
        {can('reports', 'export') && <Button onClick={exportCsv}><Download size={17} aria-hidden />تصدير CSV</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} chips={parsed.chips} placeholder="اسأل بكلماتك، مثل: مرتجع أرز الأسبوع الماضي" />
      {!f.q && (
        <p className="examples"><span>أمثلة</span>{EXAMPLES.map((e) => <button type="button" key={e} onClick={() => set({ q: e, period: 'all' })}>{e}</button>)}</p>
      )}
      <FilterBar active={activeFilters} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المندوب" all="كل المندوبين" value={f.driver} onChange={(driver) => set({ driver })} options={db.drivers.map((d) => ({ value: d.id, label: d.name }))} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select label="الحالة" all="كل الحالات" value={f.status} onChange={(status) => set({ status })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>

      <div className="tabs" role="tablist" aria-label="التقرير">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => set({ tab: id })}>{label}</button>)}
      </div>

      {tab === 'overview' && (rows.length ? <Overview rows={rows} /> : <div className="empty">{noMatch}</div>)}
      {tab === 'refunds' && <Table key="refunds" rows={refunds} cols={refundCols} rowKey={(r) => r.key} sort={{ key: 'at', dir: -1 }} empty={noMatch} />}
      {tab === 'drivers' && <Table key="drivers" rows={driverStats} cols={driverCols} rowKey={(d) => d.id} sort={{ key: 'delivered', dir: -1 }} empty={noMatch} />}
      {tab === 'suppliers' && <Table key="suppliers" rows={supplierStats} cols={supplierCols} rowKey={(s) => s.id} sort={{ key: 'total', dir: -1 }} empty={noMatch} />}
    </>
  )
}
