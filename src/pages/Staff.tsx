import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Action, Module, Permissions, Staff } from '../types'
import { useStore } from '../store'
import { MODULES, PRESETS, emailTaken, emptyPermissions, nextId } from '../lib/domain'
import { ACCOUNTS, fmtCount, fmtDate } from '../lib/format'
import { inRange, periodRange } from '../lib/period'
import { textSearch } from '../lib/search'
import { Button, Confirm, Drawer, Field, FilterBar, IconButton, PageHead, PeriodFilter, RowActions, SearchBox, Select, Table, useFilters, type Col } from '../components/ui'

const DEFAULTS = { q: '', period: 'all', from: '', to: '', access: '', state: '' }
const ACTION_LABEL: Record<Action, string> = { view: 'عرض', create: 'إضافة', edit: 'تعديل', delete: 'حذف', export: 'تصدير' }
const COLUMNS: Action[] = ['view', 'create', 'edit', 'delete', 'export']

function accessSummary(s: Staff) {
  if (s.role === 'admin') return 'صلاحيات كاملة'
  const parts = MODULES.filter((m) => s.permissions[m.id].length > 0)
    .map((m) => (s.permissions[m.id].length === 1 && s.permissions[m.id][0] === 'view' ? `${m.label} (عرض)` : m.label))
  return parts.length ? parts.join('، ') : 'بلا صلاحيات'
}

