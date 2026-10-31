import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FILTERS, fmtCount, fmtDateTime } from '../lib/format'
import { Ban, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDashed, Hourglass, PackageCheck, Search, Truck, UserCheck, X, TriangleAlert } from 'lucide-react'
import type { OrderEvent, OrderStatus } from '../types'
import { STATUS_LABEL } from '../lib/domain'
import { PERIODS } from '../lib/period'

export function Button({ variant = 'plain', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'plain' | 'danger' }) {
  return <button type="button" className={`btn btn-${variant}`} {...rest}>{children}</button>
}

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}>{children}</button>
}

const STATUS_ICON = { unassigned: CircleDashed, assigned: Hourglass, accepted: UserCheck, denied: Ban, picked: Truck, delivered: PackageCheck, failed: TriangleAlert }
export function StatusPill({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICON[status]
  return <span className={`pill pill-${status}`}><Icon size={14} aria-hidden />{STATUS_LABEL[status]}</span>
}

const EVENT_LABEL: Partial<Record<OrderStatus, string>> = { accepted: 'قبل المندوب الطلب', picked: 'استلم المندوب البضاعة', delivered: 'تم التوصيل' }
export function Timeline({ events }: { events: OrderEvent[] }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e, i) => (
        <li key={i}>
          <i className={`seg seg-${e.status}`} />
          <div>
            <strong>{e.status === 'unassigned' && !e.note ? 'تم إنشاء الطلب' : e.status === 'denied' ? `رفض المندوب الطلب: ${e.note}` : e.note ?? EVENT_LABEL[e.status] ?? STATUS_LABEL[e.status]}</strong>
            <span>{fmtDateTime(e.at)}، بواسطة {e.by}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PageHead({ title, count, children }: { title: string; count?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {count && <p className="page-count">{count}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export function Drawer({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} className={`drawer${wide ? ' drawer-wide' : ''}`} onCancel={(e) => { e.preventDefault(); onClose() }} aria-label={title}>
      <header className="drawer-head">
        <h2>{title}</h2>
        <IconButton label="إغلاق" onClick={onClose}><X size={20} /></IconButton>
      </header>
      <div className="drawer-body">{children}</div>
      {footer && <footer className="drawer-foot">{footer}</footer>}
    </dialog>
  )
}

export function Confirm({ title, body, action, onConfirm, onClose }: { title: string; body: ReactNode; action?: string; onConfirm?: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); onClose() }} aria-label={title}>
      <h2>{title}</h2>
      <div className="confirm-body">{body}</div>
      <div className="confirm-actions">
        <Button onClick={onClose}>{onConfirm ? 'إلغاء' : 'إغلاق'}</Button>
        {onConfirm && <Button variant="danger" onClick={onConfirm}>{action}</Button>}
      </div>
    </dialog>
  )
}

export function Field({ label, error, hint, children, full }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field${full ? ' field-full' : ''}${error ? ' field-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-msg">{error}</span>}
    </label>
  )
}

export interface FieldSpec {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  required?: boolean
  min?: number
  full?: boolean
  check?: (value: string) => string | undefined
}

export function FormDrawer({ title, action, fields, initial, onSave, onClose }: {
  title: string
  action: string
  fields: FieldSpec[]
  initial: Record<string, string>
  onSave: (values: Record<string, string>) => void
  onClose: () => void
}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    for (const f of fields) {
      const v = (values[f.name] ?? '').trim()
      const custom = f.check?.(v)
      if (f.required && !v) next[f.name] = `أدخل ${f.label}.`
      else if (f.type === 'number' && v && (Number.isNaN(+v) || (f.min !== undefined && +v < f.min))) next[f.name] = `أدخل ${f.min} أو أكثر.`
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) next[f.name] = 'أدخل بريدًا إلكترونيًا صحيحًا.'
      else if (custom) next[f.name] = custom
    }
    setErrors(next)
    if (Object.keys(next).length === 0) onSave(values)
  }
  return (
    <Drawer title={title} onClose={onClose} footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="entity-form">{action}</Button></>}>
      <form id="entity-form" className="form-grid" onSubmit={submit} noValidate>
        {fields.map((f) => {
          const set = (v: string) => {
            setValues((s) => ({ ...s, [f.name]: v }))
            setErrors((s) => ({ ...s, [f.name]: '' }))
          }
          const v = values[f.name] ?? ''
          return (
            <Field key={f.name} label={f.label} error={errors[f.name]} full={f.full}>
              {f.type === 'select' ? (
                <select value={v} onChange={(e) => set(e.target.value)}>
                  <option value="">اختر</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={3} value={v} onChange={(e) => set(e.target.value)} />
              ) : (
                <input type={f.type ?? 'text'} dir={f.type === 'email' || f.type === 'tel' ? 'ltr' : undefined} value={v} min={f.min} onChange={(e) => set(e.target.value)} />
              )}
            </Field>
          )
        })}
      </form>
    </Drawer>
  )
}

