import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { STATUS_LABEL, ZONES, orderRows, pickedAt, type OrderRow } from '../lib/domain'
import { fmtDateTime, fmtDuration, fmtMoney, fmtNum, fmtPct } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { orderText, textSearch } from '../lib/search'
import { Drawer, FilterBar, PageHead, PeriodFilter, SearchBox, Select, StatusPill, Table, Timeline, useFilters, type Col } from '../components/ui'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', status: '', zone: '' }
type Row = { key: string; order: OrderRow; at: number; status: 'delivered' | 'failed'; note?: string; took: number | null }

export function MyHistory() {
  const { db, driver } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [open, setOpen] = useState<Row | null>(null)
  const me = driver?.id

  /* Read from the order log, so a failed order stays here even after it goes to another delivery man. */
  const all = useMemo(() => orderRows(db).flatMap((order) => order.events.flatMap((e): Row[] => {
    if (e.driverId !== me || (e.status !== 'delivered' && e.status !== 'failed')) return []
    const picked = pickedAt({ ...order, events: order.events.filter((x) => x.at <= e.at) })
    return [{ key: `${order.id}-${e.at}`, order, at: e.at, status: e.status, note: e.note, took: picked ? e.at - picked : null }]
  })), [db, me])

  const rows = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return all.filter((r) =>
      inRange(r.at, range) &&
      (!f.status || r.status === f.status) &&
      (!f.zone || r.order.zone === f.zone) &&
      textSearch(orderText(r.order), f.q))
  }, [all, f])

  const delivered = rows.filter((r) => r.status === 'delivered')
  const closed = rows.length
  const tiles: [string, string][] = [
    [fmtNum(delivered.length), 'تم توصيله'],
    [fmtNum(closed - delivered.length), 'فشل توصيله'],
    [closed ? fmtPct((delivered.length / closed) * 100) : 'لا بيانات', 'نسبة النجاح'],
    [fmtMoney(delivered.reduce((n, r) => n + r.order.price, 0)), 'إجمالي التحصيل'],
  ]
  const cols: Col<Row>[] = [
    { key: 'at', label: 'وقت الإغلاق', render: (r) => fmtDateTime(r.at), sort: (r) => r.at },
    { key: 'id', label: 'الطلب', render: (r) => <strong className="id">{r.order.id}</strong>, sort: (r) => r.order.id },
    { key: 'status', label: 'النتيجة', render: (r) => <><StatusPill status={r.status} />{r.note && <small>{r.note}</small>}</>, sort: (r) => r.status },
    { key: 'goods', label: 'الأصناف', render: (r) => r.order.goods, sort: (r) => r.order.rows.length },
    { key: 'client', label: 'العميل', render: (r) => <>{r.order.client}<small>{r.order.zone}</small></>, sort: (r) => r.order.client },
    { key: 'took', label: 'المدة', right: true, render: (r) => (r.took === null ? <span className="muted">لا بيانات</span> : fmtDuration(r.took)), sort: (r) => r.took ?? -1 },
    { key: 'price', label: 'القيمة', right: true, render: (r) => fmtMoney(r.order.price), sort: (r) => r.order.price },
  ]

  return (
    <>
      <PageHead title="السجل" count="الطلبات التي أغلقتها، بالتوصيل أو الفشل" />
      <div className="tiles">{tiles.map(([v, l]) => <p key={l}><b>{v}</b>{l}</p>)}</div>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالعميل أو الصنف أو العنوان أو رقم الطلب" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="النتيجة" all="كل النتائج" value={f.status} onChange={(status) => set({ status })} options={(['delivered', 'failed'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(r) => r.key} onRow={setOpen} sort={{ key: 'at', dir: -1 }}
        empty={all.length ? <><h2>لا توجد نتائج مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></> : <><h2>لا يوجد سجل بعد</h2><p>ستظهر هنا الطلبات بعد توصيلها.</p></>} />
      {open && (
        <Drawer title={open.order.id} onClose={() => setOpen(null)}>
          <h3 className="detail-h">الأصناف</h3>
          <p>{open.order.goods}</p>
          <h3 className="detail-h">التوصيل إلى</h3>
          <p>{open.order.client}، {open.order.address}</p>
          <h3 className="detail-h">السجل</h3>
          <Timeline events={open.order.events.filter((e) => !e.driverId || e.driverId === me)} />
        </Drawer>
      )}
    </>
  )
}
