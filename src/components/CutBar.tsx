import type { Order, OrderStatus } from '../types'
import { STATUS_LABEL, STATUS_ORDER, sumQty } from '../lib/domain'
import { ORDERS, fmtCount, fmtNum } from '../lib/format'

const rank: Record<OrderStatus, number> = { delivered: 0, picked: 1, assigned: 2, unassigned: 3, failed: 4 }

/* A purchase drawn to scale: each block is one order cut from the load. */
export function CutBar({ total, orders, large, preview = 0, onSegment }: { total: number; orders: Order[]; large?: boolean; preview?: number; onSegment?: (o: Order) => void }) {
  const sorted = [...orders].sort((a, b) => rank[a.status] - rank[b.status])
  const uncut = Math.max(0, total - sumQty(orders) - preview)
  const label = `تم تقسيم ${fmtNum(sumQty(orders))} من ${fmtNum(total)} إلى ${fmtCount(orders.length, ORDERS)}`
  return (
    <div className={`cutbar${large ? ' cutbar-lg' : ''}`} role={onSegment ? 'group' : 'img'} aria-label={label}>
      {sorted.map((o) => {
        const title = `${o.id}، الكمية ${fmtNum(o.quantity)}، ${STATUS_LABEL[o.status]}`
        return onSegment ? (
          <button type="button" key={o.id} className={`seg seg-${o.status}`} style={{ flexGrow: o.quantity }} title={title} aria-label={title} onClick={() => onSegment(o)} />
        ) : (
          <span key={o.id} className={`seg seg-${o.status}`} style={{ flexGrow: o.quantity }} title={title} />
        )
      })}
      {preview > 0 && <span className="seg seg-preview" style={{ flexGrow: preview }} title={`هذا التقسيم: ${fmtNum(preview)}`} />}
      {uncut > 0 && <span className="seg seg-uncut" style={{ flexGrow: uncut }} title={`${fmtNum(uncut)} لم تُقسَّم بعد`} />}
    </div>
  )
}

export function StatusLegend({ uncut }: { uncut?: boolean }) {
  return (
    <ul className="legend">
      {STATUS_ORDER.map((s) => <li key={s}><i className={`seg seg-${s}`} />{STATUS_LABEL[s]}</li>)}
      {uncut && <li><i className="seg seg-uncut" />لم تُقسَّم بعد</li>}
    </ul>
  )
}
