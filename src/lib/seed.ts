import type { Db, Driver, Order, OrderEvent, Purchase, Staff, Supplier } from '../types'
import { CATEGORIES, PRESETS, ZONES, emptyPermissions } from './domain'

const DAY = 86400000
const HOUR = 3600000

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
    vehicle,
    plate: vehicle === 'دراجة' ? '' : `${pick(['أ', 'ب', 'س', 'م'])} ${pick(['ر', 'ط', 'ن'])} ${int(1000, 9999)}`,
    zone,
    active: i !== 8,
    joinedAt: now - int(60, 700) * DAY,
  }))

  const staff: Staff[] = [
    { id: 'U-1', name: 'عمر خليل', email: 'admin@tajzia.demo', password: 'admin123', title: 'مدير النظام', role: 'admin', active: true, permissions: emptyPermissions(), createdAt: now - 400 * DAY },
    { id: 'U-2', name: 'منى فاروق', email: 'mona@tajzia.demo', password: 'mona123', title: 'مسؤولة مشتريات', role: 'staff', active: true, permissions: PRESETS[0].permissions, createdAt: now - 210 * DAY },
    { id: 'U-3', name: 'طارق زكي', email: 'tarek@tajzia.demo', password: 'tarek123', title: 'مسؤول توزيع', role: 'staff', active: true, permissions: PRESETS[1].permissions, createdAt: now - 160 * DAY },
    { id: 'U-4', name: 'سلمى غنيم', email: 'salma@tajzia.demo', password: 'salma123', title: 'محللة مالية', role: 'staff', active: true, permissions: PRESETS[2].permissions, createdAt: now - 60 * DAY },
  ]

  const clients = ['نورا سالم', 'فادي ميشيل', 'رنا عصام', 'مخبز النور', 'فندق الصحراء', 'سوبر ماركت ألفا', 'آية توفيق', 'خالد سعيد', 'كافيه روما', 'مريم وجدي', 'بقالة بالهنا', 'يارا حلمي', 'عمرو بدوي', 'مطعم زهران', 'شريف لطفي', 'صيدلية سيف', 'صلاح يونس', 'نادية غالي', 'نادي أطفال المعادي', 'مطبخ حلو']
  const streets = ['ش عباس العقاد', 'ش مكرم عبيد', 'ش 9', 'ش جامعة الدول', 'ش التحرير', 'ش فيصل', 'ش الميرغني', 'ش شبرا', 'ش التسعين', 'طريق المحور']

  const purchases: Purchase[] = []
  const orders: Order[] = []
  const lifecycle = (createdAt: number): { status: Order['status']; driverId: string | null; list: OrderEvent[] } => {
    const age = (now - createdAt) / DAY
    const list: OrderEvent[] = [{ at: createdAt, status: 'unassigned', by: pick(['منى فاروق', 'طارق زكي']) }]
    const stage = age > 3 ? 3 : age > 1.5 ? pick([2, 3, 3]) : age > 0.5 ? pick([1, 2, 2, 3]) : pick([0, 0, 1, 2])
    if (stage === 0) return { status: 'unassigned', driverId: null, list }
    const driver = pick(drivers.slice(0, age > 30 ? 9 : 8))
    let at = createdAt + int(1, 6) * HOUR
    const step = (status: Order['status'], by: string, note?: string) => {
      list.push({ at: Math.min(at, now - 60000), status, by, note })
    }
    step('assigned', 'طارق زكي', `أُسند إلى ${driver.name}`)
    if (stage === 1) return { status: 'assigned', driverId: driver.id, list }
    at += int(1, 10) * HOUR
    step('picked', driver.name)
    if (stage === 2) return { status: 'picked', driverId: driver.id, list }
    at += int(40, 400) * 60000
    const failed = rand() < 0.11
    step(failed ? 'failed' : 'delivered', driver.name, failed ? pick(['العميل لا يرد', 'العنوان خطأ', 'العميل رفض الاستلام']) : undefined)
    return { status: failed ? 'failed' : 'delivered', driverId: driver.id, list }
  }

  let orderNo = 20001
  for (let i = 0; i < 36; i++) {
    const supplier = suppliers[i % 7]
    const [product, unit, cost] = pick(products[supplier.category])
    const ageDays = i === 0 ? 0.2 : i < 5 ? int(1, 3) : int(3, 88)
    const date = now - ageDays * DAY
    const quantity = int(6, 40) * 10
    const id = `PO-${1001 + i}`
    purchases.push({ id, supplierId: supplier.id, product, unit, quantity, unitCost: cost, date, note: '' })

    const coverage = ageDays < 1 ? 0 : ageDays < 4 ? pick([0.3, 0.6, 0.8]) : i % 9 === 0 ? 0.7 : 1
    let left = Math.round(quantity * coverage)
    while (left > 0) {
      const qty = Math.min(left, int(Math.ceil(quantity / 14), Math.ceil(quantity / 5)))
      left -= qty
      const createdAt = Math.min(date + int(2, 48) * HOUR, now - int(1, 8) * HOUR)
      const { status, driverId, list } = lifecycle(createdAt)
      const zone = pick(ZONES)
      orders.push({
        id: `ORD-${orderNo++}`,
        purchaseId: id,
        quantity: qty,
        price: Math.round((qty * cost * (1.12 + rand() * 0.22)) / 5) * 5,
        client: pick(clients),
        phone: phone(),
        address: `${int(1, 120)} ${pick(streets)}، ${zone}`,
        zone,
        driverId,
        status,
        createdAt,
        events: list,
      })
    }
  }
  return { suppliers, purchases, drivers, orders, staff }
}
