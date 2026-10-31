import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { OrderStatus } from '../types'
import { useStore } from '../store'
import { STATUS_LABEL, STATUS_ORDER, ZONES, closedAt, invoiceCost, orderRows, pickedAt, sumQty, type OrderRow } from '../lib/domain'
import { ORDERS, downloadCsv, fmtCount, fmtDate, fmtDateTime, fmtDuration, fmtMoney, fmtNum, fmtPct, fmtShort } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { matchesParsed, parseQuery } from '../lib/search'
import { Button, FilterBar, PageHead, PeriodFilter, SearchBox, Select, StatusPill, Table, useFilters, type Col } from '../components/ui'
import { StatusLegend } from '../components/CutBar'

const DEFAULTS = { tab: 'overview', q: '', period: '30d', from: '', to: '', status: '', driver: '', supplier: '', zone: '' }
const TABS = [['overview', 'نظرة عامة'], ['picks', 'سجل الاستلام'], ['drivers', 'المندوبون'], ['suppliers', 'الموردون']] as const
const EXAMPLES = ['فشل في الجيزة آخر 30 يوم', 'استلام كريم هذا الأسبوع', 'تم التوصيل أكثر من 5000 هذا الشهر', 'غلال الدلتا لم يصل']
const STACK: OrderStatus[] = ['delivered', 'picked', 'accepted', 'assigned', 'unassigned', 'denied', 'failed']
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
    counts: { unassigned: 0, assigned: 0, accepted: 0, denied: 0, picked: 0, delivered: 0, failed: 0 },
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
  const failed = rows.filter((o) => o.status === 'failed').length
  const closed = delivered.length + failed
  const times = delivered.flatMap((o) => {
    const p = pickedAt(o), c = closedAt(o)
    return p && c ? [c - p] : []
  })
  const zones = ZONES.map((z) => ({ zone: z, n: rows.filter((o) => o.zone === z).length })).filter((z) => z.n).sort((a, b) => b.n - a.n)
  const data = buckets(rows)
  const tiles: [string, string][] = [
    [fmtNum(rows.length), 'طلب مقسَّم'],
    [fmtNum(sumQty(rows)), 'وحدة منقولة'],
    [fmtMoney(delivered.reduce((n, o) => n + o.price, 0)), 'قيمة ما تم توصيله'],
    [closed ? fmtPct((delivered.length / closed) * 100) : 'لا بيانات', 'نسبة نجاح التوصيل'],
    [times.length ? fmtDuration(times.reduce((a, b) => a + b, 0) / times.length) : 'لا بيانات', 'متوسط الوقت من الاستلام للتوصيل'],
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
    (!f.supplier || o.suppliers.some((s) => s.id === f.supplier)) &&
    (!f.zone || o.zone === f.zone)), [db, f.status, f.driver, f.supplier, f.zone])
  const range = periodRange(f.period, f.from, f.to)
  const rows = useMemo(() => base.filter((o) => inRange(o.createdAt, range) && matchesParsed(o, parsed)), [base, range, parsed])

  /* The pickup log follows the pickup time, not the time the order was cut. */
  const picks = useMemo(() => base.flatMap((o) => {
    const at = pickedAt(o)
    return at && inRange(at, range) && matchesParsed(o, parsed, at) ? [{ ...o, at, closed: closedAt(o) }] : []
  }), [base, range, parsed])

  const driverStats = useMemo(() => db.drivers.map((d) => {
    const own = rows.filter((o) => o.driverId === d.id)
    const delivered = own.filter((o) => o.status === 'delivered')
    const failed = own.filter((o) => o.status === 'failed').length
    const times = delivered.flatMap((o) => { const p = pickedAt(o), c = closedAt(o); return p && c ? [c - p] : [] })
    return {
      id: d.id, name: d.name, zone: d.zone, orders: own.length, units: sumQty(own),
      denied: rows.reduce((n, o) => n + o.events.filter((e) => e.status === 'denied' && e.driverId === d.id).length, 0),
      picked: own.filter((o) => pickedAt(o)).length, delivered: delivered.length, failed,
      rate: delivered.length + failed ? (delivered.length / (delivered.length + failed)) * 100 : -1,
      value: delivered.reduce((n, o) => n + o.price, 0),
      time: times.length ? times.reduce((a, b) => a + b, 0) / times.length : -1,
    }
  }).filter((d) => d.orders > 0 || d.denied > 0), [db.drivers, rows])

  /* An order can mix suppliers, so each one is credited only with its own units and its cost share of the price. */
  const supplierStats = useMemo(() => db.suppliers.map((s) => {
    const own = rows.filter((o) => o.suppliers.some((x) => x.id === s.id))
    const shareOf = (o: OrderRow) => o.rows.filter((r) => r.supplier.id === s.id)
    const bought = db.invoices.filter((p) => p.supplierId === s.id && inRange(p.date, range))
    return {
      id: s.id, name: s.name, category: s.category, invoices: bought.length,
      spend: bought.reduce((n, p) => n + invoiceCost(p), 0),
      orders: own.length,
      units: own.reduce((n, o) => n + shareOf(o).reduce((m, r) => m + r.quantity, 0), 0),
      delivered: own.filter((o) => o.status === 'delivered').length,
      value: own.reduce((n, o) => n + (o.price * shareOf(o).reduce((m, r) => m + r.quantity * r.line.unitCost, 0)) / o.cost, 0),
    }
  }).filter((s) => s.orders > 0 || (s.invoices > 0 && !f.q && !f.driver && !f.status && !f.zone && !f.supplier) || (f.supplier === s.id && s.invoices > 0)), [db, rows, range, f.q, f.driver, f.status, f.zone, f.supplier])

  const pickCols: Col<(typeof picks)[number]>[] = [
    { key: 'at', label: 'وقت الاستلام', render: (o) => fmtDateTime(o.at), sort: (o) => o.at },
    { key: 'driver', label: 'المندوب', render: (o) => <strong>{o.driver?.name}</strong>, sort: (o) => o.driver?.name ?? '' },
    { key: 'goods', label: 'ماذا', render: (o) => <>{o.goods}<small>{o.id}، {o.suppliers.map((s) => s.name).join('، ')}</small></>, sort: (o) => o.rows.length },
    { key: 'client', label: 'لمن', render: (o) => <>{o.client}<small>{o.zone}</small></>, sort: (o) => o.client },
    { key: 'status', label: 'الحالة', render: (o) => <StatusPill status={o.status} />, sort: (o) => STATUS_ORDER.indexOf(o.status) },
    { key: 'took', label: 'المدة', right: true, render: (o) => o.closed ? fmtDuration(o.closed - o.at) : <span className="muted">في الطريق</span>, sort: (o) => (o.closed ? o.closed - o.at : Infinity) },
  ]
  const driverCols: Col<(typeof driverStats)[number]>[] = [
    { key: 'name', label: 'المندوب', render: (d) => <><strong>{d.name}</strong><small>{d.zone}</small></>, sort: (d) => d.name },
    { key: 'orders', label: 'الطلبات', right: true, render: (d) => fmtNum(d.orders), sort: (d) => d.orders },
    { key: 'units', label: 'الوحدات', right: true, render: (d) => fmtNum(d.units), sort: (d) => d.units },
    { key: 'picked', label: 'تم الاستلام', right: true, render: (d) => fmtNum(d.picked), sort: (d) => d.picked },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (d) => fmtNum(d.delivered), sort: (d) => d.delivered },
    { key: 'failed', label: 'فشل', right: true, render: (d) => fmtNum(d.failed), sort: (d) => d.failed },
    { key: 'denied', label: 'رفض', right: true, render: (d) => fmtNum(d.denied), sort: (d) => d.denied },
    { key: 'rate', label: 'نسبة النجاح', right: true, render: (d) => (d.rate < 0 ? <span className="muted">لا بيانات</span> : fmtPct(d.rate)), sort: (d) => d.rate },
    { key: 'time', label: 'متوسط الوقت', right: true, render: (d) => (d.time < 0 ? <span className="muted">لا بيانات</span> : fmtDuration(d.time)), sort: (d) => d.time },
    { key: 'value', label: 'قيمة التوصيل', right: true, render: (d) => fmtMoney(d.value), sort: (d) => d.value },
  ]
  const supplierCols: Col<(typeof supplierStats)[number]>[] = [
    { key: 'name', label: 'المورد', render: (s) => <><strong>{s.name}</strong><small>{s.category}</small></>, sort: (s) => s.name },
    { key: 'invoices', label: 'الفواتير', right: true, render: (s) => fmtNum(s.invoices), sort: (s) => s.invoices },
    { key: 'spend', label: 'الإنفاق', right: true, render: (s) => fmtMoney(s.spend), sort: (s) => s.spend },
    { key: 'orders', label: 'طلبات مقسَّمة', right: true, render: (s) => fmtNum(s.orders), sort: (s) => s.orders },
    { key: 'units', label: 'الوحدات', right: true, render: (s) => fmtNum(s.units), sort: (s) => s.units },
    { key: 'delivered', label: 'تم التوصيل', right: true, render: (s) => fmtNum(s.delivered), sort: (s) => s.delivered },
    { key: 'value', label: 'قيمة الطلبات', right: true, render: (s) => fmtMoney(s.value), sort: (s) => s.value },
  ]

  const exportCsv = () => {
    if (tab === 'picks') {
      downloadCsv('pickup-log', [['وقت الاستلام', 'المندوب', 'الطلب', 'الفواتير', 'الأصناف', 'الكمية', 'الموردون', 'العميل', 'المنطقة', 'الحالة', 'وقت الإغلاق'],
        ...picks.map((o) => [fmtDateTime(o.at), o.driver?.name ?? '', o.id, o.invoiceIds.join(' '), o.goods, o.quantity, o.suppliers.map((s) => s.name).join('، '), o.client, o.zone, STATUS_LABEL[o.status], o.closed ? fmtDateTime(o.closed) : ''])])
    } else if (tab === 'drivers') {
      downloadCsv('delivery-men', [['المندوب', 'المنطقة', 'الطلبات', 'الوحدات', 'تم الاستلام', 'تم التوصيل', 'فشل', 'رفض', 'نسبة النجاح %', 'قيمة التوصيل'],
        ...driverStats.map((d) => [d.name, d.zone, d.orders, d.units, d.picked, d.delivered, d.failed, d.denied, d.rate < 0 ? '' : Math.round(d.rate), d.value])])
    } else if (tab === 'suppliers') {
      downloadCsv('suppliers', [['المورد', 'الفئة', 'الفواتير', 'الإنفاق', 'طلبات مقسَّمة', 'الوحدات', 'تم التوصيل', 'قيمة الطلبات'],
        ...supplierStats.map((s) => [s.name, s.category, s.invoices, s.spend, s.orders, s.units, s.delivered, Math.round(s.value)])])
    } else {
      downloadCsv('orders', [['الطلب', 'الحالة', 'الفواتير', 'الأصناف', 'الكمية', 'الموردون', 'العميل', 'المنطقة', 'المندوب', 'السعر', 'تاريخ الإنشاء'],
        ...rows.map((o) => [o.id, STATUS_LABEL[o.status], o.invoiceIds.join(' '), o.goods, o.quantity, o.suppliers.map((s) => s.name).join('، '), o.client, o.zone, o.driver?.name ?? '', o.price, fmtDateTime(o.createdAt)])])
    }
  }

  const noMatch = <><h2>لا توجد نتائج مطابقة</h2><p>جرّب فترة أطول أو امسح الفلاتر.</p></>
  const activeFilters = active
  return (
    <>
      <PageHead title="التقارير" count={`${fmtCount(rows.length, ORDERS)} في هذا العرض`}>
        {can('reports', 'export') && <Button onClick={exportCsv}><Download size={17} aria-hidden />تصدير CSV</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} chips={parsed.chips} placeholder="اسأل بكلماتك، مثل: مين استلم أرز الأسبوع الماضي" />
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
      {tab === 'picks' && <Table key="picks" rows={picks} cols={pickCols} rowKey={(o) => o.id} sort={{ key: 'at', dir: -1 }} empty={noMatch} />}
      {tab === 'drivers' && <Table key="drivers" rows={driverStats} cols={driverCols} rowKey={(d) => d.id} sort={{ key: 'delivered', dir: -1 }} empty={noMatch} />}
      {tab === 'suppliers' && <Table key="suppliers" rows={supplierStats} cols={supplierCols} rowKey={(s) => s.id} sort={{ key: 'value', dir: -1 }} empty={noMatch} />}
    </>
  )
}
