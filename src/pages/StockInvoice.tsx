import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Scissors } from 'lucide-react'
import { useStore } from '../store'
import { STATUS_LABEL, STATUS_ORDER, goodsText, invoiceCost, invoiceQty, orderRows, piecesOf, type OrderRow } from '../lib/domain'
import { ORDERS, fmtCount, fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format'
import { orderText, textSearch } from '../lib/search'
import { Button, FilterBar, PageHead, SearchBox, Select, StatusPill, Table, useFilters, type Col } from '../components/ui'
import { CutBar, StatusLegend } from '../components/CutBar'
import { OrderForm } from '../components/OrderForm'
import { OrderDetail } from '../components/OrderDetail'

const DEFAULTS = { q: '', status: '' }

export function StockInvoice() {
  const { id } = useParams()
  const { db, can } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [cutting, setCutting] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const invoice = db.invoices.find((p) => p.id === id)
  const orders = useMemo(() => orderRows(db).filter((o) => o.invoiceIds.includes(id ?? '')), [db, id])

  if (!invoice) {
    return (
      <div className="empty empty-page">
        <h1>لم يتم العثور على الفاتورة</h1>
        <p><Link to="/stock">العودة إلى المخزون</Link></p>
      </div>
    )
  }
  const supplier = db.suppliers.find((s) => s.id === invoice.supplierId)
  const pieces = piecesOf(orders, invoice.lines)
  const total = invoiceQty(invoice)
  const cut = pieces.reduce((n, p) => n + p.quantity, 0)
  const left = total - cut
  const rows = orders.filter((o) => (!f.status || o.status === f.status) && textSearch(orderText(o), f.q))
  /* An order can mix invoices, so show only what it takes from this one. */
  const fromHere = (o: OrderRow) => o.rows.filter((r) => r.invoice.id === invoice.id)
  const cols: Col<OrderRow>[] = [
    { key: 'id', label: 'الطلب', render: (o) => <strong className="id">{o.id}</strong>, sort: (o) => o.id },
    { key: 'status', label: 'الحالة', render: (o) => <StatusPill status={o.status} />, sort: (o) => STATUS_ORDER.indexOf(o.status) },
    { key: 'goods', label: 'من هذه الفاتورة', render: (o) => goodsText(fromHere(o)), sort: (o) => fromHere(o).length },
    { key: 'client', label: 'العميل', render: (o) => <>{o.client}<small>{o.zone}</small></>, sort: (o) => o.client },
    { key: 'driver', label: 'المندوب', render: (o) => o.driver?.name ?? <span className="muted">غير مسند</span>, sort: (o) => o.driver?.name ?? '' },
    { key: 'price', label: 'سعر الطلب', right: true, render: (o) => fmtMoney(o.price), sort: (o) => o.price },
    { key: 'cut', label: 'تاريخ الإنشاء', render: (o) => fmtDateTime(o.createdAt), sort: (o) => o.createdAt },
  ]
  const editOrder = editing ? db.orders.find((o) => o.id === editing) : undefined

  return (
    <>
      <p className="back"><Link to="/stock"><ArrowRight size={16} aria-hidden />كل المخزون</Link></p>
      <PageHead title={invoice.id} count={`فاتورة من ${supplier?.name}، بتاريخ ${fmtDate(invoice.date)}${invoice.note ? `، ${invoice.note}` : ''}`}>
        {can('orders', 'create') && left > 0 && <Button variant="primary" onClick={() => setCutting(true)}><Scissors size={17} aria-hidden />طلب جديد من هذه الفاتورة</Button>}
      </PageHead>

      <section className="load">
        <div className="load-numbers">
          <p><b>{fmtNum(total)}</b> الوحدات المشتراة</p>
          <p><b>{fmtNum(cut)}</b> مقسَّمة إلى {fmtCount(pieces.length, ORDERS)}</p>
          <p><b>{fmtNum(left)}</b> متاحة للتقسيم</p>
          <p><b>{fmtMoney(invoiceCost(invoice))}</b> إجمالي الفاتورة</p>
        </div>
        <ul className="invoice-lines">
          {invoice.lines.map((l) => {
            const own = piecesOf(orders, [l])
            const used = own.reduce((n, p) => n + p.quantity, 0)
            return (
              <li key={l.id}>
                <div className="invoice-line-head">
                  <strong>{l.product}</strong>
                  <span>{fmtNum(l.quantity)} {l.unit} × {fmtMoney(l.unitCost)} = {fmtMoney(l.quantity * l.unitCost)}</span>
                  <span className="muted">متاح {fmtNum(l.quantity - used)}</span>
                </div>
                <CutBar total={l.quantity} pieces={own} large onSegment={setDetail} />
              </li>
            )
          })}
        </ul>
        <StatusLegend uncut />
      </section>

      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث في هذه الطلبات بالعميل أو المنطقة أو المندوب" />
      <FilterBar active={active} onClear={clear}>
        <Select label="الحالة" all="كل الحالات" value={f.status} onChange={(status) => set({ status })} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(o) => o.id} onRow={(o) => setDetail(o.id)} sort={{ key: 'cut', dir: -1 }}
        empty={orders.length === 0
          ? <><h2>لم يتم التقسيم بعد</h2><p>أنشئ الطلب الأول لتبدأ في إرسال هذه الأصناف إلى العملاء.</p></>
          : <><h2>لا توجد طلبات مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></>} />

      {cutting && <OrderForm invoice={invoice} onClose={() => setCutting(false)} />}
      {detail && <OrderDetail key={detail} orderId={detail} onClose={() => setDetail(null)} onEdit={can('orders', 'edit') ? () => { setEditing(detail); setDetail(null) } : undefined} />}
      {editOrder && <OrderForm order={editOrder} onClose={() => setEditing(null)} />}
    </>
  )
}
