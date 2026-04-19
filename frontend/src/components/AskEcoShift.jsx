import React, { useRef, useState } from 'react'

const SUGGESTIONS = [
  'Why is the grid dirty right now?',
  'When is the next green window?',
  'How much CO₂ have we saved today?',
]

export default function AskEcoShift() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages(m => [
      ...m,
      { role: 'user', text },
      {
        role: 'assistant',
        text: "I'm a demo widget — connect me to an LLM endpoint to answer questions about your grid data!",
      },
    ])
    setInput('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 28, right: 28,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          fontSize: 22, zIndex: 300,
          transition: 'transform 0.15s',
        }}
        aria-label="Ask Nimbus"
        title="Ask Nimbus"
      >
        {open ? '×' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 28,
          width: 320, height: 420,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 8px 36px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          zIndex: 300, overflow: 'hidden',
        }}>
          {/* header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontWeight: 600, fontSize: 14, color: 'var(--text)',
            background: 'var(--primary-light)',
          }}>
            Ask Nimbus
          </div>

          {/* messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 4 }}>
                  Try asking:
                </div>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => { setInput(s) }}
                    style={{
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '7px 11px',
                      fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--primary)' : 'var(--bg)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                padding: '8px 12px', borderRadius: 10,
                fontSize: 13, maxWidth: '88%',
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
              }}>
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything…"
              style={{
                flex: 1, padding: '7px 11px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg)', color: 'var(--text)',
                fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                outline: 'none',
              }}
            />
            <button onClick={send} style={{
              padding: '7px 13px', borderRadius: 8,
              background: 'var(--primary)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
