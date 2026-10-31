import { useMemo, useState, type FormEvent } from 'react'
import { Check, MapPin, PackageCheck, Phone, Truck, TriangleAlert, X } from 'lucide-react'
import type { OrderStatus } from '../types'
import { useStore } from '../store'
import { ZONES, moveOrder, orderRows, type OrderRow } from '../lib/domain'
import { ORDERS, fmtCount, fmtDateTime, fmtMoney, fmtQty } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { orderText, textSearch } from '../lib/search'
import { Button, Drawer, Field, FilterBar, PageHead, PeriodFilter, SearchBox, Select, StatusPill, useFilters } from '../components/ui'

const DEFAULTS = { tab: 'pending', q: '', period: 'all', from: '', to: '', zone: '' }
const TABS = [['pending', 'بانتظار ردي'], ['accepted', 'مقبولة'], ['denied', 'مرفوضة']] as const
const DENY_REASONS = ['خارج منطقتي اليوم', 'المركبة لا تتحمل الحمولة', 'لدي طلبات كثيرة الآن']
const FAIL_REASONS = ['العميل لا يرد', 'العنوان خطأ', 'العميل رفض الاستلام']

interface Card { order: OrderRow; at: number; reason?: string }
type Ask = { order: OrderRow; kind: 'denied' | 'failed' }

function ReasonDialog({ ask, onClose, onDone }: { ask: Ask; onClose: () => void; onDone: (reason: string) => void }) {
  const reasons = ask.kind === 'denied' ? DENY_REASONS : FAIL_REASONS
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const reason = choice === 'other' ? other.trim() : choice
    if (!reason) { setError('اذكر السبب ليعرفه موظف التوزيع.'); return }
    onDone(reason)
  }
  return (
    <Drawer title={ask.kind === 'denied' ? `رفض ${ask.order.id}` : `فشل توصيل ${ask.order.id}`} onClose={onClose}
      footer={<><Button onClick={onClose}>رجوع</Button><Button variant="danger" type="submit" form="reason-form">{ask.kind === 'denied' ? 'رفض الطلب' : 'تسجيل الفشل'}</Button></>}>
      <form id="reason-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="السبب" full error={choice !== 'other' ? error : undefined}>
          <select value={choice} onChange={(e) => { setChoice(e.target.value); setError('') }}>
            <option value="">اختر السبب</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
            <option value="other">سبب آخر</option>
          </select>
        </Field>
        {choice === 'other' && <Field label="اكتب السبب" full error={error}><input value={other} onChange={(e) => { setOther(e.target.value); setError('') }} /></Field>}
      </form>
    </Drawer>
  )
}

