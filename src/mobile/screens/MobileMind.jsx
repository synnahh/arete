// MobileMind.jsx — Mind OS for VALERIE iOS PWA
// Sections: Constitution · Advisors · Ledger · Beliefs · Vault · Insights

import { useState, useRef, useEffect } from 'react';
import { useCollection } from '../../supabase/useCollection.js';
import { useDocument }   from '../../supabase/useDocument.js';
import { askClaudeRaw }  from '../../utils/claudeRaw.js';

// ─── Shared primitives ────────────────────────────────────────────────────────

function MCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)',
      borderRadius: 16, overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)',
        fontFamily: 'ui-monospace,monospace', marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

const INPUT = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 10,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 14, outline: 'none', fontFamily: 'inherit',
};
const TA = { ...INPUT, resize: 'none', lineHeight: 1.65, minHeight: 80 };
const BTN = {
  width: '100%', padding: '13px', borderRadius: 12, border: 'none',
  cursor: 'pointer', background: 'var(--accent)', color: '#fff',
  fontSize: 14, fontWeight: 600,
};
const BTN_GHOST = {
  padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
  border: '0.5px solid rgba(255,255,255,0.12)',
  background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
};

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '4px 0', alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
          animation: `mBounce 0.9s ${i*0.15}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Section nav ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'constitution', label: 'Constitution', emoji: '📜' },
  { id: 'advisors',     label: 'Advisors',     emoji: '🧠' },
  { id: 'ledger',       label: 'Ledger',       emoji: '📖' },
  { id: 'beliefs',      label: 'Beliefs',      emoji: '💡' },
  { id: 'vault',        label: 'Vault',        emoji: '🗄️'  },
  { id: 'insights',     label: 'Insights',     emoji: '🔮' },
];

// ─── CONSTITUTION ─────────────────────────────────────────────────────────────

function Constitution({ constitution, onSave }) {
  const [values, setValues]   = useState(constitution?.values || '');
  const [principles, setP]    = useState(constitution?.principles || '');
  const [rules, setR]         = useState(constitution?.rules || '');
  const [nonNeg, setN]        = useState(constitution?.nonNegotiables || '');
  const [identity, setId]     = useState(constitution?.identity || '');
  const [saved, setSaved]     = useState(false);

  function save() {
    onSave({ values, principles, rules, nonNegotiables: nonNeg, identity, lastUpdated: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
        Your values and principles — fed to every AI advisor as context.
      </div>
      {[
        { label: 'Identity', val: identity, set: setId, ph: 'I am a builder...' },
        { label: 'Core Values', val: values, set: setValues, ph: '1. Integrity\n2. Growth...' },
        { label: 'Principles', val: principles, set: setP, ph: 'Build first, consume second...' },
        { label: 'Rules', val: rules, set: setR, ph: 'No social media before 10am...' },
        { label: 'Non-Negotiables', val: nonNeg, set: setN, ph: 'Never compromise on honesty...' },
      ].map(f => (
        <Row key={f.label} label={f.label}>
          <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
            style={{ ...TA, minHeight: f.label === 'Identity' ? 60 : 80 }} />
        </Row>
      ))}
      <button onClick={save} style={BTN}>{saved ? '✓ Saved' : 'Save Constitution'}</button>
    </div>
  );
}

// ─── ADVISORS ─────────────────────────────────────────────────────────────────

const ADVISORS = [
  { id: 'career',    name: 'Career Coach',      colour: '#4a9eff', emoji: 'C',
    prompt: 'You are an experienced executive career coach. Direct, no-nonsense, max 3 paragraphs.' },
  { id: 'learning',  name: 'Learning Coach',    colour: '#a78bfa', emoji: 'L',
    prompt: 'You are a world-class learning strategist. Cognitive science, deliberate practice. Max 3 paragraphs.' },
  { id: 'strategist',name: 'Strategist',        colour: '#6BE3A4', emoji: 'S',
    prompt: 'You are a sharp strategic advisor. First principles, leverage points, systems. Max 3 paragraphs.' },
  { id: 'skeptic',   name: 'Skeptic',           colour: '#f4a642', emoji: '?',
    prompt: 'You stress-test ideas and find flaws in reasoning. Direct and honest. Max 3 paragraphs.' },
  { id: 'future',    name: 'Future Self',        colour: '#e879f9', emoji: 'F',
    prompt: 'You are this person\'s future self, 10 years from now. Warm, honest, hindsight wisdom. Max 3 paragraphs.' },
  { id: 'devil',     name: "Devil's Advocate",  colour: '#e55a5a', emoji: 'D',
    prompt: 'You argue the strongest case against whatever is being considered. Max 3 paragraphs.' },
];

function AdvisorChat({ advisor, constitution, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  const sysPrompt = advisor.prompt + (constitution?.values
    ? `\n\nUser constitution:\nIdentity: ${constitution.identity||''}\nValues: ${constitution.values||''}\nPrinciples: ${constitution.principles||''}`
    : '');

  async function send(text) {
    const msg = (text || input).trim(); if (!msg || loading) return;
    setInput('');
    const next = [...msgs, { role: 'user', content: msg }];
    setMsgs(next); setLoading(true);
    try {
      const reply = await askClaudeRaw(msg, sysPrompt, msgs);
      setMsgs([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px', flexShrink: 0,
        borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>‹</button>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: advisor.colour + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 12, color: advisor.colour }}>{advisor.emoji}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{advisor.name}</div>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
            {['What should I focus on right now?', 'Where is my biggest blind spot?', 'Challenge my current direction.'].map(s => (
              <button key={s} onClick={() => send(s)} style={{
                padding: '7px 13px', borderRadius: 20, fontSize: 12,
                border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer', textAlign: 'left',
              }}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%', padding: '10px 14px', fontSize: 14, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              background: m.role === 'user' ? 'var(--accent)22' : 'rgba(255,255,255,0.05)',
              border: `0.5px solid ${m.role === 'user' ? 'var(--accent)44' : 'rgba(255,255,255,0.08)'}`,
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ padding: '4px 0' }}><Spinner /></div>}
        <div ref={endRef} />
      </div>
      {/* Input */}
      <div style={{ padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', flexShrink: 0,
        borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`Ask ${advisor.name}...`}
          style={{ ...INPUT, flex: 1, borderRadius: 20, padding: '11px 16px' }} />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{ ...BTN, width: 'auto', padding: '11px 18px', borderRadius: 20, opacity: (!input.trim()||loading)?0.5:1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

function Advisors({ constitution }) {
  const [active, setActive] = useState(null);
  if (active) return <AdvisorChat advisor={ADVISORS.find(a => a.id === active)} constitution={constitution} onBack={() => setActive(null)} />;

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
        Six perspectives on your life and decisions.
      </div>
      {ADVISORS.map(adv => (
        <MCard key={adv.id} style={{ borderLeft: `3px solid ${adv.colour}`, cursor: 'pointer' }}
          onClick={() => setActive(adv.id)}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: adv.colour + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 12, color: adv.colour, flexShrink: 0 }}>{adv.emoji}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: adv.colour, marginBottom: 2 }}>{adv.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
                {{ career:'Career trajectory & blind spots', learning:'Skill acquisition & practice',
                   strategist:'Long-game & leverage points', skeptic:'Stress-tests your thinking',
                   future:'10-year future self wisdom', devil:'Strongest counterarguments' }[adv.id]}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>›</div>
          </div>
        </MCard>
      ))}
    </div>
  );
}

// ─── LEDGER ───────────────────────────────────────────────────────────────────

const LEDGER_COLS = { decision: '#4a9eff', failure: '#e55a5a', wisdom: '#6BE3A4' };

function Ledger() {
  const decisions = useCollection('mind_decisions', 'valerie_decisions');
  const failures  = useCollection('mind_failures',  'valerie_failures');
  const wisdom    = useCollection('mind_wisdom',     'valerie_wisdom');

  const [showAdd, setShowAdd] = useState(false);
  const [type, setType]       = useState('decision');
  const [form, setForm]       = useState({});

  const all = [...decisions.items.map(d=>({...d,_t:'decision'})), ...failures.items.map(f=>({...f,_t:'failure'})), ...wisdom.items.map(w=>({...w,_t:'wisdom'}))]
    .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  function add() {
    const store = type === 'decision' ? decisions : type === 'failure' ? failures : wisdom;
    store.add({ ...form, type, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
    setForm({}); setShowAdd(false);
  }

  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => setShowAdd(v=>!v)} style={BTN}>+ Add entry</button>

      {showAdd && (
        <MCard>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['decision','failure','wisdom'].map(t => (
                <button key={t} onClick={() => { setType(t); setForm({}); }} style={{
                  flex: 1, padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: type===t ? LEDGER_COLS[t]+'33' : 'rgba(255,255,255,0.06)',
                  color: type===t ? LEDGER_COLS[t] : 'rgba(255,255,255,0.4)',
                }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            <input placeholder={type==='decision'?'The decision':type==='failure'?'What failed':'The insight'}
              value={form.title||''} onChange={e=>f('title',e.target.value)} style={INPUT} />
            <textarea placeholder={type==='decision'?'Reasoning...':type==='failure'?'What happened & why...':'Context...'}
              value={form.reasoning||form.what||form.context||''} onChange={e=>f(type==='decision'?'reasoning':type==='failure'?'what':'context',e.target.value)} style={TA} />
            {type==='decision' && <input type="number" min="1" max="10" placeholder="Confidence (1-10)"
              value={form.confidence||''} onChange={e=>f('confidence',e.target.value)} style={INPUT} />}
            {type==='failure' && <textarea placeholder="Lesson learned..." value={form.lesson||''} onChange={e=>f('lesson',e.target.value)} style={TA} />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...BTN_GHOST, flex: 1 }}>Cancel</button>
              <button onClick={add} style={{ ...BTN, flex: 2 }}>Add</button>
            </div>
          </div>
        </MCard>
      )}

      {all.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          No entries yet. Log your first decision, failure, or insight.
        </div>
      ) : all.map((e,i) => {
        const col = LEDGER_COLS[e._t];
        return (
          <MCard key={e.id||i} style={{ borderLeft: `3px solid ${col}` }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: col, letterSpacing: '0.1em',
                  background: col+'20', padding: '2px 7px', borderRadius: 20 }}>
                  {e._t.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>{e.date}</span>
                {e.confidence && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{e.confidence}/10</span>}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{e.title}</div>
              {(e.reasoning||e.what||e.context) && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 5, lineHeight: 1.6,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {e.reasoning||e.what||e.context}
                </div>
              )}
            </div>
          </MCard>
        );
      })}
    </div>
  );
}

// ─── BELIEFS ──────────────────────────────────────────────────────────────────

function Beliefs() {
  const beliefs = useCollection('mind_beliefs', 'valerie_beliefs');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:'', context:'', confidence:'7', tags:'' });

  function add() {
    if (!form.title.trim()) return;
    beliefs.add({ ...form, confidence: parseInt(form.confidence)||7, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
    setForm({ title:'', context:'', confidence:'7', tags:'' }); setShowAdd(false);
  }

  const sorted = [...beliefs.items].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => setShowAdd(v=>!v)} style={BTN}>+ Add belief</button>

      {showAdd && (
        <MCard>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="The belief (e.g. Consistency beats intensity)"
              value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} style={INPUT} />
            <textarea placeholder="Context — what formed this belief?"
              value={form.context} onChange={e => setForm(p=>({...p,context:e.target.value}))} style={TA} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min="1" max="10" placeholder="Confidence (1-10)"
                value={form.confidence} onChange={e => setForm(p=>({...p,confidence:e.target.value}))} style={{ ...INPUT, flex: 1 }} />
              <input placeholder="Tags..." value={form.tags} onChange={e => setForm(p=>({...p,tags:e.target.value}))}
                style={{ ...INPUT, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...BTN_GHOST, flex: 1 }}>Cancel</button>
              <button onClick={add} style={{ ...BTN, flex: 2 }}>Add</button>
            </div>
          </div>
        </MCard>
      )}

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          No beliefs logged yet. Start with your most firmly held ones.
        </div>
      ) : sorted.map((b,i) => {
        const conf = b.confidence || 0;
        const col = conf>=8?'#6BE3A4':conf>=5?'#f4a642':'#e55a5a';
        return (
          <MCard key={b.id||i}>
            <div style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: 'ui-monospace,monospace' }}>{conf}/10</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>{b.date}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>{b.title}</div>
              {b.context && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{b.context}</div>}
              <div style={{ marginTop: 8, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                <div style={{ height: '100%', width: `${(conf/10)*100}%`, background: col, borderRadius: 2 }} />
              </div>
            </div>
          </MCard>
        );
      })}
    </div>
  );
}

// ─── VAULT ────────────────────────────────────────────────────────────────────

const VTYPES = [
  {id:'note',icon:'📝',colour:'#4a9eff'},{id:'idea',icon:'💡',colour:'#a78bfa'},
  {id:'insight',icon:'✨',colour:'#6BE3A4'},{id:'lesson',icon:'📚',colour:'#f4a642'},
  {id:'quote',icon:'💬',colour:'#e879f9'},{id:'project',icon:'🎯',colour:'#e55a5a'},
];

function Vault() {
  const memories = useCollection('mind_memories', 'valerie_memories');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:'', content:'', type:'note', tags:'' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  function add() {
    if (!form.title.trim()) return;
    memories.add({ ...form, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
    setForm({ title:'', content:'', type:'note', tags:'' }); setShowAdd(false);
  }

  const filtered = memories.items.filter(m => {
    if (filter !== 'all' && m.type !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.title||'').toLowerCase().includes(q) || (m.content||'').toLowerCase().includes(q) || (m.tags||'').toLowerCase().includes(q);
  }).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vault..."
        style={{ ...INPUT, borderRadius: 20 }} />
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {['all',...VTYPES.map(t=>t.id)].map(v => {
          const t = VTYPES.find(x=>x.id===v);
          return (
            <button key={v} onClick={()=>setFilter(v)} style={{
              padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
              fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em',
              background: filter===v ? (t?t.colour+'33':'var(--accent)') : 'rgba(255,255,255,0.06)',
              color: filter===v ? (t?t.colour:'#fff') : 'rgba(255,255,255,0.4)',
            }}>{v.toUpperCase()}</button>
          );
        })}
      </div>

      <button onClick={() => setShowAdd(v=>!v)} style={BTN}>+ Add memory</button>

      {showAdd && (
        <MCard>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Title" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={{ ...INPUT, fontSize: 15, fontWeight: 500 }} />
            <textarea placeholder="Content..." value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={{ ...TA, minHeight: 100 }} />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {VTYPES.map(t => (
                <button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id}))} style={{
                  padding: '5px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: form.type===t.id?t.colour+'33':'rgba(255,255,255,0.06)',
                  color: form.type===t.id?t.colour:'rgba(255,255,255,0.4)',
                }}>{t.icon} {t.id}</button>
              ))}
            </div>
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} style={INPUT} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...BTN_GHOST, flex: 1 }}>Cancel</button>
              <button onClick={add} style={{ ...BTN, flex: 2 }}>Add</button>
            </div>
          </div>
        </MCard>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          {search ? `No results for "${search}"` : 'Vault is empty.'}
        </div>
      ) : filtered.map((m,i) => {
        const t = VTYPES.find(x=>x.id===m.type)||VTYPES[0];
        return (
          <MCard key={m.id||i}>
            <div style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.colour, letterSpacing: '0.1em',
                  background: t.colour+'20', padding: '2px 7px', borderRadius: 20 }}>
                  {t.id.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', marginLeft: 'auto' }}>{m.date}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>{m.title}</div>
              {m.content && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.content}</div>}
            </div>
          </MCard>
        );
      })}
    </div>
  );
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────

const INSIGHTS = [
  { id: 'alignment', title: 'Alignment Score', colour: '#6BE3A4', emoji: '🎯',
    prompt: (c) => `Analyse alignment between stated values and likely behaviour.\n\nConstitution:\n${c}\n\nIdentify: 1) where they are likely living in alignment, 2) likely contradictions, 3) suggested Alignment Score out of 100. Be direct and specific.` },
  { id: 'regret', title: 'Regret Forecast', colour: '#e879f9', emoji: '🔮',
    prompt: (c) => `Conduct a regret forecasting analysis.\n\nConstitution:\n${c}\n\nIdentify: 1) top 3 most likely regrets in 10 years, 2) the single most important thing to start NOW. Be honest and direct.` },
  { id: 'laws', title: 'Personal Laws', colour: '#f4a642', emoji: '⚡',
    prompt: (c) => `Discover this person's Personal Laws — recurring patterns and truths.\n\nConstitution:\n${c}\n\nGenerate 5 candidate Personal Laws specific to them. Format: "Law: [statement]" followed by explanation.` },
];

