import type { Db, Driver, Invoice, Order, OrderEvent, OrderItem, OrderStatus, Refund, Staff, Supplier } from '../types'
import { CATEGORIES, NOTE_BACK, NOTE_MISSING, PRESETS, ZONES, emptyPermissions } from './domain'

const DAY = 86400000
const HOUR = 3600000
const REFUND_REASONS = ['العميل لا يرد على الهاتف', 'العنوان غير صحيح', 'العميل رفض الاستلام، قال إن المقاس مختلف', 'العميل طلب التأجيل للأسبوع القادم', 'المنتج وصل مكسور']

type Life = { status: OrderStatus; driverId: string | null; list: OrderEvent[]; refund?: Refund }

export function createSeed(now = Date.now()): Db {
  let state = 20261107
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

  /* Product name and the price of one piece, per category. */
  const products: Record<string, [string, number][]> = {
    [CATEGORIES[0]]: [['أرز مصري 5 كجم', 210], ['زيت عباد الشمس', 95], ['سكر 1 كجم', 38], ['زيت زيتون', 260]],
    [CATEGORIES[1]]: [['برطمانات زجاج', 70], ['طقم حلل تيفال', 1340], ['صناديق بلاستيك', 85]],
    [CATEGORIES[2]]: [['فوط قطن', 120], ['طقم ملايات', 450]],
    [CATEGORIES[3]]: [['غلاية كهربائية', 690], ['لمبة ليد', 45], ['شاحن موبايل', 180]],
    [CATEGORIES[4]]: [['مسحوق غسيل 4 كجم', 230], ['سائل أطباق', 40]],
  }
  const unitPrice = new Map(Object.values(products).flat())

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
  const DISPATCH = 'طارق زكي'

  const lifecycle = (createdAt: number): Life => {
    const age = (now - createdAt) / DAY
    const list: OrderEvent[] = [{ at: createdAt, status: 'unassigned', by: pick(['منى فاروق', DISPATCH]) }]
    const stage = age > 3 ? 2 : age > 1 ? pick([1, 2, 2]) : pick([0, 1, 1, 2])
    if (stage === 0) return { status: 'unassigned', driverId: null, list }
    const pool = drivers.slice(0, age > 30 ? 9 : 8)
    let at = createdAt + int(1, 6) * HOUR
    const push = (status: OrderStatus, by: string, driverId: string, note?: string) => list.push({ at: Math.min(at, now - 60000), status, by, note, driverId })
    const assign = (d: Driver) => push('assigned', DISPATCH, d.id, `أُسند إلى ${d.name}`)

    let driver = pick(pool)
    assign(driver)
    if (stage === 1) return { status: 'assigned', driverId: driver.id, list }
    at += int(40, 600) * 60000
    if (rand() < 0.13) {
      const reason = pick(REFUND_REASONS)
      push('refunded', driver.name, driver.id, reason)
      const refundAt = Math.min(at, now - 60000)
      const settled = age > 2
      const back = settled ? rand() < 0.88 : undefined
      if (settled) {
        at += int(1, 5) * HOUR
        push('refunded', DISPATCH, driver.id, back ? NOTE_BACK : NOTE_MISSING)
      }
      /* Some returned orders get a second try with another delivery man. */
      if (!back || age < 4 || rand() < 0.6) return { status: 'refunded', driverId: driver.id, list, refund: { reason, at: refundAt, driverId: driver.id, back } }
      at += int(2, 20) * HOUR
      driver = pick(pool)
      assign(driver)
      at += int(40, 400) * 60000
    }
    push('delivered', driver.name, driver.id)
    return { status: 'delivered', driverId: driver.id, list }
  }

  const invoices: Invoice[] = []
  const orders: Order[] = []
  let orderNo = 20001
  const addOrder = (invoiceId: string, code: string, items: OrderItem[], createdAt: number, life: Life) => {
    const zone = pick(ZONES)
    const goods = items.reduce((n, i) => n + i.quantity * (unitPrice.get(i.product) ?? 100), 0)
    orders.push({
      id: `ORD-${orderNo++}`,
      invoiceId,
      code,
      items,
      price: Math.round(goods / 5) * 5,
      fee: pick([40, 50, 50, 60, 75]),
      client: pick(clients),
      phone: phone(),
      address: `${int(1, 120)} ${pick(streets)}، ${zone}`,
      zone,
      driverId: life.driverId,
      status: life.status,
      createdAt,
      events: life.list,
      refund: life.refund,
    })
  }
  const itemsFrom = (category: string, count: number): OrderItem[] =>
    [...products[category]].sort(() => rand() - 0.5).slice(0, count).map(([product]) => ({ product, category, quantity: int(1, 6) }))

  for (let i = 0; i < 36; i++) {
    const supplier = suppliers[i % 7]
    const ageDays = i === 0 ? 0.2 : i < 5 ? int(1, 3) : int(3, 88)
    const date = now - ageDays * DAY
    const id = `INV-${1001 + i}`
    invoices.push({ id, supplierId: supplier.id, date, note: '' })
    const prefix = supplier.name.split(' ')[0].slice(0, 3)
    for (let n = 0, count = int(3, 10); n < count; n++) {
      const createdAt = Math.min(date + int(1, 4) * HOUR, now - int(1, 3) * HOUR)
      let items = itemsFrom(supplier.category, int(1, 3))
      if (rand() < 0.15) items = [...items, ...itemsFrom(pick(CATEGORIES), 1)].filter((x, k, all) => all.findIndex((y) => y.product === x.product) === k)
      addOrder(id, `${prefix}-${int(1000, 9999)}`, items, createdAt, lifecycle(createdAt))
    }
  }

  /* A fixed set of fresh orders, so the first delivery man's screens show every state. */
  const karim = drivers[0]
  invoices.push({ id: 'INV-1037', supplierId: 'S-1', date: now - 1 * DAY, note: 'توريد الأسبوع' })
  const script = (hoursAgo: number, items: [string, number][], path: [OrderStatus, string?][], back?: boolean) => {
    const createdAt = now - hoursAgo * HOUR
    const list: OrderEvent[] = [{ at: createdAt, status: 'unassigned', by: DISPATCH }]
    path.forEach(([status, note], i) => {
      const at = createdAt + ((i + 1) * hoursAgo * HOUR) / (path.length + 1)
      list.push(status === 'assigned'
        ? { at, status, by: DISPATCH, note: `أُسند إلى ${karim.name}`, driverId: karim.id }
        : { at, status, by: karim.name, note, driverId: karim.id })
    })
    const [status, note] = path[path.length - 1]
    const refundAt = list[list.length - 1].at
    if (back !== undefined) list.push({ at: refundAt + HOUR / 2, status: 'refunded', by: DISPATCH, note: back ? NOTE_BACK : NOTE_MISSING, driverId: karim.id })
    addOrder('INV-1037', `وادي-${5100 + orders.length % 100}`, items.map(([product, quantity]) => ({ product, category: CATEGORIES[0], quantity })), createdAt,
      { status, driverId: karim.id, list, refund: status === 'refunded' ? { reason: note ?? '', at: refundAt, driverId: karim.id, back } : undefined })
  }
  script(3, [['أرز مصري 5 كجم', 2], ['زيت عباد الشمس', 3]], [['assigned']])
  script(2, [['سكر 1 كجم', 6]], [['assigned']])
  script(1, [['زيت زيتون', 1], ['أرز مصري 5 كجم', 1]], [['assigned']])
  script(6, [['زيت عباد الشمس', 4]], [['assigned']])
  script(20, [['سكر 1 كجم', 5], ['أرز مصري 5 كجم', 4]], [['assigned'], ['delivered']])
  script(18, [['زيت زيتون', 2]], [['assigned'], ['refunded', 'العميل لا يرد على الهاتف، اتصلت 3 مرات']])
  script(26, [['أرز مصري 5 كجم', 3]], [['assigned'], ['refunded', 'العميل رفض الاستلام']], true)

  return { suppliers, invoices, drivers, orders, staff }
}
