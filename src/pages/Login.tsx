import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Logo } from '../components/Logo'
import { Button, Field } from '../components/ui'

const ACCOUNTS = [
  { email: 'admin@tajzia.demo', password: 'admin123', role: 'المدير', can: 'كل شيء، بما فيه حسابات الموظفين' },
  { email: 'mona@tajzia.demo', password: 'mona123', role: 'المشتريات', can: 'الموردون والمشتريات، وعرض الطلبات فقط' },
  { email: 'tarek@tajzia.demo', password: 'tarek123', role: 'التوزيع', can: 'الطلبات والمندوبون، وعرض المشتريات فقط' },
  { email: 'salma@tajzia.demo', password: 'salma123', role: 'المالية', can: 'التقارير والتصدير فقط' },
]

const PIECES = [
  { grow: 30, who: 'كريم', qty: 90 },
  { grow: 16, who: 'محمود', qty: 48 },
  { grow: 24, who: 'أحمد', qty: 72 },
  { grow: 10, who: 'حسن', qty: 30 },
  { grow: 20, who: 'تامر', qty: 60 },
]

export function Login() {
  const { login } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(login(email, password) ?? '')
  }

  return (
    <div className="login">
      <section className="login-hero">
        <Logo />
        <div className="hero-body">
          <h1>شحنة واحدة تدخل.<br />طلبات كثيرة تخرج.</h1>
          <div className="hero-cut" aria-hidden>
            <p className="hero-load">300 كرتونة زيت عباد الشمس، رقم الشراء PO-1042</p>
            <div className="hero-bar">
              {PIECES.map((p, i) => (
                <div key={p.who} className="hero-piece" style={{ flexGrow: p.grow, '--i': i } as React.CSSProperties}>
                  <b>{p.qty}</b>
                  <span>{p.who}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="hero-note">اشترِ من الموردين، قسّم كل عملية شراء إلى طلبات للعملاء، وأسند كل طلب إلى مندوب توصيل.</p>
        </div>
      </section>
      <section className="login-side">
        <form className="login-form" onSubmit={submit} noValidate>
          <h2>تسجيل الدخول</h2>
          <Field label="البريد الإلكتروني"><input dir="ltr" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="كلمة المرور"><input dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit">دخول</Button>
        </form>
        <div className="demo-accounts">
          <h3>حسابات تجريبية</h3>
          <p>اختر حسابًا لملء النموذج. لكل حساب صفحات مختلفة، وكل البيانات تبقى في هذا المتصفح.</p>
          <ul>
            {ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button type="button" onClick={() => { setEmail(a.email); setPassword(a.password); setError('') }}>
                  <strong>{a.role}</strong>
                  <span className="acct-login" dir="ltr">{a.email} / {a.password}</span>
                  <span>{a.can}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
