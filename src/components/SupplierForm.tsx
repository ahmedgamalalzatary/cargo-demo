import type { Supplier } from '../types'
import { useStore } from '../store'
import { CATEGORIES, CITIES, SUPPLIER_STATES, nextId } from '../lib/domain'
import { FormDrawer, type FieldSpec } from './ui'

const list = (items: string[]) => items.map((x) => ({ value: x, label: x }))

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'اسم الشركة', required: true, full: true },
  { name: 'contact', label: 'مسؤول التواصل', required: true },
  { name: 'phone', label: 'الهاتف', type: 'tel', required: true },
  { name: 'email', label: 'البريد الإلكتروني', type: 'email', full: true },
  { name: 'city', label: 'المدينة', type: 'select', required: true, options: list(CITIES) },
  { name: 'category', label: 'الفئة', type: 'select', required: true, options: list(CATEGORIES) },
  { name: 'active', label: 'الحالة', type: 'select', required: true, options: SUPPLIER_STATES },
]

/* Used on the suppliers page and from inside a new purchase invoice. `onSaved` gets the supplier's id. */
export function SupplierForm({ item, onSaved, onClose }: { item?: Supplier; onSaved: (id: string, category: string) => void; onClose: () => void }) {
  const { db, setDb, toast } = useStore()
  const save = (v: Record<string, string>) => {
    const data = { name: v.name.trim(), contact: v.contact.trim(), phone: v.phone.trim(), email: v.email.trim(), city: v.city, category: v.category, active: v.active === 'active' }
    if (item) {
      setDb((d) => ({ ...d, suppliers: d.suppliers.map((s) => (s.id === item.id ? { ...s, ...data } : s)) }))
      toast(`تم حفظ ${data.name}`)
      onSaved(item.id, data.category)
    } else {
      const id = nextId(db.suppliers, 'S-', 0)
      setDb((d) => ({ ...d, suppliers: [{ id, createdAt: Date.now(), ...data }, ...d.suppliers] }))
      toast(`تمت إضافة ${data.name}`)
      onSaved(id, data.category)
    }
  }
  return (
    <FormDrawer title={item ? `تعديل ${item.name}` : 'إضافة مورد'} action={item ? 'حفظ المورد' : 'إضافة المورد'} fields={FIELDS} onSave={save} onClose={onClose}
      initial={{ name: item?.name ?? '', contact: item?.contact ?? '', phone: item?.phone ?? '', email: item?.email ?? '', city: item?.city ?? '', category: item?.category ?? '', active: item && !item.active ? 'inactive' : 'active' }} />
  )
}
