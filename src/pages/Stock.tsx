import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Invoice, Order } from '../types'
import { useStore } from '../store'
import { CATEGORIES, productTotals, statusCounts, unique, type ProductTotal, type StatusCounts } from '../lib/domain'
import { INVOICES, ORDERS, PRODUCTS, fmtCount, fmtDate, fmtMoney, fmtNum } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col } from '../components/ui'
import { InvoiceForm } from '../components/InvoiceForm'

const DEFAULTS = { tab: 'invoices', q: '', period: 'all', from: '', to: '', supplier: '', progress: '', category: '' }
const TABS = [['invoices', 'فواتير الشراء'], ['items', 'الأصناف']] as const
type Row = Invoice & { supplierName: string; orders: Order[]; counts: StatusCounts; qty: number; price: number; fees: number; products: string }
type Item = ProductTotal & { suppliers: string[] }

/** "8 تم التوصيل · 2 مرتجع · 3 مع المندوب", plain text so the page carries no status colours. */
export function Progress({ counts }: { counts: StatusCounts }) {
  const parts: [number, string][] = [[counts.delivered, 'تم التوصيل'], [counts.refunded, 'مرتجع'], [counts.assigned, 'مع المندوب'], [counts.unassigned, 'غير مسند']]
  const shown = parts.filter(([n]) => n > 0)
  return <span className="progress-text">{shown.length ? shown.map(([n, l], i) => <span key={l}>{i > 0 && ' · '}<b>{fmtNum(n)}</b> {l}</span>) : 'لا طلبات'}</span>
}

