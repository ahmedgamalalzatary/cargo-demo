import { useMemo, useState } from 'react'
import { MapPin, PackageCheck, Phone, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { ZONES, assignedAt, moveOrder, orderRows, refundOrder, type OrderRow } from '../lib/domain'
import { ORDERS, fmtCount, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { orderText, textSearch } from '../lib/search'
import { Button, FilterBar, PageHead, PeriodFilter, SearchBox, Select, StatusPill, useFilters } from '../components/ui'
import { RefundDialog } from '../components/RefundDialog'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', zone: '' }

/* An assigned order is already the delivery man's: he delivers it, or brings it back with a reason. */
export function MyOrders() {
  const { db, setDb, driver, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [refunding, setRefunding] = useState<OrderRow | null>(null)
  const me = driver?.id
  const mine = useMemo(() => orderRows(db).filter((o) => o.driverId === me && o.status === 'assigned'), [db, me])
  const cards = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return mine
      .map((order) => ({ order, at: assignedAt(order) ?? order.createdAt }))
      .filter((c) => inRange(c.at, range) && (!f.zone || c.order.zone === f.zone) && textSearch(orderText(c.order), f.q))
      .sort((a, b) => b.at - a.at)
  }, [mine, f.period, f.from, f.to, f.zone, f.q])

  if (!driver) return null
  const deliver = (o: OrderRow) => {
    setDb((d) => ({ ...d, orders: d.orders.map((x) => (x.id === o.id ? moveOrder(x, 'delivered', driver.name) : x)) }))
    toast(`تم توصيل ${o.id}`)
  }
  const total = mine.reduce((n, o) => n + o.collect, 0)

  return (
    <>
      <PageHead title="طلباتي" count={`أهلًا ${driver.name}، ${mine.length ? `معك ${fmtCount(mine.length, ORDERS)} للتوصيل، تحصيل ${fmtMoney(total)}` : 'لا توجد طلبات معك الآن'}`} />
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالعميل أو الصنف أو العنوان أو رقم الطلب" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter label="أُسند خلال" period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>

      {cards.length === 0 ? (
        <div className="empty">
          <h2>{mine.length ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات معك'}</h2>
          <p>{mine.length ? 'غيّر البحث أو امسح الفلاتر.' : 'ستظهر هنا الطلبات التي يسندها إليك موظف التوزيع.'}</p>
        </div>
      ) : (
        <ul className="job-list">
          {cards.map(({ order: o, at }) => (
            <li className="job" key={o.id}>
              <header className="job-head">
                <strong className="id">{o.id}</strong>
                <StatusPill status={o.status} />
                <b className="job-price">تحصيل {fmtMoney(o.collect)}</b>
              </header>
              <ul className="item-list">
                {o.items.map((i) => <li key={`${i.product}|${i.category}`}><span><b>{fmtNum(i.quantity)} ×</b> {i.product}</span></li>)}
              </ul>
              <dl className="job-facts">
                <div><dt><MapPin size={15} aria-label="العنوان" /></dt><dd>{o.client}، {o.address}</dd></div>
                <div><dt><Phone size={15} aria-label="الهاتف" /></dt><dd><a dir="ltr" href={`tel:${o.phone}`}>{o.phone}</a></dd></div>
              </dl>
              <p className="job-time">أُسند إليك {fmtDateTime(at)}، الطلب {fmtMoney(o.price)} + توصيل {fmtMoney(o.fee)}</p>
              <div className="job-actions">
                <Button variant="primary" onClick={() => deliver(o)}><PackageCheck size={17} aria-hidden />تم التوصيل</Button>
                <Button onClick={() => setRefunding(o)}><Undo2 size={17} aria-hidden />مرتجع</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {refunding && (
        <RefundDialog orderId={refunding.id} onClose={() => setRefunding(null)} onDone={(reason) => {
          setDb((d) => ({ ...d, orders: d.orders.map((x) => (x.id === refunding.id ? refundOrder(x, driver.name, reason) : x)) }))
          toast(`سُجّل ${refunding.id} كمرتجع وأُرسل السبب للمسؤول`)
          setRefunding(null)
        }} />
      )}
    </>
  )
}
