import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Scissors } from 'lucide-react'
import { useStore } from '../store'
import { STATUS_LABEL, STATUS_ORDER, orderRows, sumQty, type OrderRow } from '../lib/domain'
import { ORDERS, fmtCount, fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { textSearch } from '../lib/search'
import { orderText } from '../lib/search'
import { Button, FilterBar, PageHead, SearchBox, Select, StatusPill, Table, useFilters, type Col } from '../components/ui'
import { CutBar, StatusLegend } from '../components/CutBar'
import { OrderForm } from '../components/OrderForm'
import { OrderDetail } from '../components/OrderDetail'

const DEFAULTS = { q: '', status: '' }

export function PurchaseDetail() {
  const { id } = useParams()
  const { db, can } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [cutting, setCutting] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const purchase = db.purchases.find((p) => p.id === id)
  const orders = useMemo(() => orderRows(db).filter((o) => o.purchaseId === id), [db, id])

  if (!purchase) {
    return (
      <div className="empty empty-page">
        <h1>لم يتم العثور على عملية الشراء</h1>
        <p><Link to="/purchases">العودة إلى كل المشتريات</Link></p>
      </div>
    )
  }
  const supplier = db.suppliers.find((s) => s.id === purchase.supplierId)
  const cut = sumQty(orders)
  const left = purchase.quantity - cut
  const revenue = orders.reduce((n, o) => n + o.price, 0)
  const rows = orders.filter((o) => (!f.status || o.status === f.status) && textSearch(orderText(o), f.q))
  const cols: Col<OrderRow>[] = [
    { key: 'id', label: 'الطلب', render: (o) => <strong className="id">{o.id}</strong>, sort: (o) => o.id },
    { key: 'status', label: 'الحالة', render: (o) => <StatusPill status={o.status} />, sort: (o) => STATUS_ORDER.indexOf(o.status) },
    { key: 'qty', label: 'الكمية', right: true, render: (o) => fmtNum(o.quantity), sort: (o) => o.quantity },
    { key: 'client', label: 'العميل', render: (o) => <>{o.client}<small>{o.zone}</small></>, sort: (o) => o.client },
    { key: 'driver', label: 'المندوب', render: (o) => o.driver?.name ?? <span className="muted">غير مسند</span>, sort: (o) => o.driver?.name ?? '' },
    { key: 'price', label: 'السعر', right: true, render: (o) => fmtMoney(o.price), sort: (o) => o.price },
    { key: 'cut', label: 'تاريخ التقسيم', render: (o) => fmtDateTime(o.createdAt), sort: (o) => o.createdAt },
  ]
  const editOrder = editing ? db.orders.find((o) => o.id === editing) : undefined

  return (
    <>
      <p className="back"><Link to="/purchases"><ArrowRight size={16} aria-hidden />كل المشتريات</Link></p>
      <PageHead title={purchase.id} count={`${purchase.product} من ${supplier?.name}، تم الشراء في ${fmtDate(purchase.date)}`}>
        {can('orders', 'create') && left > 0 && <Button variant="primary" onClick={() => setCutting(true)}><Scissors size={17} aria-hidden />تقسيم طلب جديد</Button>}
      </PageHead>

      <section className="load">
        <div className="load-numbers">
          <p><b>{fmtNum(purchase.quantity)}</b> الكمية المشتراة ({purchase.unit})</p>
          <p><b>{fmtNum(cut)}</b> مقسَّمة إلى {fmtCount(orders.length, ORDERS)}</p>
          <p><b>{fmtNum(left)}</b> متبقية للتقسيم</p>
          <p><b>{fmtMoney(purchase.quantity * purchase.unitCost)}</b> التكلفة</p>
          <p><b>{fmtMoney(revenue)}</b> قيمة الطلبات</p>
        </div>
        <CutBar total={purchase.quantity} orders={orders} large onSegment={(o) => setDetail(o.id)} />
        <StatusLegend uncut />
      </section>

      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث في هذه الطلبات بالعميل أو المنطقة أو المندوب" />
      <FilterBar active={active} onClear={clear}>
        <Select label="الحالة" all="كل الحالات" value={f.status} onChange={(status) => set({ status })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(o) => o.id} onRow={(o) => setDetail(o.id)} sort={{ key: 'cut', dir: -1 }}
        empty={orders.length === 0
          ? <><h2>لم يتم التقسيم بعد</h2><p>قسّم الطلب الأول لتبدأ في إرسال هذه الشحنة إلى العملاء.</p></>
          : <><h2>لا توجد طلبات مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></>} />

      {cutting && <OrderForm purchase={purchase} onClose={() => setCutting(false)} />}
      {detail && <OrderDetail key={detail} orderId={detail} onClose={() => setDetail(null)} onEdit={can('orders', 'edit') ? () => { setEditing(detail); setDetail(null) } : undefined} />}
      {editOrder && <OrderForm order={editOrder} onClose={() => setEditing(null)} />}
    </>
  )
}