export function Stock() {
  const { db, setDb, can, toast } = useStore()
  const nav = useNavigate()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Invoice } | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const names = useMemo(() => new Map(db.suppliers.map((s) => [s.id, s.name])), [db.suppliers])

  const inView = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return db.invoices.filter((p) => inRange(p.date, range) && (!f.supplier || p.supplierId === f.supplier))
  }, [db.invoices, f.period, f.from, f.to, f.supplier])

  const byInvoice = useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of db.orders) map.set(o.invoiceId, [...(map.get(o.invoiceId) ?? []), o])
    return map
  }, [db.orders])

  const rows = useMemo<Row[]>(() => inView
    .map((p) => {
      const orders = byInvoice.get(p.id) ?? []
      return {
        ...p, supplierName: names.get(p.supplierId) ?? '', orders, counts: statusCounts(orders),
        qty: orders.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0),
        price: orders.reduce((n, o) => n + o.price, 0),
        fees: orders.reduce((n, o) => n + o.fee, 0),
        products: unique(orders.flatMap((o) => o.items.map((i) => i.product))).join('، '),
      }
    })
    .filter((p) =>
      (!f.progress || (f.progress === 'open') === (p.counts.unassigned + p.counts.assigned > 0)) &&
      textSearch(`${p.id} ${p.products} ${p.supplierName} ${p.note} ${p.orders.map((o) => `${o.code} ${o.client}`).join(' ')}`, f.q)), [inView, byInvoice, names, f.progress, f.q])

  /* One row per product and category, added up across every order of the invoices in view. */
  const items = useMemo<Item[]>(() => {
    const orders = inView.flatMap((p) => byInvoice.get(p.id) ?? [])
    const supplierOf = new Map(inView.map((p) => [p.id, names.get(p.supplierId) ?? '']))
    return productTotals(orders)
      .map((t) => ({ ...t, suppliers: unique(orders.filter((o) => o.items.some((i) => `${i.product.trim()}|${i.category}` === t.key)).map((o) => supplierOf.get(o.invoiceId) ?? '')) }))
      .filter((i) => (!f.category || i.category === f.category) && textSearch(`${i.product} ${i.category} ${i.suppliers.join(' ')}`, f.q))
  }, [inView, byInvoice, names, f.category, f.q])

  const canEdit = can('stock', 'edit')
  const canDelete = can('stock', 'delete')
  const cols: Col<Row>[] = [
    { key: 'id', label: 'الفاتورة', render: (p) => <><strong className="id">{p.id}</strong><small>{p.supplierName}</small></>, sort: (p) => p.id },
    { key: 'orders', label: 'الطلبات', render: (p) => <>{fmtCount(p.orders.length, ORDERS)}<small className="clamp">{p.products}</small></>, sort: (p) => p.orders.length },
    { key: 'progress', label: 'حالة الطلبات', render: (p) => <Progress counts={p.counts} />, sort: (p) => (p.orders.length ? p.counts.delivered / p.orders.length : -1) },
    { key: 'qty', label: 'القطع', right: true, render: (p) => fmtNum(p.qty), sort: (p) => p.qty },
    { key: 'price', label: 'الإجمالي', right: true, render: (p) => <>{fmtMoney(p.price)}<small>توصيل {fmtMoney(p.fees)}</small></>, sort: (p) => p.price },
    { key: 'date', label: 'التاريخ', render: (p) => fmtDate(p.date), sort: (p) => p.date },
  ]
  if (canEdit || canDelete) {
    cols.push({
      key: 'actions', label: '', right: true, render: (p) => (
        <RowActions>
          {canEdit && <IconButton label={`تعديل ${p.id}`} onClick={() => setForm({ item: p })}><Pencil size={16} /></IconButton>}
          {canDelete && <IconButton label={`حذف ${p.id}`} onClick={() => setRemoving(p)}><Trash2 size={16} /></IconButton>}
        </RowActions>
      ),
    })
  }
  const itemCols: Col<Item>[] = [
    { key: 'product', label: 'الصنف', render: (i) => <><strong>{i.product}</strong><small>{i.category}</small></>, sort: (i) => i.product },
    { key: 'quantity', label: 'الكمية', right: true, render: (i) => <strong>{fmtNum(i.quantity)}</strong>, sort: (i) => i.quantity },
    { key: 'delivered', label: 'تم توصيله', right: true, render: (i) => fmtNum(i.delivered), sort: (i) => i.delivered },
    { key: 'refunded', label: 'مرتجع', right: true, render: (i) => fmtNum(i.refunded), sort: (i) => i.refunded },
    { key: 'open', label: 'لم يُسلَّم بعد', right: true, render: (i) => fmtNum(i.open), sort: (i) => i.open },
    { key: 'orders', label: 'الطلبات', right: true, render: (i) => fmtNum(i.orders), sort: (i) => i.orders },
    { key: 'suppliers', label: 'الموردون', render: (i) => <small className="clamp">{i.suppliers.join('، ')}</small>, sort: (i) => i.suppliers.length },
  ]
  const onItems = f.tab === 'items'
  const count = onItems
    ? `${fmtCount(items.length, PRODUCTS)}، ${fmtNum(items.reduce((n, i) => n + i.quantity, 0))} قطعة`
    : `${fmtCount(rows.length, INVOICES)}، بإجمالي ${fmtMoney(rows.reduce((n, p) => n + p.price, 0))}`

  return (
    <>
      <PageHead title="المخزون" count={count}>
        {can('stock', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />فاتورة شراء جديدة</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder={onItems ? 'ابحث باسم الصنف أو الفئة أو المورد' : 'ابحث برقم الفاتورة أو الصنف أو المورد أو العميل أو كود الطلب'} />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        {onItems
          ? <Select label="الفئة" all="كل الفئات" value={f.category} onChange={(category) => set({ category })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          : <Select label="الحالة" all="الكل" value={f.progress} onChange={(progress) => set({ progress })} options={[{ value: 'open', label: 'فيها طلبات لم تُغلق' }, { value: 'done', label: 'كل طلباتها أُغلقت' }]} />}
      </FilterBar>
      <div className="tabs" role="tablist" aria-label="عرض المخزون">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={f.tab === id} onClick={() => set({ tab: id, progress: '', category: '' })}>{label}</button>)}
      </div>
      {onItems ? (
        <Table key="items" rows={items} cols={itemCols} rowKey={(i) => i.key} sort={{ key: 'quantity', dir: -1 }}
          empty={<><h2>لا توجد أصناف مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></>} />
      ) : (
        <Table key="invoices" rows={rows} cols={cols} rowKey={(p) => p.id} onRow={(p) => nav(`/stock/${p.id}`)} sort={{ key: 'date', dir: -1 }}
          empty={<><h2>لا توجد فواتير مطابقة</h2><p>غيّر البحث أو امسح الفلاتر لعرض فواتير أكثر.</p></>} />
      )}

      {form && <InvoiceForm item={form.item} onClose={() => setForm(null)} />}
      {removing && (removing.orders.some((o) => o.status !== 'unassigned') ? (
        <Confirm title={`لا يمكن حذف ${removing.id}`} onClose={() => setRemoving(null)} body="خرجت بعض طلباتها مع المندوبين. احذف هذه الطلبات أولًا أو اترك الفاتورة كما هي." />
      ) : (
        <Confirm title={`حذف ${removing.id}؟`} action="حذف الفاتورة" body={`ستُحذف الفاتورة و${fmtCount(removing.orders.length, ORDERS)} من ${removing.supplierName}.`} onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, invoices: d.invoices.filter((p) => p.id !== removing.id), orders: d.orders.filter((o) => o.invoiceId !== removing.id) }))
            toast(`تم حذف ${removing.id}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
