import type { Db, Driver, Invoice, InvoiceLine, Order, OrderEvent, OrderItem, OrderStatus, Staff, Supplier } from '../types'
import { CATEGORIES, PRESETS, ZONES, emptyPermissions } from './domain'

const DAY = 86400000
const HOUR = 3600000
const DENY_REASONS = ['خارج منطقتي اليوم', 'المركبة لا تتحمل الحمولة', 'لدي طلبات كثيرة الآن']

export function createSeed(now = Date.now()): Db {
  let state = 20261030
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
  const pick = <T,>(list: T[]) => list[int(0, list.length - 1)]
  const phone = () => `01${pick(['0', '1', '2', '5'])}${String(int(10000000, 99999999))}`

  const supplierSeed: [string, string, string, number][] = [
    ['وادي النيل للأغذية', 'هاني مصطفى', 'القاهرة', 0],
    ['غلال الدلتا', 'سمير فتحي', 'طنطا', 0],
    ['الإسكندرية للأدوات المنزلية', 'دينا رشاد', 'الإسكندرية', 1],
    ['نسيج المحلة', 'يوسف جمال', 'المنصورة', 2],
    ['إلكترونيات رمضان', 'نادر صالح', 'العاشر من رمضان', 3],
    ['كريستال كلين', 'هبة لطفي', 'الجيزة', 4],
    ['زيتون سيناء', 'عمر صبري', 'القاهرة', 0],
    ['أواني الفراعنة', 'ليلى كامل', 'القاهرة', 1],
  ]
  const suppliers: Supplier[] = supplierSeed.map(([name, contact, city, cat], i) => ({
    id: `S-${i + 1}`,
    name,
    contact,
    phone: phone(),
    email: `sales${i + 1}@supplier.example`,
    city,
    category: CATEGORIES[cat],
    active: i !== 7,
    createdAt: now - int(100, 400) * DAY,
  }))

  const products: Record<string, [string, string, number][]> = {
    [CATEGORIES[0]]: [['أرز مصري 5 كجم', 'شوال', 210], ['زيت عباد الشمس 12 عبوة', 'كرتونة', 780], ['سكر 1 كجم 20 عبوة', 'كرتونة', 640], ['زيت زيتون 6 عبوات', 'كرتونة', 1150]],
    [CATEGORIES[1]]: [['برطمانات زجاج', 'كرتونة', 420], ['طقم حلل تيفال', 'كرتونة', 1340], ['صناديق بلاستيك', 'بالة', 310]],
    [CATEGORIES[2]]: [['فوط قطن', 'بالة', 1680], ['أطقم ملايات', 'بالة', 2250]],
    [CATEGORIES[3]]: [['غلايات كهربائية', 'كرتونة', 1890], ['لمبات ليد 10 عبوات', 'كرتونة', 390], ['شواحن موبايل', 'كرتونة', 1120]],
    [CATEGORIES[4]]: [['مسحوق غسيل 4 كجم', 'كرتونة', 560], ['سائل أطباق 12 عبوة', 'كرتونة', 370]],
  }

  const driverSeed: [string, string, string][] = [
    ['كريم عادل', 'موتوسيكل', 'مدينة نصر'],
    ['محمود فوزي', 'فان', 'الجيزة'],
    ['أحمد شريف', 'موتوسيكل', 'مصر الجديدة'],
    ['مصطفى حسن', 'ربع نقل', '6 أكتوبر'],
    ['إبراهيم نبيل', 'موتوسيكل', 'المعادي'],
    ['حسن رضا', 'فان', 'التجمع الخامس'],
    ['تامر عزت', 'موتوسيكل', 'وسط البلد'],
    ['وليد سعد', 'دراجة', 'الدقي'],
    ['سيد رمزي', 'ربع نقل', 'شبرا'],
  ]
  const drivers: Driver[] = driverSeed.map(([name, vehicle, zone], i) => ({
    id: `D-${i + 1}`,
    name,
    phone: phone(),
    email: `driver${i + 1}@tajzia.demo`,
    password: 'driver123',
    vehicle,
    plate: vehicle === 'دراجة' ? '' : `${pick(['أ', 'ب', 'س', 'م'])} ${pick(['ر', 'ط', 'ن'])} ${int(1000, 9999)}`,
    zone,
    active: i !== 8,
    joinedAt: now - int(60, 700) * DAY,
  }))

  const staff: Staff[] = [
    { id: 'U-1', name: 'عمر خليل', email: 'admin@tajzia.demo', password: 'admin123', title: 'مدير النظام', role: 'admin', active: true, permissions: emptyPermissions(), createdAt: now - 400 * DAY },
    { id: 'U-2', name: 'منى فاروق', email: 'mona@tajzia.demo', password: 'mona123', title: 'مسؤولة مخزون', role: 'staff', active: true, permissions: PRESETS[0].permissions, createdAt: now - 210 * DAY },
    { id: 'U-3', name: 'طارق زكي', email: 'tarek@tajzia.demo', password: 'tarek123', title: 'مسؤول توزيع', role: 'staff', active: true, permissions: PRESETS[1].permissions, createdAt: now - 160 * DAY },
    { id: 'U-4', name: 'سلمى غنيم', email: 'salma@tajzia.demo', password: 'salma123', title: 'محللة مالية', role: 'staff', active: true, permissions: PRESETS[2].permissions, createdAt: now - 60 * DAY },
  ]

  const clients = ['نورا سالم', 'فادي ميشيل', 'رنا عصام', 'مخبز النور', 'فندق الصحراء', 'سوبر ماركت ألفا', 'آية توفيق', 'خالد سعيد', 'كافيه روما', 'مريم وجدي', 'بقالة بالهنا', 'يارا حلمي', 'عمرو بدوي', 'مطعم زهران', 'شريف لطفي', 'صيدلية سيف', 'صلاح يونس', 'نادية غالي', 'نادي أطفال المعادي', 'مطبخ حلو']
  const streets = ['ش عباس العقاد', 'ش مكرم عبيد', 'ش 9', 'ش جامعة الدول', 'ش التحرير', 'ش فيصل', 'ش الميرغني', 'ش شبرا', 'ش التسعين', 'طريق المحور']

  const lifecycle = (createdAt: number): { status: OrderStatus; driverId: string | null; list: OrderEvent[] } => {
    const age = (now - createdAt) / DAY
    const list: OrderEvent[] = [{ at: createdAt, status: 'unassigned', by: pick(['منى فاروق', 'طارق زكي']) }]
    const stage = age > 3 ? 4 : age > 1.5 ? pick([3, 4, 4]) : age > 0.5 ? pick([1, 2, 3, 3, 4]) : pick([0, 0, 1, 2, 3])
    if (stage === 0) return { status: 'unassigned', driverId: null, list }
    const pool = drivers.slice(0, age > 30 ? 9 : 8)
    let at = createdAt + int(1, 6) * HOUR
    const step = (status: OrderStatus, by: string, driverId: string, note?: string) => {
      list.push({ at: Math.min(at, now - 60000), status, by, note, driverId })
    }
    const assign = (d: Driver) => step('assigned', 'طارق زكي', d.id, `أُسند إلى ${d.name}`)

    if (rand() < 0.1) {
      const refuser = pick(pool)
      assign(refuser)
      at += int(5, 50) * 60000
      step('denied', refuser.name, refuser.id, pick(DENY_REASONS))
      if (stage === 1) return { status: 'denied', driverId: null, list }
      at += int(1, 4) * HOUR
    }
    const driver = pick(pool)
    assign(driver)
    if (stage === 1) return { status: 'assigned', driverId: driver.id, list }
    at += int(5, 60) * 60000
    step('accepted', driver.name, driver.id)
    if (stage === 2) return { status: 'accepted', driverId: driver.id, list }
    at += int(1, 10) * HOUR
    step('picked', driver.name, driver.id)
    if (stage === 3) return { status: 'picked', driverId: driver.id, list }
    at += int(40, 400) * 60000
    const failed = rand() < 0.11
    step(failed ? 'failed' : 'delivered', driver.name, driver.id, failed ? pick(['العميل لا يرد', 'العنوان خطأ', 'العميل رفض الاستلام']) : undefined)
    return { status: failed ? 'failed' : 'delivered', driverId: driver.id, list }
  }

  const invoices: Invoice[] = []
  const orders: Order[] = []
  let lineNo = 1
  let orderNo = 20001
  const makeLine = (product: string, unit: string, cost: number, quantity: number): InvoiceLine =>
    ({ id: `L-${lineNo++}`, product, unit, quantity, unitCost: cost })
  const costOf = (items: OrderItem[], lines: InvoiceLine[]) =>
    items.reduce((n, i) => n + i.quantity * (lines.find((l) => l.id === i.lineId)?.unitCost ?? 0), 0)
  const addOrder = (items: OrderItem[], lines: InvoiceLine[], createdAt: number, life: { status: OrderStatus; driverId: string | null; list: OrderEvent[] }) => {
    const zone = pick(ZONES)
    orders.push({
      id: `ORD-${orderNo++}`,
      items,
      price: Math.round((costOf(items, lines) * (1.12 + rand() * 0.22)) / 5) * 5,
      client: pick(clients),
      phone: phone(),
      address: `${int(1, 120)} ${pick(streets)}، ${zone}`,
      zone,
      driverId: life.driverId,
      status: life.status,
      createdAt,
      events: life.list,
    })
  }

  for (let i = 0; i < 36; i++) {
    const supplier = suppliers[i % 7]
    const catalog = [...products[supplier.category]].sort(() => rand() - 0.5)
    const lines = catalog.slice(0, int(1, catalog.length)).map(([product, unit, cost]) => makeLine(product, unit, cost, int(4, 30) * 10))
    const ageDays = i === 0 ? 0.2 : i < 5 ? int(1, 3) : int(3, 88)
    const date = now - ageDays * DAY
    invoices.push({ id: `INV-${1001 + i}`, supplierId: supplier.id, date, note: '', lines })

    const coverage = ageDays < 1 ? 0 : ageDays < 4 ? pick([0.3, 0.6, 0.8]) : i % 9 === 0 ? 0.7 : 1
    const left = new Map(lines.map((l) => [l.id, Math.round(l.quantity * coverage)]))
    for (;;) {
      const open = lines.filter((l) => (left.get(l.id) ?? 0) > 0).sort(() => rand() - 0.5)
      if (!open.length) break
      const items = open.slice(0, int(1, 3)).map((l) => {
        const quantity = Math.min(left.get(l.id) ?? 0, int(Math.ceil(l.quantity / 12), Math.ceil(l.quantity / 4)))
        left.set(l.id, (left.get(l.id) ?? 0) - quantity)
        return { lineId: l.id, quantity }
      })
      const createdAt = Math.min(date + int(2, 48) * HOUR, now - int(1, 8) * HOUR)
      addOrder(items, lines, createdAt, lifecycle(createdAt))
    }
  }

  /* Two fresh invoices feed a fixed set of orders, so the first delivery man's screens show every state,
     including orders that mix products from different suppliers. */
  const foodLines = [makeLine('أرز مصري 5 كجم', 'شوال', 210, 200), makeLine('زيت عباد الشمس 12 عبوة', 'كرتونة', 780, 120), makeLine('سكر 1 كجم 20 عبوة', 'كرتونة', 640, 90)]
  const homeLines = [makeLine('برطمانات زجاج', 'كرتونة', 420, 80), makeLine('طقم حلل تيفال', 'كرتونة', 1340, 40)]
  invoices.push(
    { id: 'INV-1037', supplierId: 'S-1', date: now - 2 * DAY, note: 'توريد الأسبوع', lines: foodLines },
    { id: 'INV-1038', supplierId: 'S-3', date: now - 2 * DAY, note: '', lines: homeLines },
  )
  const allLines = [...foodLines, ...homeLines]
  const karim = drivers[0]
  const script = (hoursAgo: number, items: [InvoiceLine, number][], path: [OrderStatus, string?][]) => {
    const createdAt = now - hoursAgo * HOUR
    const list: OrderEvent[] = [{ at: createdAt, status: 'unassigned', by: 'طارق زكي' }]
    path.forEach(([status, note], i) => {
      const at = createdAt + ((i + 1) * hoursAgo * HOUR) / (path.length + 1)
      list.push(status === 'assigned'
        ? { at, status, by: 'طارق زكي', note: `أُسند إلى ${karim.name}`, driverId: karim.id }
        : { at, status, by: karim.name, note, driverId: karim.id })
    })
    const status = path[path.length - 1][0]
    addOrder(items.map(([l, quantity]) => ({ lineId: l.id, quantity })), allLines, createdAt, { status, driverId: status === 'denied' ? null : karim.id, list })
  }
  const [rice, oil, sugar] = foodLines
  const [jars, pots] = homeLines
  script(3, [[rice, 6], [oil, 2], [pots, 1]], [['assigned']])
  script(2, [[sugar, 3], [jars, 2]], [['assigned']])
  script(1, [[oil, 4]], [['assigned']])
  script(6, [[rice, 10], [sugar, 2]], [['assigned'], ['accepted']])
  script(9, [[jars, 3], [pots, 2], [oil, 1]], [['assigned'], ['accepted'], ['picked']])
  script(7, [[rice, 25], [oil, 12]], [['assigned'], ['denied', 'المركبة لا تتحمل الحمولة']])
  script(20, [[sugar, 5], [rice, 4]], [['assigned'], ['accepted'], ['picked'], ['delivered']])
  script(26, [[pots, 1], [jars, 1]], [['assigned'], ['accepted'], ['picked'], ['failed', 'العميل لا يرد']])

  return { suppliers, invoices, drivers, orders, staff }
}
