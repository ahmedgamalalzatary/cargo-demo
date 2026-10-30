import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OrderStatus } from '../types'
import { useStore } from '../store'
import { STATUS_LABEL, moveOrder } from '../lib/domain'
import { fmtDateTime, fmtMoney, fmtQty } from '../lib/format'
import { Button, Drawer, StatusPill } from './ui'

export function OrderDetail({ orderId, onClose, onEdit }: { orderId: string; onClose: () => void; onEdit?: () => void }) {
  const { db, setDb, user, can, toast } = useStore()
  const [driverId, setDriverId] = useState('')
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || !user) return null
  const purchase = db.purchases.find((p) => p.id === order.purchaseId)
  const supplier = db.suppliers.find((s) => s.id === purchase?.supplierId)
  const driver = db.drivers.find((d) => d.id === order.driverId)
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
  const canAssign = edit && ['unassigned', 'assigned', 'failed'].includes(order.status)

  return (
    <Drawer title={order.id} onClose={onClose}>
      <div className="detail-top">
        <StatusPill status={order.status} />
        <strong className="detail-price">{fmtMoney(order.price)}</strong>
      </div>
      <dl className="facts">
        <dt>البضاعة</dt><dd>{fmtQty(order.quantity, purchase?.unit ?? '')} من {purchase?.product}</dd>
        <dt>مقسَّم من</dt><dd>{can('purchases', 'view') ? <Link to={`/purchases/${order.purchaseId}`}>{order.purchaseId}</Link> : order.purchaseId}</dd>
        <dt>المورد</dt><dd>{supplier?.name}</dd>
        <dt>العميل</dt><dd>{order.client}<br /><a dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a></dd>
        <dt>التوصيل إلى</dt><dd>{order.address}</dd>
        <dt>المندوب</dt><dd>{driver ? <>{driver.name}<br /><a dir="ltr" href={`tel:${driver.phone}`}>{driver.phone}</a></> : 'لم يُسند بعد'}</dd>
      </dl>

      {edit && order.status !== 'delivered' && (
        <section className="detail-actions">
          {order.status === 'assigned' && <Button variant="primary" onClick={() => move('picked')}>تأكيد الاستلام</Button>}
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
              <Button variant={order.status === 'assigned' ? 'plain' : 'primary'} disabled={!driverId} onClick={assign}>{order.driverId ? 'إعادة الإسناد' : 'إسناد'}</Button>
            </div>
          )}
        </section>
      )}

      <h3 className="detail-h">السجل</h3>
      <ol className="timeline">
        {[...order.events].reverse().map((e, i) => (
          <li key={i}>
            <i className={`seg seg-${e.status}`} />
            <div>
              <strong>{e.status === 'unassigned' && !e.note ? 'تم التقسيم من عملية الشراء' : e.note ?? STATUS_LABEL[e.status]}</strong>
              <span>{fmtDateTime(e.at)}، بواسطة {e.by}</span>
            </div>
          </li>
        ))}
      </ol>
      {onEdit && <p className="detail-edit"><Button onClick={onEdit}>تعديل بيانات الطلب</Button></p>}
    </Drawer>
  )
}
