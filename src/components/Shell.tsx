import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Boxes, ChartColumn, ClipboardList, Factory, History, LogOut, Menu, PackageOpen, RotateCcw, ShieldCheck, Truck, Undo2, X } from 'lucide-react'
import type { Module } from '../types'
import { useStore } from '../store'
import { Confirm } from './ui'
import { Logo } from './Logo'

const NAV: { to: string; label: string; icon: typeof Boxes; module?: Module }[] = [
  { to: '/orders', label: 'الطلبات', icon: Boxes, module: 'orders' },
  { to: '/refunds', label: 'المرتجعات', icon: Undo2, module: 'orders' },
  { to: '/stock', label: 'المخزون', icon: PackageOpen, module: 'stock' },
  { to: '/suppliers', label: 'الموردون', icon: Factory, module: 'suppliers' },
  { to: '/drivers', label: 'المندوبون', icon: Truck, module: 'drivers' },
  { to: '/reports', label: 'التقارير', icon: ChartColumn, module: 'reports' },
  { to: '/staff', label: 'الموظفون', icon: ShieldCheck },
]
const DRIVER_NAV = [
  { to: '/my-orders', label: 'طلباتي', icon: ClipboardList },
  { to: '/my-history', label: 'السجل', icon: History },
]

export function Shell() {
  const { user, driver, can, logout, reset } = useStore()
  const [open, setOpen] = useState(false)
  const [askReset, setAskReset] = useState(false)
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) { setLastPath(pathname); setOpen(false) }
  const account = user ?? driver
  if (!account) return null
  const items = driver ? DRIVER_NAV : NAV.filter((n) => (n.module ? can(n.module, 'view') : user?.role === 'admin'))
  return (
    <div className="shell">
      <div className="mobile-bar">
        <Logo />
        <button type="button" aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      <aside className={`rail${open ? ' rail-open' : ''}`}>
        <div className="rail-logo"><Logo /></div>
        <nav aria-label="القائمة الرئيسية">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}><Icon size={19} aria-hidden />{label}</NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <p className="rail-user"><strong>{account.name}</strong>{user ? user.title : 'مندوب توصيل'}</p>
          <button type="button" onClick={() => setAskReset(true)}><RotateCcw size={16} aria-hidden />إعادة ضبط البيانات</button>
          <button type="button" onClick={logout}><LogOut size={16} aria-hidden />تسجيل الخروج</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
      {askReset && (
        <Confirm title="إعادة ضبط البيانات التجريبية؟" body="ستُحذف كل تعديلاتك وتعود البيانات الأصلية، ثم تنتقل إلى صفحة الدخول."
          action="إعادة الضبط" onClose={() => setAskReset(false)} onConfirm={reset} />
      )}
    </div>
  )
}
