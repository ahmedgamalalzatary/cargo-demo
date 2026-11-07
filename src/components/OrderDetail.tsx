import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Order } from '../types'
import { useStore } from '../store'
import { ASSIGNABLE, RETURN_LABEL, STATUS_LABEL, confirmReturn, moveOrder, orderRows, refundOrder, returnState } from '../lib/domain'
import { fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { Button, Drawer, StatusPill, Timeline } from './ui'
import { RefundDialog } from './RefundDialog'

export function OrderDetail({ orderId, onClose, onEdit }: { orderId: string; onClose: () => void; onEdit?: () => void }) {
  const { db, setDb, user, can, toast } = useStore()
  const [driverId, setDriverId] = useState('')
  const [refunding, setRefunding] = useState(false)
  const order = useMemo(() => orderRows(db).find((o) => o.id === orderId), [db, orderId])
  if (!order || !user) return null
  const driver = order.driver
  const edit = can('orders', 'edit')
  const drivers = db.drivers.filter((d) => d.active && (d.id !== order.driverId || order.status === 'refunded'))
  const update = (fn: (o: Order) => Order, message: string) => {
    setDb((d) => ({ ...d, orders: d.orders.map((o) => (o.id === orderId ? fn(o) : o)) }))
    toast(message)
  }
  const assign = () => {
    const d = db.drivers.find((x) => x.id === driverId)
    if (!d) return
    update((o) => moveOrder(o, 'assigned', user.name, d.id, `أُسند إلى ${d.name}`), `تم إسناد ${order.id} إلى ${d.name}`)
    setDriverId('')
  }
  const canAssign = edit && ASSIGNABLE.includes(order.status)
  const ret = returnState(order)
  const refundBy = order.refund && db.drivers.find((d) => d.id === order.refund?.driverId)

  return (
    <Drawer title={order.id} onClose={onClose}>
      <div className="detail-top">
        <StatusPill status={order.status} />
        <strong className="detail-price">{fmtMoney(order.collect)}</strong>
      </div>
      {order.refund && (
        <div className="refund-box">
          <p><strong>سبب المرتجع:</strong> {order.refund.reason}</p>
          <p className="muted">سجّله {refundBy?.name ?? 'المندوب'} في {fmtDateTime(order.refund.at)}</p>
          <p>البضاعة: <span className={`ret-${ret}`}>{ret && RETURN_LABEL[ret]}</span></p>
          {edit && (
            <div className="refund-actions">
              <Button variant={ret === 'back' ? 'primary' : 'plain'} onClick={() => update((o) => confirmReturn(o, user.name, true), `${order.id}: رجعت البضاعة`)}>رجعت البضاعة</Button>
              <Button variant={ret === 'missing' ? 'danger' : 'plain'} onClick={() => update((o) => confirmReturn(o, user.name, false), `${order.id}: لم ترجع البضاعة`)}>لم ترجع</Button>
            </div>
          )}
        </div>
      )}
      <h3 className="detail-h">الأصناف</h3>
      <ul className="item-list">
        {order.items.map((i) => (
          <li key={`${i.product}|${i.category}`}><span><b>{fmtNum(i.quantity)} ×</b> {i.product}</span><small>{i.category}</small></li>
        ))}
      </ul>
      <dl className="facts">
        <dt>الفاتورة</dt><dd>{can('stock', 'view') ? <Link to={`/stock/${order.invoice.id}`}>{order.invoice.id}</Link> : order.invoice.id}، {order.supplier.name}{order.code && <><br /><span className="muted">كود الطلب <span dir="ltr">{order.code}</span></span></>}</dd>
        <dt>السعر</dt><dd>{fmtMoney(order.price)} + توصيل {fmtMoney(order.fee)}</dd>
        <dt>العميل</dt><dd>{order.client}<br /><a dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a></dd>
        <dt>التوصيل إلى</dt><dd>{order.address}، {order.zone}</dd>
        <dt>المندوب</dt><dd>{driver ? <>{driver.name}<br /><a dir="ltr" href={`tel:${driver.phone}`}>{driver.phone}</a></> : 'لم يُسند بعد'}</dd>
      </dl>

      {edit && order.status !== 'delivered' && (
        <section className="detail-actions">
          {order.status === 'assigned' && (
            <>
              <Button variant="primary" onClick={() => update((o) => moveOrder(o, 'delivered', user.name), `حالة ${order.id} الآن: ${STATUS_LABEL.delivered}`)}>تأكيد التوصيل</Button>
              <Button onClick={() => setRefunding(true)}>تسجيل مرتجع</Button>
            </>
          )}
          {canAssign && (
            <div className="assign-row">
              <label className="filter">
                <span>{order.driverId ? 'إعادة الإسناد إلى' : 'الإسناد إلى'}</span>
                <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">اختر مندوبًا</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}، {d.zone}</option>)}
                </select>
              </label>
              <Button variant={order.status === 'assigned' ? 'plain' : 'primary'} disabled={!driverId} onClick={assign}>{order.driverId ? 'إعادة الإسناد' : 'إسناد'}</Button>
            </div>
          )}
        </section>
      )}

      <h3 className="detail-h">السجل</h3>
      <Timeline events={order.events} />
      {onEdit && <p className="detail-edit"><Button onClick={onEdit}>تعديل بيانات الطلب</Button></p>}
      {refunding && (
        <RefundDialog orderId={order.id} onClose={() => setRefunding(false)} onDone={(reason) => {
          update((o) => refundOrder(o, user.name, reason), `سُجّل ${order.id} كمرتجع`)
          setRefunding(false)
        }} />
      )}
    </Drawer>
  )
}
