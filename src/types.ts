export type Module = 'suppliers' | 'stock' | 'drivers' | 'orders' | 'reports'
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
export type Permissions = Record<Module, Action[]>
export type OrderStatus = 'unassigned' | 'assigned' | 'accepted' | 'denied' | 'picked' | 'delivered' | 'failed'

export interface Supplier {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  city: string
  category: string
  active: boolean
  createdAt: number
}

export interface InvoiceLine {
  id: string
  product: string
  unit: string
  quantity: number
  unitCost: number
}

export interface Invoice {
  id: string
  supplierId: string
  date: number
  note: string
  lines: InvoiceLine[]
}

export interface Driver {
  id: string
  name: string
  phone: string
  email: string
  password: string
  vehicle: string
  plate: string
  zone: string
  active: boolean
  joinedAt: number
}

export interface OrderEvent {
  at: number
  status: OrderStatus
  by: string
  note?: string
  /** The delivery man this step concerns. Kept here so a driver's history survives reassignment. */
  driverId?: string
}

export interface OrderItem {
  lineId: string
  quantity: number
}

export interface Order {
  id: string
  items: OrderItem[]
  price: number
  client: string
  phone: string
  address: string
  zone: string
  driverId: string | null
  status: OrderStatus
  createdAt: number
  events: OrderEvent[]
}

export interface Staff {
  id: string
  name: string
  email: string
  password: string
  title: string
  role: 'admin' | 'staff'
  active: boolean
  permissions: Permissions
  createdAt: number
}

export interface Db {
  suppliers: Supplier[]
  invoices: Invoice[]
  drivers: Driver[]
  orders: Order[]
  staff: Staff[]
}
