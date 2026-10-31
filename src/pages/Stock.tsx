import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Invoice } from '../types'
import { useStore } from '../store'
import { CUT_LABEL, allocations, cutState, invoiceCost, invoiceProducts, invoiceQty, piecesOf, unique, type Piece } from '../lib/domain'
import { INVOICES, ORDERS, PRODUCTS, fmtCount, fmtDate, fmtMoney, fmtNum, fmtQty } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, FilterBar, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col } from '../components/ui'
import { CutBar, StatusLegend } from '../components/CutBar'
import { InvoiceForm } from '../components/InvoiceForm'

const DEFAULTS = { tab: 'invoices', q: '', period: 'all', from: '', to: '', supplier: '', cut: '', avail: '' }
const TABS = [['invoices', 'فواتير الشراء'], ['items', 'الأصناف المتاحة']] as const
type Row = Invoice & { supplierName: string; pieces: Piece[]; qty: number; cut: number; cost: number }
interface Item { key: string; product: string; unit: string; bought: number; taken: number; left: number; value: number; suppliers: string[]; invoices: number }

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

  const rows = useMemo<Row[]>(() => inView
    .map((p) => {
      const pieces = piecesOf(db.orders, p.lines)
      return { ...p, supplierName: names.get(p.supplierId) ?? '', pieces, qty: invoiceQty(p), cut: pieces.reduce((n, x) => n + x.quantity, 0), cost: invoiceCost(p) }
    })
    .filter((p) =>
      (!f.cut || cutState(p.qty, p.cut) === f.cut) &&
      textSearch(`${p.id} ${invoiceProducts(p)} ${p.supplierName} ${p.note}`, f.q)), [inView, db.orders, names, f.cut, f.q])

  /* One row per product and unit, added up across every invoice in view. */
  const items = useMemo<Item[]>(() => {
    const taken = allocations(db.orders)
    const map = new Map<string, Item>()
    for (const p of inView) {
      for (const l of p.lines) {
        const key = `${l.product}|${l.unit}`
        const row = map.get(key) ?? { key, product: l.product, unit: l.unit, bought: 0, taken: 0, left: 0, value: 0, suppliers: [], invoices: 0 }
        const used = taken.get(l.id) ?? 0
        row.bought += l.quantity
        row.taken += used
        row.left += l.quantity - used
        row.value += (l.quantity - used) * l.unitCost
        row.suppliers = unique([...row.suppliers, names.get(p.supplierId) ?? ''])
        row.invoices++
        map.set(key, row)
      }
    }
    return [...map.values()].filter((i) =>
      (!f.avail || (f.avail === 'in') === i.left > 0) &&
      textSearch(`${i.product} ${i.unit} ${i.suppliers.join(' ')}`, f.q))
  }, [inView, db.orders, names, f.avail, f.q])

  const canEdit = can('stock', 'edit')
  const canDelete = can('stock', 'delete')
  const cols: Col<Row>[] = [
    { key: 'id', label: 'الفاتورة', render: (p) => <strong className="id">{p.id}</strong>, sort: (p) => p.id },
    { key: 'goods', label: 'الأصناف', render: (p) => <>{p.lines.length > 1 ? fmtCount(p.lines.length, PRODUCTS) : p.lines[0]?.product}<small className="clamp">{p.lines.length > 1 ? invoiceProducts(p) : ''}{p.lines.length > 1 ? '، ' : ''}{p.supplierName}</small></>, sort: (p) => p.lines.length },
    {
      key: 'cut', label: 'التقسيم إلى طلبات', render: (p) => (
        <div className="cut-cell">
          <CutBar total={p.qty} pieces={p.pieces} />
          <small>{fmtNum(p.cut)} من {fmtNum(p.qty)} وحدة، {fmtCount(p.pieces.length, ORDERS)}</small>
        </div>
      ), sort: (p) => p.cut / p.qty,
    },
    { key: 'cost', label: 'التكلفة', right: true, render: (p) => fmtMoney(p.cost), sort: (p) => p.cost },
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
    { key: 'product', label: 'الصنف', render: (i) => <><strong>{i.product}</strong><small>{i.suppliers.join('، ')}</small></>, sort: (i) => i.product },
    { key: 'left', label: 'المتاح', right: true, render: (i) => i.left > 0 ? <strong>{fmtQty(i.left, i.unit)}</strong> : <span className="muted">نفد</span>, sort: (i) => i.left },
    { key: 'taken', label: 'في الطلبات', right: true, render: (i) => fmtNum(i.taken), sort: (i) => i.taken },
    { key: 'bought', label: 'تم شراؤه', right: true, render: (i) => fmtNum(i.bought), sort: (i) => i.bought },
    { key: 'invoices', label: 'الفواتير', right: true, render: (i) => fmtNum(i.invoices), sort: (i) => i.invoices },
    { key: 'value', label: 'قيمة المتاح', right: true, render: (i) => fmtMoney(i.value), sort: (i) => i.value },
  ]
  const onItems = f.tab === 'items'
  const count = onItems
    ? `${fmtCount(items.length, PRODUCTS)}، قيمة المتاح ${fmtMoney(items.reduce((n, i) => n + i.value, 0))}`
    : `${fmtCount(rows.length, INVOICES)}، بإجمالي ${fmtMoney(rows.reduce((n, p) => n + p.cost, 0))}`

  return (
    <>
      <PageHead title="المخزون" count={count}>
        {can('stock', 'create') && <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />فاتورة شراء جديدة</Button>}
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder={onItems ? 'ابحث باسم الصنف أو المورد' : 'ابحث برقم الفاتورة أو الصنف أو المورد'} />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="المورد" all="كل الموردين" value={f.supplier} onChange={(supplier) => set({ supplier })} options={db.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        {onItems
          ? <Select label="التوفر" all="الكل" value={f.avail} onChange={(avail) => set({ avail })} options={[{ value: 'in', label: 'متاح' }, { value: 'out', label: 'نفد' }]} />
          : <Select label="التقسيم" all="أي مرحلة" value={f.cut} onChange={(cut) => set({ cut })} options={(['none', 'part', 'full'] as const).map((c) => ({ value: c, label: CUT_LABEL[c] }))} />}
      </FilterBar>
      <div className="tabs" role="tablist" aria-label="عرض المخزون">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={f.tab === id} onClick={() => set({ tab: id, cut: '', avail: '' })}>{label}</button>)}
      </div>
      {onItems ? (
        <Table key="items" rows={items} cols={itemCols} rowKey={(i) => i.key} sort={{ key: 'left', dir: -1 }}
          empty={<><h2>لا توجد أصناف مطابقة</h2><p>غيّر البحث أو امسح الفلاتر.</p></>} />
      ) : (
        <>
          <StatusLegend uncut />
          <Table key="invoices" rows={rows} cols={cols} rowKey={(p) => p.id} onRow={(p) => nav(`/stock/${p.id}`)} sort={{ key: 'date', dir: -1 }}
            empty={<><h2>لا توجد فواتير مطابقة</h2><p>غيّر البحث أو امسح الفلاتر لعرض فواتير أكثر.</p></>} />
        </>
      )}

      {form && <InvoiceForm item={form.item} onClose={() => setForm(null)} />}
      {removing && (removing.pieces.length > 0 ? (
        <Confirm title={`لا يمكن حذف ${removing.id}`} onClose={() => setRemoving(null)} body={`تم تقسيم ${fmtCount(removing.pieces.length, ORDERS)} منها. احذف هذه الطلبات أولًا.`} />
      ) : (
        <Confirm title={`حذف ${removing.id}؟`} action="حذف الفاتورة" body={`ستُحذف ${fmtCount(removing.lines.length, PRODUCTS)} من ${removing.supplierName} من المخزون.`} onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, invoices: d.invoices.filter((p) => p.id !== removing.id) }))
            toast(`تم حذف ${removing.id}`)
            setRemoving(null)
          }} />
      ))}
    </>
  )
}
