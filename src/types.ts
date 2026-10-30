export type Module = 'suppliers' | 'purchases' | 'drivers' | 'orders' | 'reports'
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'
export type Permissions = Record<Module, Action[]>
export type OrderStatus = 'unassigned' | 'assigned' | 'picked' | 'delivered' | 'failed'

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

export interface Purchase {
  id: string
  supplierId: string
  product: string
  unit: string
  quantity: number
  unitCost: number
  date: number
  note: string
}

export interface Driver {
  id: string
  name: string
  phone: string
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
}

export interface Order {
  id: string
  purchaseId: string
  quantity: number
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
  purchases: Purchase[]
  drivers: Driver[]
  orders: Order[]
  staff: Staff[]
}
