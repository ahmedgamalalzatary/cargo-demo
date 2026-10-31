import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Module } from './types'
import { StoreProvider, useStore } from './store'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Orders } from './pages/Orders'
import { Stock } from './pages/Stock'
import { StockInvoice } from './pages/StockInvoice'
import { Suppliers } from './pages/Suppliers'
import { Drivers } from './pages/Drivers'
import { StaffPage } from './pages/Staff'
import { Reports } from './pages/Reports'
import { MyOrders } from './pages/MyOrders'
import { MyHistory } from './pages/MyHistory'

const ORDER: Module[] = ['orders', 'stock', 'suppliers', 'drivers', 'reports']

function useHome() {
  const { can, user } = useStore()
  const first = ORDER.find((m) => can(m, 'view'))
  if (first) return `/${first}`
  return user?.role === 'admin' ? '/staff' : '/no-access'
}

function Guard({ module, admin, children }: { module?: Module; admin?: boolean; children: ReactNode }) {
  const { can, user } = useStore()
  const home = useHome()
  const allowed = admin ? user?.role === 'admin' : module ? can(module, 'view') : true
  return allowed ? children : <Navigate to={home} replace />
}

function NoAccess() {
  return (
    <div className="empty empty-page">
      <h1>لا توجد صفحات لعرضها</h1>
      <p>حسابك بلا صلاحيات. اطلب من المدير منحك صلاحية الوصول.</p>
    </div>
  )
}

function Home() {
  return <Navigate to={useHome()} replace />
}

function Routed() {
  const { user, driver } = useStore()
  if (driver) {
    return (
      <Routes>
        <Route element={<Shell />}>
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/my-history" element={<MyHistory />} />
          <Route path="*" element={<Navigate to="/my-orders" replace />} />
        </Route>
      </Routes>
    )
  }
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/orders" element={<Guard module="orders"><Orders /></Guard>} />
        <Route path="/stock" element={<Guard module="stock"><Stock /></Guard>} />
        <Route path="/stock/:id" element={<Guard module="stock"><StockInvoice /></Guard>} />
        <Route path="/suppliers" element={<Guard module="suppliers"><Suppliers /></Guard>} />
        <Route path="/drivers" element={<Guard module="drivers"><Drivers /></Guard>} />
        <Route path="/reports" element={<Guard module="reports"><Reports /></Guard>} />
        <Route path="/staff" element={<Guard admin><StaffPage /></Guard>} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </StoreProvider>
  )
}