/* Filters live in the URL so a filtered page can be linked to or reloaded. */
export function useFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const values = useMemo(() => {
    const v: Record<string, string> = { ...defaults }
    for (const k of Object.keys(defaults)) v[k] = params.get(k) ?? defaults[k]
    return v as T
  }, [params, defaults])
  const set = (patch: Partial<Record<keyof T, string>>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === defaults[k]) next.delete(k)
        else next.set(k, v as string)
      }
      return next
    }, { replace: true })
  }
  const active = Object.keys(defaults).filter((k) => k !== 'tab' && values[k] !== defaults[k]).length
  const clear = () => {
    setParams((prev) => {
      const next = new URLSearchParams()
      const tab = prev.get('tab')
      if (tab) next.set('tab', tab)
      return next
    }, { replace: true })
  }
  return { values, set, active, clear }
}

export function SearchBox({ value, onChange, placeholder, chips }: { value: string; onChange: (v: string) => void; placeholder: string; chips?: string[] }) {
  return (
    <div className="search-wrap">
      <div className="search">
        <Search size={17} aria-hidden />
        <input type="search" aria-label="بحث" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
      {chips && chips.length > 0 && (
        <p className="chips"><span>يتم البحث عن</span>{chips.map((c) => <span className="chip" key={c}>{c}</span>)}</p>
      )}
    </div>
  )
}

export function Select({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all: string }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-on={value ? '' : undefined}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function PeriodFilter({ label = 'الفترة', period, from, to, onChange }: { label?: string; period: string; from: string; to: string; onChange: (p: { period?: string; from?: string; to?: string }) => void }) {
  return (
    <>
      <label className="filter">
        <span>{label}</span>
        <select value={period} data-on={period !== 'all' ? '' : undefined} onChange={(e) => onChange({ period: e.target.value, from: '', to: '' })}>
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {period === 'custom' && (
        <>
          <label className="filter"><span>من</span><input type="date" value={from} onChange={(e) => onChange({ from: e.target.value })} /></label>
          <label className="filter"><span>إلى</span><input type="date" value={to} onChange={(e) => onChange({ to: e.target.value })} /></label>
        </>
      )}
    </>
  )
}

export function FilterBar({ active, onClear, children }: { active: number; onClear: () => void; children: ReactNode }) {
  return (
    <div className="filterbar">
      {children}
      {active > 0 && <button type="button" className="clear" onClick={onClear}><X size={15} aria-hidden />مسح {fmtCount(active, FILTERS)}</button>}
    </div>
  )
}

export interface Col<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  sort?: (row: T) => string | number
  right?: boolean
}

export function Table<T>({ rows, cols, rowKey, onRow, empty, sort: initial, selected, onSelect, pageSize = 20 }: {
  rows: T[]
  cols: Col<T>[]
  rowKey: (r: T) => string
  onRow?: (r: T) => void
  empty: ReactNode
  sort?: { key: string; dir: 1 | -1 }
  selected?: Set<string>
  onSelect?: (next: Set<string>) => void
  pageSize?: number
}) {
  const [sort, setSort] = useState(initial ?? null)
  const [page, setPage] = useState(0)
  const col = cols.find((c) => c.key === sort?.key)
  const sorted = !col?.sort || !sort ? rows : [...rows].sort((a, b) => {
    const x = col.sort!(a), y = col.sort!(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
  })
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const shown = sorted.slice(current * pageSize, (current + 1) * pageSize)

  if (rows.length === 0) return <div className="empty">{empty}</div>
  const allShown = !!selected && shown.every((r) => selected.has(rowKey(r)))
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {selected && (
                <th className="check-cell">
                  <input type="checkbox" aria-label="تحديد كل الصفحة" checked={allShown} onChange={() => {
                    const next = new Set(selected)
                    shown.forEach((r) => (allShown ? next.delete(rowKey(r)) : next.add(rowKey(r))))
                    onSelect?.(next)
                  }} />
                </th>
              )}
              {cols.map((c) => (
                <th key={c.key} className={c.right ? 'right' : ''} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                      {c.label}
                      {sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const id = rowKey(r)
              return (
                <tr key={id} className={onRow ? 'clickable' : ''} onClick={onRow ? () => onRow(r) : undefined}
                  tabIndex={onRow ? 0 : undefined}
                  onKeyDown={onRow ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRow(r) } : undefined}>
                  {selected && (
                    <td className="check-cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`تحديد ${id}`} checked={selected.has(id)} onChange={() => {
                        const next = new Set(selected)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        onSelect?.(next)
                      }} />
                    </td>
                  )}
                  {cols.map((c) => (
                    <td key={c.key} data-label={c.label} className={c.right ? 'right' : undefined}>{c.render(r)}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="pager" aria-label="الصفحات">
          <span>{current * pageSize + 1} إلى {Math.min((current + 1) * pageSize, sorted.length)} من {sorted.length}</span>
          <IconButton label="الصفحة السابقة" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronRight size={18} /></IconButton>
          <IconButton label="الصفحة التالية" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronLeft size={18} /></IconButton>
        </nav>
      )}
    </>
  )
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="row-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{children}</div>
}
