import { useState, useEffect, useRef } from 'react'
import './index.css'

// ── Types ─────────────────────────────────────────────────────
interface PaymentReceipt {
  amount: string
  currency: string
  network: string
  scheme: string
  balanceBefore: string
  balanceAfter: string
}
interface Message {
  role: 'user' | 'assistant'
  content: string
  receipt?: PaymentReceipt
}
interface Balance { gateway: string; wallet: string }
type StepStatus = 'idle' | 'active' | 'done'

// ── Payment steps ─────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Request sent',          sub: 'POST /chat' },
  { id: 2, label: '402 Payment Required',  sub: 'Server requests payment' },
  { id: 3, label: 'Sign authorization',    sub: 'EIP-3009 · zero gas' },
  { id: 4, label: 'Circle Gateway settle', sub: 'GatewayWalletBatched' },
  { id: 5, label: 'Response delivered',    sub: 'Inference complete' },
]
const STEP_DELAYS = [0, 700, 1500, 2500]

function Dots() {
  return (
    <span className="flex gap-1 items-center h-5">
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full bg-emerald-500 inline-block dot-${i + 1}`} />
      ))}
    </span>
  )
}

function StepItem({ step, status, last }: { step: typeof STEPS[0]; status: StepStatus; last: boolean }) {
  const done    = status === 'done'
  const active  = status === 'active'
  return (
    <div className="flex gap-3">
      {/* timeline */}
      <div className="flex flex-col items-center" style={{ width: 28 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontFamily: 'DM Mono, monospace', flexShrink: 0,
          fontWeight: 600, transition: 'all 0.3s',
          background: done ? '#10b981' : active ? '#f0fdf4' : '#f8fafc',
          border: done ? 'none' : active ? '2px solid #10b981' : '1.5px solid #e2e8f0',
          color: done ? '#fff' : active ? '#10b981' : '#94a3b8',
        }}>
          {done
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : step.id}
        </div>
        {!last && (
          <div style={{ width: 1, flex: 1, minHeight: 12, margin: '3px 0', background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>
            {done && <div style={{ position: 'absolute', inset: 0, background: '#10b981' }} className="step-connector-fill" />}
          </div>
        )}
      </div>

      {/* text */}
      <div style={{ paddingBottom: last ? 0 : 12 }}>
        <p style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, lineHeight: 1.3,
          color: done ? '#059669' : active ? '#0f172a' : '#cbd5e1',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {step.label}
          {step.id === 3 && done && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 20,
              background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
              fontFamily: 'DM Mono, monospace', fontWeight: 500,
            }}>zero gas</span>
          )}
        </p>
        <p style={{
          fontFamily: 'DM Mono, monospace', fontSize: 11, marginTop: 2,
          color: done ? '#34d399' : active ? '#64748b' : '#e2e8f0',
        }}>
          {step.sub}
        </p>
        {active && <div style={{ marginTop: 6 }}><Dots /></div>}
      </div>
    </div>
  )
}

function Pipeline({ step }: { step: number }) {
  const getStatus = (id: number): StepStatus =>
    id < step ? 'done' : id === step ? 'active' : 'idle'
  return (
    <div className="animate-fade-up" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 20px 16px' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16, fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
        Payment flow
      </p>
      {STEPS.map((s, i) => (
        <StepItem key={s.id} step={s} status={getStatus(s.id)} last={i === STEPS.length - 1} />
      ))}
    </div>
  )
}

function Receipt({ r }: { r: PaymentReceipt }) {
  const deducted = (parseFloat(r.balanceBefore) - parseFloat(r.balanceAfter)).toFixed(6)
  const rows = [
    { l: 'Amount',         v: `$${r.amount} ${r.currency}`, green: true },
    { l: 'Network',        v: r.network },
    { l: 'Scheme',         v: r.scheme,          mono: true },
    { l: 'Balance before', v: `${r.balanceBefore} USDC`, mono: true },
    { l: 'Balance after',  v: `${r.balanceAfter} USDC`,  mono: true },
    { l: 'Deducted',       v: `−${deducted} USDC`,       mono: true, dim: true },
  ]
  return (
    <div className="animate-fade-up" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '20px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#059669', fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
          Receipt
        </p>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#10b981', color: '#fff', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
          settled
        </span>
      </div>
      {rows.map(({ l, v, green, mono, dim }) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #d1fae5' }}>
          <span style={{ fontSize: 12, color: '#065f46' }}>{l}</span>
          <span style={{
            fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: green ? '#059669' : dim ? '#94a3b8' : '#1e293b',
            fontFamily: mono ? 'DM Mono, monospace' : undefined,
          }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Explainer() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 20px 16px' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16, fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
        How it works
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {STEPS.map(s => (
          <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0',
              color: '#64748b', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontFamily: 'DM Mono, monospace', fontWeight: 600,
            }}>{s.id}</span>
            <div>
              <p style={{ fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{s.label}</p>
              <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#94a3b8', marginTop: 2 }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9', lineHeight: 1.6 }}>
        No wallet pop-ups. No gas per call. Circle batches signed authorizations and settles onchain.
      </p>
    </div>
  )
}

const SUGGESTIONS = [
  "Unlock supplier for Jordan 1 reps under $60",
  "Get factory price + 1688 link for LV bags wholesale to Europe",
  "Find direct supplier for Yeezy reps with shipping to US",
  "Unlock bulk iPhone case factory details (¥ price converted to $)",
];

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 24px', gap: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
        ⚡
      </div>
      <div>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#0f172a' }}>AgentBuy Bridge</p>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
          Pay <span style={{ color: '#059669', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>$0.005 USDC</span> to unlock direct Chinese supplier details.<br />
          Gas-free nanopayments on Arc • Ideal for autonomous commerce flows.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onSuggest(s)} style={{
            textAlign: 'left', fontSize: 14, color: '#475569', padding: '10px 16px', borderRadius: 12,
            border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer',
            transition: 'all 0.15s', fontFamily: 'Instrument Sans, sans-serif',
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = '#6ee7b7'; (e.target as HTMLElement).style.background = '#f0fdf4'; (e.target as HTMLElement).style.color = '#064e3b' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = '#e2e8f0'; (e.target as HTMLElement).style.background = '#fff'; (e.target as HTMLElement).style.color = '#475569' }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [balance, setBalance]         = useState<Balance>({ gateway: '—', wallet: '—' })
  const [balFetching, setBalFetching] = useState(true)
  const [lastReceipt, setLastReceipt] = useState<PaymentReceipt | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { fetchBalance() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const fetchBalance = async () => {
    setBalFetching(true)
    try {
      const r = await fetch('/demo/balance')
      setBalance(await r.json())
    } catch { setBalance({ gateway: 'error', wallet: '—' }) }
    finally { setBalFetching(false) }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setLastReceipt(null)
    setCurrentStep(1)
    timers.current.forEach(clearTimeout)
    timers.current = STEP_DELAYS.slice(1).map((d, i) =>
      setTimeout(() => setCurrentStep(i + 2), d)
    )
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      })
      timers.current.forEach(clearTimeout)
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed')
      const data = await res.json()
      setCurrentStep(5)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, receipt: data.payment }])
        setLastReceipt(data.payment)
        setCurrentStep(0)
        setLoading(false)
        fetchBalance()
      }, 700)
    } catch (err) {
      timers.current.forEach(clearTimeout)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }])
      setCurrentStep(0)
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 56, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>N</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>AgentBuy Bridge</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>/ Pay $0.005 USDC to unlock Chinese supplier details </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#475569', fontWeight: 500 }}>Base Sepolia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: balFetching ? '#f59e0b' : '#10b981', display: 'inline-block', transition: 'background 0.3s' }} />
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#065f46', fontWeight: 500 }}>
              Gateway: <strong>{balFetching ? '...' : `${balance.gateway} USDC`}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', gap: 20, padding: '20px 24px', overflow: 'hidden', maxWidth: 1280, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ── Chat panel ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
          overflow: 'hidden',
        }}>
          {/* Messages scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 && !loading
              ? <EmptyState onSuggest={s => { setInput(s); inputRef.current?.focus() }} />
              : messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="animate-fade-up" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        maxWidth: '72%', borderRadius: '18px 18px 4px 18px', padding: '12px 16px',
                        background: '#1e293b', color: '#f1f5f9', fontSize: 14, lineHeight: 1.65,
                        fontFamily: 'Instrument Sans, sans-serif',
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="animate-fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>N</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          borderRadius: '18px 18px 18px 4px', padding: '12px 16px',
                          background: '#f8fafc', border: '1px solid #e2e8f0',
                          color: '#1e293b', fontSize: 14, lineHeight: 1.65,
                          fontFamily: 'Instrument Sans, sans-serif',
                        }}>
                          {m.content}
                        </div>
                        {m.receipt && (
                          <p style={{ fontSize: 11, marginTop: 6, color: '#059669', fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
                            ✓ ${m.receipt.amount} USDC paid · {m.receipt.balanceBefore} → {m.receipt.balanceAfter} USDC
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )
            }
            {loading && (
              <div className="animate-fade-up" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>N</span>
                </div>
                <div style={{ borderRadius: '18px 18px 18px 4px', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                  <Dots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
                placeholder="Type a product or ask for supplier details -  costs $0.005 USDC"
                rows={1}
                style={{
                  flex: 1, resize: 'none', outline: 'none', fontSize: 14, lineHeight: 1.6,
                  padding: '10px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0',
                  background: '#f8fafc', color: '#0f172a', fontFamily: 'Instrument Sans, sans-serif',
                  opacity: loading ? 0.5 : 1, transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#6ee7b7')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                style={{
                  width: 42, height: 42, borderRadius: 12, background: '#10b981', border: 'none',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !input.trim() ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2l2 6-2 6 12-6z" fill="white" />
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#cbd5e1', marginTop: 8, textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>
              ↵ send · shift+↵ newline · powered by Circle Gateway Nano Payments
            </p>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Pipeline or explainer */}
          {currentStep > 0
            ? <Pipeline step={currentStep} />
            : (lastReceipt ? <Receipt r={lastReceipt} /> : <Explainer />)
          }

          {/* Stats */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px' }}>
            {[
              { l: 'Price / call', v: '$0.005 USDC', green: true },
              { l: 'Network',      v: 'Base Sepolia', green: false },
              { l: 'Settlement',   v: 'Batched',      green: false },
              { l: 'Gas per call', v: '$0.00',        green: true },
            ].map(({ l, v, green }) => (
              <div key={l}>
                <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>{l}</p>
                <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: green ? '#059669' : '#1e293b', fontFamily: 'Syne, sans-serif' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
