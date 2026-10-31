import type { OrderStatus } from '../types'
import { STATUS_LABEL, STATUS_ORDER, type Piece } from '../lib/domain'
import { ORDERS, fmtCount, fmtNum } from '../lib/format'

const rank: Record<OrderStatus, number> = { delivered: 0, picked: 1, accepted: 2, assigned: 3, unassigned: 4, denied: 5, failed: 6 }

/* Stock drawn to scale: each block is one order's share of it. */
export function CutBar({ total, pieces, large, onSegment }: { total: number; pieces: Piece[]; large?: boolean; onSegment?: (id: string) => void }) {
  const sorted = [...pieces].sort((a, b) => rank[a.status] - rank[b.status])
  const cut = pieces.reduce((n, p) => n + p.quantity, 0)
  const uncut = Math.max(0, total - cut)
  const label = `تم تقسيم ${fmtNum(cut)} من ${fmtNum(total)} إلى ${fmtCount(pieces.length, ORDERS)}`
  return (
    <div className={`cutbar${large ? ' cutbar-lg' : ''}`} role={onSegment ? 'group' : 'img'} aria-label={label}>
      {sorted.map((o) => {
        const title = `${o.id}، الكمية ${fmtNum(o.quantity)}، ${STATUS_LABEL[o.status]}`
        return onSegment ? (
          <button type="button" key={o.id} className={`seg seg-${o.status}`} style={{ flexGrow: o.quantity }} title={title} aria-label={title} onClick={() => onSegment(o.id)} />
        ) : (
          <span key={o.id} className={`seg seg-${o.status}`} style={{ flexGrow: o.quantity }} title={title} />
        )
      })}
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
