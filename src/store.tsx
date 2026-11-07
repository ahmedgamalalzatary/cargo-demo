import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { Action, Db, Driver, Module, Staff } from './types'
import { can as canDo } from './lib/domain'
import { createSeed } from './lib/seed'

const DB_KEY = 'tajzia-db-ar-v3'
const SESSION_KEY = 'tajzia-session-ar'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The demo still works for this visit when storage is unavailable.
  }
}

interface Store {
  db: Db
  setDb: Dispatch<SetStateAction<Db>>
  user: Staff | null
  driver: Driver | null
  login: (email: string, password: string) => string | null
  logout: () => void
  can: (module: Module, action: Action) => boolean
  reset: () => void
  toast: (message: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(() => read<Db>(DB_KEY) ?? createSeed())
  const [userId, setUserId] = useState<string | null>(() => read<string>(SESSION_KEY))
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([])

  useEffect(() => write(DB_KEY, db), [db])
  useEffect(() => write(SESSION_KEY, userId), [userId])

  const user = useMemo(() => db.staff.find((s) => s.id === userId && s.active) ?? null, [db.staff, userId])
  const driver = useMemo(() => db.drivers.find((d) => d.id === userId && d.active) ?? null, [db.drivers, userId])

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const value = useMemo<Store>(
    () => ({
      db,
      setDb,
      user,
      driver,
      toast,
      login(email, password) {
        /* Email is optional, so an account can also sign in by name. Names may repeat; the password picks the account. */
        const id = email.trim().toLowerCase()
        const found = id ? [...db.staff, ...db.drivers].find((s) => (s.email.toLowerCase() === id || s.name.trim().toLowerCase() === id) && s.password === password) : undefined
        if (!found) return 'بيانات الدخول أو كلمة المرور غير صحيحة.'
        if (!found.active) return 'هذا الحساب معطّل. اطلب من المدير تفعيله.'
        window.location.hash = '#/'
        setUserId(found.id)
        return null
      },
      logout() {
        setUserId(null)
        window.location.hash = '#/'
      },
      can: (m, a) => canDo(user, m, a),
      reset() {
        setDb(createSeed())
        setUserId(null)
        window.location.hash = '#/'
      },
    }),
    [db, user, driver, toast],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div className="toast" key={t.id}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  )
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore needs StoreProvider')
  return v
}