export function MyOrders() {
  const { db, setDb, driver, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [ask, setAsk] = useState<Ask | null>(null)
  const me = driver?.id
  const all = useMemo(() => orderRows(db), [db])

  const groups = useMemo(() => {
    const lastAt = (o: OrderRow) => o.events[o.events.length - 1].at
    const mine = all.filter((o) => o.driverId === me)
    return {
      pending: mine.filter((o) => o.status === 'assigned').map((order): Card => ({ order, at: lastAt(order) })),
      accepted: mine.filter((o) => o.status === 'accepted' || o.status === 'picked').map((order): Card => ({ order, at: lastAt(order) })),
      denied: all.flatMap((order) => order.events
        .filter((e) => e.status === 'denied' && e.driverId === me)
        .map((e): Card => ({ order, at: e.at, reason: e.note }))),
    }
  }, [all, me])

  const tab = f.tab as (typeof TABS)[number][0]
  const cards = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return groups[tab]
      .filter((c) => inRange(c.at, range) && (!f.zone || c.order.zone === f.zone) && textSearch(orderText(c.order), f.q))
      .sort((a, b) => b.at - a.at)
  }, [groups, tab, f.period, f.from, f.to, f.zone, f.q])

  if (!driver) return null
  const move = (order: OrderRow, status: OrderStatus, message: string, note?: string) => {
    setDb((d) => ({ ...d, orders: d.orders.map((o) => (o.id === order.id ? moveOrder(o, status, driver.name, status === 'denied' ? null : undefined, note) : o)) }))
    toast(message)
  }

  return (
    <>
      <PageHead title="طلباتي" count={`أهلًا ${driver.name}، ${groups.pending.length ? `لديك ${fmtCount(groups.pending.length, ORDERS)} بانتظار ردك` : 'لا توجد طلبات بانتظار ردك'}`} />
      <div className="tabs" role="tablist" aria-label="طلباتي">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => set({ tab: id })}>{label} <span className="tab-count">{groups[id].length}</span></button>
        ))}
      </div>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالعميل أو الصنف أو العنوان أو رقم الطلب" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المنطقة" all="كل المناطق" value={f.zone} onChange={(zone) => set({ zone })} options={ZONES.map((z) => ({ value: z, label: z }))} />
      </FilterBar>

      {cards.length === 0 ? (
        <div className="empty">
          <h2>{groups[tab].length ? 'لا توجد طلبات مطابقة' : tab === 'pending' ? 'لا توجد طلبات جديدة' : tab === 'accepted' ? 'لا توجد طلبات مقبولة الآن' : 'لم ترفض أي طلب'}</h2>
          <p>{groups[tab].length ? 'غيّر البحث أو امسح الفلاتر.' : tab === 'pending' ? 'ستظهر هنا الطلبات التي يسندها إليك موظف التوزيع.' : 'اقبل طلبًا من تبويب "بانتظار ردي" ليظهر هنا.'}</p>
        </div>
      ) : (
        <ul className="job-list">
          {cards.map(({ order: o, at, reason }) => (
            <li className="job" key={`${o.id}-${at}`}>
              <header className="job-head">
                <strong className="id">{o.id}</strong>
                {tab === 'denied' ? <span className="pill pill-denied">رفضته</span> : <StatusPill status={o.status} />}
                <b className="job-price">{tab === 'denied' ? fmtMoney(o.price) : `تحصيل ${fmtMoney(o.price)}`}</b>
              </header>
              <ul className="item-list">
                {o.rows.map((r) => <li key={r.line.id}><span><b>{fmtQty(r.quantity, r.line.unit)}</b> {r.line.product}</span></li>)}
              </ul>
              <dl className="job-facts">
                <div><dt><MapPin size={15} aria-label="العنوان" /></dt><dd>{o.client}، {o.address}</dd></div>
                {tab !== 'denied' && <div><dt><Phone size={15} aria-label="الهاتف" /></dt><dd><a dir="ltr" href={`tel:${o.phone}`}>{o.phone}</a></dd></div>}
              </dl>
              {reason && <p className="notice">السبب: {reason}</p>}
              <p className="job-time">{tab === 'denied' ? 'رفضته في' : 'آخر تحديث'} {fmtDateTime(at)}</p>
              {tab !== 'denied' && (
                <div className="job-actions">
                  {o.status === 'assigned' && (
                    <>
                      <Button variant="primary" onClick={() => move(o, 'accepted', `قبلت ${o.id}`)}><Check size={17} aria-hidden />قبول</Button>
                      <Button onClick={() => setAsk({ order: o, kind: 'denied' })}><X size={17} aria-hidden />رفض</Button>
                    </>
                  )}
                  {o.status === 'accepted' && <Button variant="primary" onClick={() => move(o, 'picked', `استلمت بضاعة ${o.id}`)}><Truck size={17} aria-hidden />استلمت البضاعة</Button>}
                  {o.status === 'picked' && (
                    <>
                      <Button variant="primary" onClick={() => move(o, 'delivered', `تم توصيل ${o.id}`)}><PackageCheck size={17} aria-hidden />تم التوصيل</Button>
                      <Button onClick={() => setAsk({ order: o, kind: 'failed' })}><TriangleAlert size={17} aria-hidden />فشل التوصيل</Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {ask && (
        <ReasonDialog ask={ask} onClose={() => setAsk(null)} onDone={(reason) => {
          move(ask.order, ask.kind, ask.kind === 'denied' ? `رفضت ${ask.order.id} وعاد إلى موظف التوزيع` : `سُجّل فشل توصيل ${ask.order.id}`, reason)
          setAsk(null)
        }} />
      )}
    </>
  )
}