function Insights({ constitution }) {
  const [active, setActive] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const cText = constitution
    ? `Identity: ${constitution.identity||''}\nValues: ${constitution.values||''}\nPrinciples: ${constitution.principles||''}`
    : null;

  async function run(ins) {
    if (!cText) { setActive(ins.id); setResult('Complete your Constitution first.'); return; }
    setActive(ins.id); setResult(''); setLoading(true);
    try {
      const reply = await askClaudeRaw('Run the analysis now.', ins.prompt(cText));
      setResult(reply);
    } catch(e) { setResult(`Error: ${e.message}`); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!cText && (
        <MCard style={{ background: 'rgba(242,192,99,0.05)', border: '0.5px solid rgba(242,192,99,0.2)' }}>
          <div style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(242,192,99,0.8)', lineHeight: 1.6 }}>
            Complete your Constitution first for meaningful insights.
          </div>
        </MCard>
      )}
      {INSIGHTS.map(ins => (
        <MCard key={ins.id} style={{ borderLeft: `3px solid ${ins.colour}`, cursor: 'pointer' }}
          onClick={() => run(ins)}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>{ins.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: ins.colour, marginBottom: 2 }}>{ins.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {ins.id==='alignment'?'Are your actions matching your values?':ins.id==='regret'?'What will you regret in 10 years?':'What are your recurring personal patterns?'}
              </div>
            </div>
            {loading && active===ins.id ? <Spinner /> : <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>›</div>}
          </div>
        </MCard>
      ))}

      {active && result && (
        <MCard>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: INSIGHTS.find(i=>i.id===active)?.colour,
              fontFamily: 'ui-monospace,monospace', marginBottom: 10 }}>
              {INSIGHTS.find(i=>i.id===active)?.title?.toUpperCase()} — ANALYSIS
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {result}
            </div>
          </div>
        </MCard>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function MobileMind() {
  const [section, setSection] = useState('constitution');
  const constitutionDoc = useDocument('constitution', 'valerie_constitution', null);

  const activeSection = SECTIONS.find(s => s.id === section);
  const isAdvisorChat = section === 'advisors'; // advisors handles its own back nav

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>Mind</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em' }}>
            PERSONAL OS
          </div>
        </div>
        {/* Scrollable pill nav */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12,
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em',
              background: section === s.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: section === s.id ? '#fff' : 'rgba(255,255,255,0.4)',
            }}>{s.emoji} {s.label.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {section === 'constitution' && <Constitution constitution={constitutionDoc.data} onSave={constitutionDoc.save} />}
        {section === 'advisors'     && <Advisors constitution={constitutionDoc.data} />}
        {section === 'ledger'       && <Ledger />}
        {section === 'beliefs'      && <Beliefs />}
        {section === 'vault'        && <Vault />}
        {section === 'insights'     && <Insights constitution={constitutionDoc.data} />}
      </div>

      <style>{`
        @keyframes mBounce {
          0%,100% { transform:translateY(0); opacity:0.4; }
          50% { transform:translateY(-4px); opacity:1; }
        }
      `}</style>
    </div>
  );
}
