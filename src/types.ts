export type Module = 'suppliers' | 'stock' | 'drivers' | 'orders' | 'reports'
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
export type Permissions = Record<Module, Action[]>
export type OrderStatus = 'unassigned' | 'assigned' | 'delivered' | 'refunded'

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

/** A supplier's purchase invoice is a batch of client orders. */
export interface Invoice {
  id: string
  supplierId: string
  date: number
  note: string
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
  product: string
  category: string
  quantity: number
}

/** Set when the delivery man brings an order back. `back` is filled in once an admin checks the goods came back. */
export interface Refund {
  reason: string
  at: number
  driverId: string
  back?: boolean
}

export interface Order {
  id: string
  invoiceId: string
  /** The supplier's own reference for this order. */
  code: string
  items: OrderItem[]
  /** What the supplier charges for the order. */
  price: number
  /** Our delivery fee, collected on top of the price. */
  fee: number
  client: string
  phone: string
  address: string
  zone: string
  driverId: string | null
  status: OrderStatus
  createdAt: number
  events: OrderEvent[]
  refund?: Refund
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
