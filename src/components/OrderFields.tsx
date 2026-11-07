import { Plus, Trash2 } from 'lucide-react'
import { CATEGORIES, ZONES } from '../lib/domain'
import { fmtNum } from '../lib/format'
import { Button, Field, IconButton } from './ui'
import { blankItem, type Errors, type ItemDraft, type OrderDraft } from '../lib/orderDraft'

/* The client, address, price and products of one order. */
export function OrderFields({ draft, onChange, errors, clearError, prefix, products, goodsLocked }: {
  draft: OrderDraft
  onChange: (next: OrderDraft) => void
  errors: Errors
  clearError: (keys: string[]) => void
  prefix: string
  products: string[]
  goodsLocked?: boolean
}) {
  const set = (k: keyof Omit<OrderDraft, 'key' | 'id' | 'items'>) => (e: { target: { value: string } }) => {
    onChange({ ...draft, [k]: e.target.value })
    clearError([`${prefix}${k}`])
  }
  const setItem = (key: number, patch: Partial<ItemDraft>) => {
    onChange({ ...draft, items: draft.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) })
    clearError(Object.keys(patch).map((k) => `${prefix}${k}${key}`))
  }
  const e = (k: string) => errors[`${prefix}${k}`]
  const listId = `products-${prefix}`

  return (
    <>
      <div className="form-grid">
        <Field label="كود الطلب (اختياري)" hint="رقم الطلب عند المورد"><input dir="ltr" value={draft.code} onChange={set('code')} /></Field>
        <Field label="اسم العميل" error={e('client')}><input value={draft.client} onChange={set('client')} /></Field>
        <Field label="رقم الهاتف" error={e('phone')}><input type="tel" dir="ltr" value={draft.phone} onChange={set('phone')} /></Field>
        <Field label="المنطقة" error={e('zone')}>
          <select value={draft.zone} onChange={set('zone')}>
            <option value="">اختر</option>
            {ZONES.map((z) => <option key={z}>{z}</option>)}
          </select>
        </Field>
        <Field label="العنوان" error={e('address')} full><input value={draft.address} onChange={set('address')} /></Field>
        <Field label="سعر الطلب (ج.م)" error={e('price')} hint="السعر من المورد"><input type="number" inputMode="decimal" min={1} value={draft.price} onChange={set('price')} /></Field>
        <Field label="رسوم التوصيل (ج.م)" error={e('fee')}><input type="number" inputMode="decimal" min={0} value={draft.fee} onChange={set('fee')} /></Field>
        <Field label="يحصّل المندوب"><input readOnly tabIndex={-1} value={+draft.price > 0 ? fmtNum(+draft.price + (+draft.fee || 0)) : ''} /></Field>
      </div>
      <fieldset className="lines">
        <legend>الأصناف</legend>
        {goodsLocked && <p className="field-hint">أُغلق هذا الطلب، فلا يمكن تغيير أصنافه.</p>}
        <datalist id={listId}>{products.map((p) => <option key={p} value={p} />)}</datalist>
        {draft.items.map((i, n) => (
          <div className="line-row line-row-item" key={i.key}>
            <Field label={`الصنف ${fmtNum(n + 1)}`} error={e(`product${i.key}`)}>
              <input list={listId} value={i.product} disabled={goodsLocked} onChange={(ev) => setItem(i.key, { product: ev.target.value })} />
            </Field>
            <Field label="الفئة" error={e(`category${i.key}`)}>
              <select value={i.category} disabled={goodsLocked} onChange={(ev) => setItem(i.key, { category: ev.target.value })}>
                <option value="">اختر</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="الكمية" error={e(`quantity${i.key}`)}>
              <input type="number" inputMode="numeric" min={1} value={i.quantity} disabled={goodsLocked} onChange={(ev) => setItem(i.key, { quantity: ev.target.value })} />
            </Field>
            {!goodsLocked && (
              <IconButton label={`حذف الصنف ${fmtNum(n + 1)}`} disabled={draft.items.length === 1}
                onClick={() => onChange({ ...draft, items: draft.items.filter((x) => x.key !== i.key) })}><Trash2 size={16} /></IconButton>
            )}
          </div>
        ))}
        {!goodsLocked && (
          <Button onClick={() => onChange({ ...draft, items: [...draft.items, blankItem(Math.max(...draft.items.map((x) => x.key)) + 1, draft.items[draft.items.length - 1]?.category)] })}>
            <Plus size={16} aria-hidden />إضافة صنف
          </Button>
        )}
      </fieldset>
    </>
  )
}
