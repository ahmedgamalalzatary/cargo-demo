import { useState, type FormEvent } from 'react'
import { Button, Drawer, Field } from './ui'

/* The delivery man writes the reason in his own words; admins read it on the refunds page. */
export function RefundDialog({ orderId, onClose, onDone }: { orderId: string; onClose: () => void; onDone: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 3) { setError('اكتب سبب المرتجع ليعرفه المسؤول.'); return }
    onDone(reason.trim())
  }
  return (
    <Drawer title={`مرتجع ${orderId}`} onClose={onClose}
      footer={<><Button onClick={onClose}>رجوع</Button><Button variant="danger" type="submit" form="refund-form">تسجيل المرتجع</Button></>}>
      <form id="refund-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="سبب المرتجع" full error={error} hint="مثال: العميل لا يرد، العنوان خطأ، العميل رفض الاستلام">
          <textarea rows={4} autoFocus value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} />
        </Field>
      </form>
    </Drawer>
  )
}
