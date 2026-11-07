import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Pencil, Plus } from 'lucide-react'
import { useStore } from '../store'
import { STATUS_LABEL, STATUS_ORDER, orderRows, productTotals, statusCounts, type OrderRow } from '../lib/domain'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { orderText, textSearch } from '../lib/search'
import { Button, FilterBar, PageHead, SearchBox, Select, Table, useFilters, type Col } from '../components/ui'
import { OrderForm } from '../components/OrderForm'
import { OrderDetail } from '../components/OrderDetail'
import { InvoiceForm } from '../components/InvoiceForm'
import { Progress } from './Stock'

const DEFAULTS = { q: '', status: '' }

export function StockInvoice() {
  const { id } = useParams()
  const { db, can } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [adding, setAdding] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const invoice = db.invoices.find((p) => p.id === id)
  const orders = useMemo(() => orderRows(db).filter((o) => o.invoiceId === id), [db, id])

  if (!invoice) {
    return (
      <div className="empty empty-page">
        <h1>لم يتم العثور على الفاتورة</h1>
        <p><Link to="/stock">العودة إلى المخزون</Link></p>
      </div>
    )
  }
  const supplier = db.suppliers.find((s) => s.id === invoice.supplierId)
  const totals = productTotals(orders)
  const counts = statusCounts(orders)
  const rows = orders.filter((o) => (!f.status || o.status === f.status) && textSearch(orderText(o), f.q))
  const cols: Col<OrderRow>[] = [
    { key: 'id', label: 'الطلب', render: (o) => <><strong className="id">{o.id}</strong>{o.code && <small dir="ltr">{o.code}</small>}</>, sort: (o) => o.id },
    { key: 'status', label: 'الحالة', render: (o) => <>{STATUS_LABEL[o.status]}{o.refund && <small className="reason-text">{o.refund.reason}</small>}</>, sort: (o) => STATUS_ORDER.indexOf(o.status) },
    { key: 'goods', label: 'الأصناف', render: (o) => o.goods, sort: (o) => o.items.length },
    { key: 'client', label: 'العميل', render: (o) => <>{o.client}<small>{o.zone}، <span dir="ltr">{o.phone}</span></small></>, sort: (o) => o.client },
    { key: 'driver', label: 'المندوب', render: (o) => o.driver?.name ?? <span className="muted">غير مسند</span>, sort: (o) => o.driver?.name ?? '' },
    { key: 'price', label: 'السعر', right: true, render: (o) => <>{fmtMoney(o.price)}<small>+ {fmtMoney(o.fee)}</small></>, sort: (o) => o.price },
    { key: 'created', label: 'تاريخ الإنشاء', render: (o) => fmtDateTime(o.createdAt), sort: (o) => o.createdAt },
  ]
  const editOrder = editing ? db.orders.find((o) => o.id === editing) : undefined

  return (
    <>
      <p className="back"><Link to="/stock"><ArrowRight size={16} aria-hidden />كل المخزون</Link></p>
      <PageHead title={invoice.id} count={`فاتورة من ${supplier?.name}، بتاريخ ${fmtDate(invoice.date)}${invoice.note ? `، ${invoice.note}` : ''}`}>
        {can('stock', 'edit') && <Button onClick={() => setEditingInvoice(true)}><Pencil size={16} aria-hidden />تعديل الفاتورة</Button>}
        {can('orders', 'create') && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={17} aria-hidden />إضافة طلب للفاتورة</Button>}
      </PageHead>

      <section className="load">
        <div className="load-numbers">
          <p><b>{fmtNum(orders.length)}</b> طلبات</p>
          <p><b>{fmtMoney(orders.reduce((n, o) => n + o.price, 0))}</b> إجمالي سعر الطلبات</p>
          <p><b>{fmtMoney(orders.reduce((n, o) => n + o.fee, 0))}</b> رسوم التوصيل</p>
          <p><b>{fmtNum(totals.reduce((n, t) => n + t.quantity, 0))}</b> قطعة</p>
        </div>
        <Progress counts={counts} />
        <h2 className="totals-head">إجمالي كل صنف</h2>
        <ul className="totals">
          {totals.map((t) => <li key={t.key}><span>{t.product}<small>{t.category}</small></span><b>× {fmtNum(t.quantity)}</b></li>)}
        </ul>
      </section>

      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث في طلبات الفاتورة بالعميل أو الكود أو الصنف أو المندوب" />
      <FilterBar active={active} onClear={clear}>
        <Select label="الحالة" all="كل الحالات" value={f.status} onChange={(status) => set({ status })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(o) => o.id} onRow={(o) => setDetail(o.id)} sort={{ key: 'created', dir: -1 }}
        empty={orders.length === 0
          ? <><h2>لا توجد طلبات في هذه الفاتورة</h2><p>أضف طلبات العملاء التي وصلت مع هذه الفاتورة.</p></>
          : <><h2>لا توجد طلبات مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></>} />

      {adding && <OrderForm invoice={invoice} onClose={() => setAdding(false)} />}
      {editingInvoice && <InvoiceForm item={invoice} onClose={() => setEditingInvoice(false)} />}
      {detail && <OrderDetail key={detail} orderId={detail} onClose={() => setDetail(null)} onEdit={can('orders', 'edit') ? () => { setEditing(detail); setDetail(null) } : undefined} />}
      {editOrder && <OrderForm order={editOrder} onClose={() => setEditing(null)} />}
    </>
  )
}
