import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OrderStatus } from '../types'
import { useStore } from '../store'
import { ASSIGNABLE, STATUS_LABEL, moveOrder, orderRows } from '../lib/domain'
import { fmtMoney, fmtQty } from '../lib/format'
import { Button, Drawer, StatusPill, Timeline } from './ui'

export function OrderDetail({ orderId, onClose, onEdit }: { orderId: string; onClose: () => void; onEdit?: () => void }) {
  const { db, setDb, user, can, toast } = useStore()
  const [driverId, setDriverId] = useState('')
  const order = useMemo(() => orderRows(db).find((o) => o.id === orderId), [db, orderId])
  if (!order || !user) return null
  const driver = order.driver
  const edit = can('orders', 'edit')
  const drivers = db.drivers.filter((d) => d.active && d.id !== order.driverId)

  const move = (status: OrderStatus, id?: string, note?: string) => {
    setDb((d) => ({ ...d, orders: d.orders.map((o) => (o.id === orderId ? moveOrder(o, status, user.name, id, note) : o)) }))
    toast(`حالة ${order.id} الآن: ${STATUS_LABEL[status]}`)
  }
  const assign = () => {
    const d = db.drivers.find((x) => x.id === driverId)
    if (!d) return
    move('assigned', d.id, `أُسند إلى ${d.name}`)
    setDriverId('')
  }
  const canAssign = edit && ASSIGNABLE.includes(order.status)
  const lastDenial = order.status === 'denied' ? [...order.events].reverse().find((e) => e.status === 'denied') : undefined

  return (
    <Drawer title={order.id} onClose={onClose}>
      <div className="detail-top">
        <StatusPill status={order.status} />
        <strong className="detail-price">{fmtMoney(order.price)}</strong>
      </div>
      {lastDenial && <p className="notice">رفضه {lastDenial.by}: {lastDenial.note}. أسنده إلى مندوب آخر.</p>}
      <h3 className="detail-h">الأصناف</h3>
      <ul className="item-list">
        {order.rows.map((r) => (
          <li key={r.line.id}>
            <span><b>{fmtQty(r.quantity, r.line.unit)}</b> {r.line.product}</span>
            <small>{can('stock', 'view') ? <Link to={`/stock/${r.invoice.id}`}>{r.invoice.id}</Link> : r.invoice.id}، {r.supplier.name}</small>
          </li>
        ))}
      </ul>
      <dl className="facts">
        <dt>العميل</dt><dd>{order.client}<br /><a dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a></dd>
        <dt>التوصيل إلى</dt><dd>{order.address}</dd>
        <dt>المندوب</dt><dd>{driver ? <>{driver.name}<br /><a dir="ltr" href={`tel:${driver.phone}`}>{driver.phone}</a></> : 'لم يُسند بعد'}</dd>
      </dl>

      {edit && order.status !== 'delivered' && (
        <section className="detail-actions">
          {order.status === 'accepted' && <Button variant="primary" onClick={() => move('picked')}>تأكيد الاستلام</Button>}
          {order.status === 'picked' && (
            <>
              <Button variant="primary" onClick={() => move('delivered')}>تأكيد التوصيل</Button>
              <Button onClick={() => move('failed', undefined, 'سجّله موظف كفاشل')}>تسجيل فشل التوصيل</Button>
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
              <Button variant={order.status === 'assigned' || order.status === 'accepted' ? 'plain' : 'primary'} disabled={!driverId} onClick={assign}>{order.driverId ? 'إعادة الإسناد' : 'إسناد'}</Button>
            </div>
          )}
        </section>
      )}

      <h3 className="detail-h">السجل</h3>
      <Timeline events={order.events} />
      {onEdit && <p className="detail-edit"><Button onClick={onEdit}>تعديل بيانات الطلب</Button></p>}
    </Drawer>
  )
}