function StaffForm({ item, onClose }: { item?: Staff; onClose: () => void }) {
  const { db, setDb, toast } = useStore()
  const [v, setV] = useState({ name: item?.name ?? '', title: item?.title ?? '', email: item?.email ?? '', password: item?.password ?? '', active: item?.active ?? true })
  const [perms, setPerms] = useState<Permissions>(item?.permissions ?? emptyPermissions())
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* Create, edit, delete and export only work with view, so the matrix keeps them consistent. */
  const toggle = (m: Module, a: Action) => {
    setPerms((p) => {
      const has = p[m].includes(a)
      let next = has ? p[m].filter((x) => x !== a) : [...p[m], a]
      if (a === 'view' && has) next = []
      if (a !== 'view' && !has && !next.includes('view')) next = ['view', ...next]
      return { ...p, [m]: next }
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err: Record<string, string> = {}
    const email = v.email.trim().toLowerCase()
    if (!v.name.trim()) err.name = 'أدخل الاسم بالكامل.'
    if (email && !/^\S+@\S+\.\S+$/.test(email)) err.email = 'أدخل بريدًا إلكترونيًا صحيحًا.'
    else if (emailTaken(db, email, item?.id)) err.email = 'هذا البريد مستخدم في حساب آخر.'
    if (v.password.length < 6) err.password = 'استخدم 6 أحرف على الأقل.'
    setErrors(err)
    if (Object.keys(err).length) return
    const data = { name: v.name.trim(), title: v.title.trim(), email, password: v.password, active: v.active, permissions: perms }
    if (item) {
      setDb((d) => ({ ...d, staff: d.staff.map((s) => (s.id === item.id ? { ...s, ...data } : s)) }))
      toast(`تم حفظ ${data.name}`)
    } else {
      setDb((d) => ({ ...d, staff: [...d.staff, { id: nextId(d.staff, 'U-', 0), role: 'staff', createdAt: Date.now(), ...data }] }))
      toast(`تم إنشاء حساب ${data.name}`)
    }
    onClose()
  }

  return (
    <Drawer wide title={item ? `تعديل ${item.name}` : 'إنشاء حساب موظف'} onClose={onClose}
      footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" type="submit" form="staff-form">{item ? 'حفظ الحساب' : 'إنشاء الحساب'}</Button></>}>
      <form id="staff-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="الاسم بالكامل" error={errors.name}><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="المسمى الوظيفي"><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني (اختياري)" error={errors.email} hint="بدونه يسجل الموظف الدخول باسمه."><input dir="ltr" type="email" autoComplete="off" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="كلمة المرور" error={errors.password} hint="يسجل الموظف الدخول بها."><input dir="ltr" type="text" autoComplete="off" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
        <label className="check field-full"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />يمكن لهذا الحساب تسجيل الدخول</label>

        <fieldset className="perm field-full">
          <legend>صلاحيات هذا الموظف</legend>
          <div className="presets">
            <span>ابدأ من</span>
            {PRESETS.map((p) => <Button key={p.label} onClick={() => setPerms(p.permissions)}>{p.label}</Button>)}
            <Button onClick={() => setPerms(emptyPermissions())}>بلا صلاحيات</Button>
          </div>
          <div className="table-wrap">
            <table className="perm-table">
              <thead>
                <tr><th scope="col">الصفحة</th>{COLUMNS.map((a) => <th scope="col" key={a}>{ACTION_LABEL[a]}</th>)}</tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.label}</th>
                    {COLUMNS.map((a) => (
                      <td key={a}>
                        {m.actions.includes(a)
                          ? <input type="checkbox" aria-label={`${m.label}: ${ACTION_LABEL[a]}`} checked={perms[m.id].includes(a)} onChange={() => toggle(m.id, a)} />
                          : <span className="muted" aria-hidden>&ndash;</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      </form>
    </Drawer>
  )
}

export function StaffPage() {
  const { db, setDb, user, toast } = useStore()
  const { values: f, set, active, clear } = useFilters(DEFAULTS)
  const [form, setForm] = useState<{ item?: Staff } | null>(null)
  const [removing, setRemoving] = useState<Staff | null>(null)

  const rows = useMemo(() => {
    const range = periodRange(f.period, f.from, f.to)
    return db.staff.filter((s) =>
      inRange(s.createdAt, range) &&
      (!f.access || s.role === 'admin' || s.permissions[f.access as Module].length > 0) &&
      (!f.state || (f.state === 'active') === s.active) &&
      textSearch(`${s.name} ${s.email} ${s.title}`, f.q))
  }, [db.staff, f])

  const cols: Col<Staff>[] = [
    { key: 'name', label: 'الاسم', render: (s) => <><strong>{s.name}</strong><small>{s.title}</small></>, sort: (s) => s.name },
    { key: 'email', label: 'البريد الإلكتروني', render: (s) => <span dir="ltr">{s.email}</span>, sort: (s) => s.email },
    { key: 'access', label: 'الصلاحيات', render: (s) => accessSummary(s) },
    { key: 'created', label: 'تاريخ الإضافة', render: (s) => fmtDate(s.createdAt), sort: (s) => s.createdAt },
    { key: 'state', label: 'الحالة', render: (s) => s.active ? 'نشط' : <span className="muted">معطّل</span>, sort: (s) => (s.active ? 0 : 1) },
    {
      key: 'actions', label: '', right: true, render: (s) => s.role === 'admin' ? null : (
        <RowActions>
          <IconButton label={`تعديل ${s.name}`} onClick={() => setForm({ item: s })}><Pencil size={16} /></IconButton>
          <IconButton label={`حذف ${s.name}`} disabled={s.id === user?.id} onClick={() => setRemoving(s)}><Trash2 size={16} /></IconButton>
        </RowActions>
      ),
    },
  ]

  return (
    <>
      <PageHead title="الموظفون" count={fmtCount(rows.length, ACCOUNTS)}>
        <Button variant="primary" onClick={() => setForm({})}><Plus size={17} aria-hidden />إنشاء حساب موظف</Button>
      </PageHead>
      <SearchBox value={f.q} onChange={(q) => set({ q })} placeholder="ابحث بالاسم أو البريد أو المسمى الوظيفي" />
      <FilterBar active={active} onClear={clear}>
        <PeriodFilter label="تاريخ الإضافة" period={f.period} from={f.from} to={f.to} onChange={set} />
        <Select label="لديه صلاحية" all="أي صفحة" value={f.access} onChange={(access) => set({ access })} options={MODULES.map((m) => ({ value: m.id, label: m.label }))} />
        <Select label="الحالة" all="أي حالة" value={f.state} onChange={(state) => set({ state })} options={[{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'معطّل' }]} />
      </FilterBar>
      <Table rows={rows} cols={cols} rowKey={(s) => s.id} sort={{ key: 'created', dir: 1 }}
        empty={<><h2>لا يوجد موظفون مطابقون</h2><p>غيّر البحث أو امسح الفلاتر لعرض حسابات أكثر.</p></>} />
      {form && <StaffForm item={form.item} onClose={() => setForm(null)} />}
      {removing && (
        <Confirm title={`حذف ${removing.name}؟`} action="حذف الحساب" body="لن يتمكن هذا الموظف من الدخول، ويبقى اسمه في سجل الطلبات." onClose={() => setRemoving(null)}
          onConfirm={() => {
            setDb((d) => ({ ...d, staff: d.staff.filter((s) => s.id !== removing.id) }))
            toast(`تم حذف ${removing.name}`)
            setRemoving(null)
          }} />
      )}
    </>
  )
}
