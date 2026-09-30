// Mind.jsx — Personal Operating System
// Tabs: Constitution · Advisors · Ledger · Beliefs · Vault · Insights

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCollection } from '../supabase/useCollection.js';
import { useDocument }   from '../supabase/useDocument.js';
import { STORAGE_KEYS }  from '../utils/storage.js';
import { askClaudeRaw }  from '../utils/claudeRaw.js';
import { toLocalDateKey } from '../utils/localDate.js';
import BreathingTool from '../components/BreathingTool.jsx';

// ─── Shared design tokens ─────────────────────────────────────────────────────

const GLASS = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)',
  position: 'relative', overflow: 'hidden',
};

function GlassCard({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ ...GLASS, padding: '18px 20px', ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace,monospace' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,0.1),transparent)' }} />
    </div>
  );
}

const INPUT = {
  padding: '9px 12px', borderRadius: 9,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.85)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};

const TEXTAREA = {
  ...INPUT, resize: 'vertical', lineHeight: 1.65, minHeight: 80,
};

const BTN = {
  padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
  transition: 'opacity 0.15s',
};

const BTN_GHOST = {
  padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
};

function Spinner() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '2px 0', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)',
          animation: `mindBounce 0.9s ${i * 0.15}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

function Tag({ label, colour }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 600,
      background: colour + '20', color: colour,
      border: `0.5px solid ${colour}44`,
    }}>{label}</span>
  );
}

// ─── Advisor definitions ──────────────────────────────────────────────────────

const ADVISORS = [
  {
    id: 'career', name: 'Career Coach', colour: '#4a9eff',
    emoji: 'C',
    prompt: `You are an experienced executive career coach with 20+ years helping high-performers. You ask powerful questions, challenge assumptions about career trajectory, identify blind spots, and push for clarity on what success actually means. You're direct, concise, and don't flatter. You speak in plain language — no corporate jargon. Max 3 paragraphs per response unless specifically asked for more.`,
  },
  {
    id: 'learning', name: 'Learning Coach', colour: '#a78bfa',
    emoji: 'L',
    prompt: `You are a world-class learning strategist who understands cognitive science, deliberate practice, and skill acquisition. You help identify the most efficient path to mastery, detect tutorial hell, and design high-quality practice. You reference research when relevant but keep it practical. Max 3 paragraphs unless asked for more.`,
  },
  {
    id: 'strategist', name: 'Strategist', colour: '#6BE3A4',
    emoji: 'S',
    prompt: `You are a sharp strategic advisor — think first-principles thinker meets competitive analyst. You see the long game, identify leverage points, spot patterns others miss, and prioritise ruthlessly. You think in systems and second-order effects. You cut through noise fast. Max 3 paragraphs unless asked for more.`,
  },
  {
    id: 'skeptic', name: 'Skeptic', colour: '#f4a642',
    emoji: '?',
    prompt: `You are a rigorous intellectual skeptic. Your job is to stress-test ideas, find flaws in reasoning, identify motivated thinking, and ask the uncomfortable questions. You are not cynical — you are precise. You do not tear things down for sport; you do it to make the thinking sharper. Max 3 paragraphs unless asked for more.`,
  },
  {
    id: 'future', name: 'Future Self', colour: '#e879f9',
    emoji: 'F',
    prompt: `You are this person's future self, 10 years from now. You've lived through the consequences of their current decisions. You speak with the wisdom of hindsight — you know what they're avoiding, what matters in retrospect, and what they'll wish they'd started sooner. You are honest, warm, and direct. You don't lecture — you share. Max 3 paragraphs unless asked for more.`,
  },
  {
    id: 'devil', name: "Devil's Advocate", colour: '#e55a5a',
    emoji: 'D',
    prompt: `You are a devil's advocate. Your job is to argue the strongest possible case against whatever position is being considered. You find the best counterarguments, the fatal flaws, and the uncomfortable alternative interpretations. You are not trying to be right — you are trying to make the thinking sharper. Max 3 paragraphs unless asked for more.`,
  },
];

// ─── AI Chat component (reusable) ─────────────────────────────────────────────

function AIChat({ systemPrompt, placeholder, contextNote, starterPrompts = [] }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await askClaudeRaw(msg, systemPrompt, messages);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {contextNote && (
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginBottom: 10,
          padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)', lineHeight: 1.5 }}>
          {contextNote}
        </div>
      )}
      {messages.length === 0 && starterPrompts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {starterPrompts.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
              border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.5)', textAlign: 'left', lineHeight: 1.4,
            }}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        gap: 10, paddingBottom: 8, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
              background: m.role === 'user' ? 'var(--accent)22' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${m.role === 'user' ? 'var(--accent)44' : 'rgba(255,255,255,0.08)'}`,
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ padding: '4px 14px' }}><Spinner /></div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder || 'Ask...'}
          style={{ ...INPUT, flex: 1 }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{ ...BTN, opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PERSONAL CONSTITUTION
// ═══════════════════════════════════════════════════════════════════════════════

function Constitution({ constitution, onSave }) {
  const [values,          setValues]          = useState(constitution?.values          || '');
  const [principles,      setPrinciples]      = useState(constitution?.principles      || '');
  const [rules,           setRules]           = useState(constitution?.rules           || '');
  const [nonNegotiables,  setNonNegotiables]  = useState(constitution?.nonNegotiables  || '');
  const [identity,        setIdentity]        = useState(constitution?.identity        || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave({ values, principles, rules, nonNegotiables, identity, lastUpdated: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fields = [
    { label: 'Identity Statement', hint: 'Who you are and who you are becoming', value: identity, set: setIdentity, placeholder: 'I am a builder. I create things that matter...' },
    { label: 'Core Values', hint: 'What matters most — ranked if possible', value: values, set: setValues, placeholder: '1. Integrity\n2. Growth\n3. Discipline\n4. Craft...' },
    { label: 'Operating Principles', hint: 'Rules for how you make decisions and live', value: principles, set: setPrinciples, placeholder: 'Build first, consume second.\nSlow is smooth, smooth is fast...' },
    { label: 'Personal Rules', hint: 'Firm commitments and standards you hold yourself to', value: rules, set: setRules, placeholder: 'No social media before 10am.\nNever miss two workouts in a row...' },
    { label: 'Non-Negotiables', hint: 'Hard lines you will not cross', value: nonNegotiables, set: setNonNegotiables, placeholder: 'Never compromise on honesty.\nHealth before convenience...' },
  ];

  const isEmpty = !values && !principles && !rules && !nonNegotiables && !identity;

  return (
    <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
            Personal Constitution
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, maxWidth: 480 }}>
            Your values, principles, and non-negotiables. This is fed to every AI interaction as context — VALERIE knows who you are before it advises you.
          </div>
        </div>
        {constitution?.lastUpdated && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace', flexShrink: 0, marginLeft: 16 }}>
            Last updated {new Date(constitution.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>

      {isEmpty && (
        <GlassCard style={{ background: 'rgba(167,139,250,0.05)', border: '0.5px solid rgba(167,139,250,0.2)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
            <strong style={{ color: 'rgba(167,139,250,0.9)', display: 'block', marginBottom: 6 }}>Start here.</strong>
            Your constitution is the most important thing in this app. It tells VALERIE what you stand for before it gives you any advice. Every AI advisor reads it. The Contradiction Detector checks against it. Spend 15 minutes on this — it compounds.
          </div>
        </GlassCard>
      )}

      {fields.map(f => (
        <div key={f.label}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)',
            fontFamily: 'ui-monospace,monospace', marginBottom: 4, textTransform: 'uppercase' }}>
            {f.label}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', marginBottom: 6 }}>{f.hint}</div>
          <textarea
            value={f.value}
            onChange={e => f.set(e.target.value)}
            placeholder={f.placeholder}
            style={{ ...TEXTAREA, minHeight: f.label === 'Identity Statement' ? 60 : 90 }}
          />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <button onClick={handleSave} style={BTN}>
          {saved ? 'Saved' : 'Save Constitution'}
        </button>
        {saved && <span style={{ fontSize: 11, color: '#6BE3A4' }}>Saved — all advisors now know who you are.</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BOARD OF ADVISORS
// ═══════════════════════════════════════════════════════════════════════════════

function BoardOfAdvisors({ constitution }) {
  const [mode,          setMode]          = useState('select'); // select | chat | board
  const [activeAdvisor, setActiveAdvisor] = useState(null);
  const [boardQuery,    setBoardQuery]    = useState('');
  const [boardResults,  setBoardResults]  = useState({});
  const [boardLoading,  setBoardLoading]  = useState(false);
  const [boardInput,    setBoardInput]    = useState('');

  const constitutionContext = constitution
    ? `\n\nUSER'S PERSONAL CONSTITUTION:\nIdentity: ${constitution.identity || ''}\nValues: ${constitution.values || ''}\nPrinciples: ${constitution.principles || ''}\nRules: ${constitution.rules || ''}\nNon-Negotiables: ${constitution.nonNegotiables || ''}`
    : '';

  async function runBoardMeeting(query) {
    if (!query.trim()) return;
    setBoardLoading(true);
    setBoardResults({});
    const promises = ADVISORS.map(async a => {
      try {
        const reply = await askClaudeRaw(query, a.prompt + constitutionContext);
        return [a.id, { text: reply, done: true }];
      } catch (err) {
        return [a.id, { text: `Error: ${err.message}`, done: true }];
      }
    });
    // Stream results as they come in
    const settled = await Promise.allSettled(promises);
    const results = {};
    settled.forEach(r => { if (r.status === 'fulfilled') { const [id, val] = r.value; results[id] = val; } });
    setBoardResults(results);
    setBoardLoading(false);
  }

  if (mode === 'chat' && activeAdvisor) {
    const adv = ADVISORS.find(a => a.id === activeAdvisor);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button onClick={() => setMode('select')} style={{ ...BTN_GHOST, padding: '5px 12px', fontSize: 12 }}>
            &larr; Back
          </button>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: adv.colour + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 11, color: adv.colour }}>
            {adv.emoji}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{adv.name}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>Private session</div>
          </div>
        </div>
        <AIChat
          systemPrompt={adv.prompt + constitutionContext}
          placeholder={`Ask ${adv.name}...`}
          starterPrompts={ADVISOR_STARTERS[activeAdvisor] || []}
        />
      </div>
    );
  }

  if (mode === 'board') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button onClick={() => { setMode('select'); setBoardResults({}); }} style={{ ...BTN_GHOST, padding: '5px 12px', fontSize: 12 }}>
            &larr; Back
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Board Meeting</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>All 6 advisors respond simultaneously</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexShrink: 0 }}>
          <input
            value={boardInput}
            onChange={e => setBoardInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setBoardQuery(boardInput); runBoardMeeting(boardInput); } }}
            placeholder="Present your question to the board..."
            style={{ ...INPUT, flex: 1, fontSize: 14 }}
          />
          <button
            onClick={() => { setBoardQuery(boardInput); runBoardMeeting(boardInput); }}
            disabled={!boardInput.trim() || boardLoading}
            style={{ ...BTN, opacity: (!boardInput.trim() || boardLoading) ? 0.5 : 1 }}>
            {boardLoading ? 'Consulting...' : 'Convene'}
          </button>
        </div>

        {boardLoading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
            <Spinner />
            Polling all 6 advisors simultaneously...
          </div>
        )}

        {Object.keys(boardResults).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ADVISORS.map(adv => {
              const result = boardResults[adv.id];
              return (
                <GlassCard key={adv.id} style={{ borderTop: `2px solid ${adv.colour}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: adv.colour + '22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 10, color: adv.colour }}>
                      {adv.emoji}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: adv.colour }}>{adv.name}</span>
                  </div>
                  {result ? (
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {result.text}
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}

        {!boardLoading && Object.keys(boardResults).length === 0 && !boardQuery && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BOARD_STARTERS.map((s, i) => (
              <button key={i} onClick={() => { setBoardInput(s); setBoardQuery(s); runBoardMeeting(s); }} style={{
                padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
                border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.5)',
              }}>{s}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Advisor selection screen
  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>Board of Advisors</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Six perspectives. One question.</div>
        </div>
        <button onClick={() => setMode('board')} style={{
          padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: 'rgba(167,139,250,0.15)', border: '0.5px solid rgba(167,139,250,0.3)',
          color: '#a78bfa',
        }}>
          Board Meeting &rarr;
        </button>
      </div>

      {!constitution?.values && (
        <GlassCard style={{ background: 'rgba(242,192,99,0.05)', border: '0.5px solid rgba(242,192,99,0.2)' }}>
          <div style={{ fontSize: 11.5, color: 'rgba(242,192,99,0.8)', lineHeight: 1.6 }}>
            No constitution set — advisors will respond without knowing your values. Complete the Constitution tab first for personalised advice.
          </div>
        </GlassCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {ADVISORS.map(adv => (
          <GlassCard
            key={adv.id}
            onClick={() => { setActiveAdvisor(adv.id); setMode('chat'); }}
            style={{
              cursor: 'pointer', padding: '16px 18px',
              borderLeft: `3px solid ${adv.colour}`,
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: adv.colour + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 11, color: adv.colour, flexShrink: 0 }}>
                {adv.emoji}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: adv.colour }}>{adv.name}</div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>
              {ADVISOR_DESC[adv.id]}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

const ADVISOR_DESC = {
  career:    'Career trajectory, positioning, blind spots, and what success actually means to you.',
  learning:  'Deliberate practice, skill acquisition, tutorial hell detection, efficient learning paths.',
  strategist:'Long-game thinking, leverage points, ruthless prioritisation, systems and second-order effects.',
  skeptic:   'Stress-tests your ideas, finds flaws in reasoning, asks the questions you are avoiding.',
  future:    'Your future self — 10 years from now, speaking with the wisdom of hindsight.',
  devil:     'Argues the strongest case against whatever you are considering. Makes your thinking sharper.',
};

const ADVISOR_STARTERS = {
  career:    ['What should I focus on in the next 6 months?', 'Where is my biggest career blind spot?', 'Am I optimising for the right things?'],
  learning:  ['Am I learning effectively or just consuming?', 'What should I be practising instead of studying?', 'Design me a deliberate practice plan for my weakest skill.'],
  strategist:['What is the highest-leverage thing I could do right now?', 'Where am I playing too small?', 'What are the second-order effects of my current direction?'],
  skeptic:   ['What am I not seeing about my current plan?', 'Where is my reasoning weakest right now?', 'What is the fatal flaw in my current approach?'],
  future:    ['What will I regret most if I keep going the way I am?', 'What am I avoiding that I know I should face?', 'What do you wish I had started earlier?'],
  devil:     ['Make the case against my current strategy.', 'Why will my plan fail?', 'What is the best argument against the path I am on?'],
};

const BOARD_STARTERS = [
  'Should I go deeper on my current path or explore something new?',
  'What is the most important decision I should make in the next 90 days?',
  'Am I spending my time on the right things?',
  'What is stopping me from reaching my full potential?',
];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LIFE LEDGER (Decision History + Failure Database + Wisdom)
// ═══════════════════════════════════════════════════════════════════════════════

const LEDGER_COLOURS = { decision: '#4a9eff', failure: '#e55a5a', wisdom: '#6BE3A4' };

function LifeLedger({ fmt }) {
  const decisions = useCollection('mind_decisions', 'valerie_decisions');
  const failures  = useCollection('mind_failures',  'valerie_failures');
  const wisdom    = useCollection('mind_wisdom',     'valerie_wisdom');

  const [view,     setView]     = useState('all');    // all | decisions | failures | wisdom
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('decision');
  const [form,     setForm]     = useState({});

  function handleAdd() {
    const store = formType === 'decision' ? decisions : formType === 'failure' ? failures : wisdom;
    const base  = { date: toLocalDateKey(new Date()), type: formType, createdAt: new Date().toISOString() };
    store.add({ ...base, ...form });
    setForm({}); setShowForm(false);
  }

  // Merge and sort all entries by date
  const all = useMemo(() => {
    const merged = [
      ...decisions.items.map(d => ({ ...d, _type: 'decision' })),
      ...failures.items.map(f  => ({ ...f, _type: 'failure'  })),
      ...wisdom.items.map(w   => ({ ...w, _type: 'wisdom'   })),
    ];
    return merged.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  }, [decisions.items, failures.items, wisdom.items]);

  const filtered = view === 'all' ? all : all.filter(e => e._type === view.slice(0, -1));

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Life Ledger</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Decisions · Failures · Wisdom</div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={BTN}>+ Add entry</button>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['all', 'decisions', 'failures', 'wisdom'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'ui-monospace,monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            background: view === v ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: view === v ? '#fff' : 'rgba(255,255,255,0.4)',
          }}>{v.toUpperCase()}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', alignSelf: 'center' }}>
          {decisions.items.length}D · {failures.items.length}F · {wisdom.items.length}W
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <GlassCard>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['decision', 'failure', 'wisdom'].map(t => (
              <button key={t} onClick={() => { setFormType(t); setForm({}); }} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: formType === t ? LEDGER_COLOURS[t] + '33' : 'rgba(255,255,255,0.06)',
                color: formType === t ? LEDGER_COLOURS[t] : 'rgba(255,255,255,0.4)',
                outline: formType === t ? `0.5px solid ${LEDGER_COLOURS[t]}55` : 'none',
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {formType === 'decision' && <DecisionForm form={form} setForm={setForm} />}
          {formType === 'failure'  && <FailureForm  form={form} setForm={setForm} />}
          {formType === 'wisdom'   && <WisdomForm   form={form} setForm={setForm} />}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
            <button onClick={handleAdd} style={BTN}>Add to Ledger</button>
          </div>
        </GlassCard>
      )}

      {/* Entries */}
      {filtered.length === 0 ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            No entries yet. Start logging your decisions, failures, and wisdom.
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((e, i) => <LedgerEntry key={e.id || i} entry={e} />)}
        </div>
      )}
    </div>
  );
}

function DecisionForm({ form, setForm }) {
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input placeholder="The decision" value={form.title || ''} onChange={e => f('title', e.target.value)} style={INPUT} />
      <textarea placeholder="Reasoning — why did you make this call?" value={form.reasoning || ''} onChange={e => f('reasoning', e.target.value)} style={TEXTAREA} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>CONFIDENCE (1-10)</div>
          <input type="number" min="1" max="10" placeholder="7" value={form.confidence || ''} onChange={e => f('confidence', e.target.value)} style={INPUT} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>REVIEW DATE</div>
          <input type="date" value={form.reviewDate || ''} onChange={e => f('reviewDate', e.target.value)} style={INPUT} />
        </div>
      </div>
      <textarea placeholder="Expected outcome" value={form.expectedOutcome || ''} onChange={e => f('expectedOutcome', e.target.value)} style={{ ...TEXTAREA, minHeight: 50 }} />
    </div>
  );
}

function FailureForm({ form, setForm }) {
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input placeholder="What failed" value={form.title || ''} onChange={e => f('title', e.target.value)} style={INPUT} />
      <textarea placeholder="What happened and why it failed" value={form.what || ''} onChange={e => f('what', e.target.value)} style={TEXTAREA} />
      <textarea placeholder="The lesson — what will you do differently?" value={form.lesson || ''} onChange={e => f('lesson', e.target.value)} style={TEXTAREA} />
    </div>
  );
}

function WisdomForm({ form, setForm }) {
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input placeholder="The insight or lesson" value={form.title || ''} onChange={e => f('title', e.target.value)} style={INPUT} />
      <textarea placeholder="Context — what led to this insight?" value={form.context || ''} onChange={e => f('context', e.target.value)} style={TEXTAREA} />
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>CONFIDENCE IN THIS WISDOM (1-10)</div>
        <input type="number" min="1" max="10" placeholder="8" value={form.confidence || ''} onChange={e => f('confidence', e.target.value)} style={{ ...INPUT }} />
      </div>
    </div>
  );
}

function LedgerEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const colour = LEDGER_COLOURS[entry._type] || '#fff';
  const typeLabel = { decision: 'DECISION', failure: 'FAILURE', wisdom: 'WISDOM' }[entry._type] || '';
  const conf = entry.confidence ? parseInt(entry.confidence) : null;

  return (
    <GlassCard
      onClick={() => setExpanded(v => !v)}
      style={{ padding: '13px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Tag label={typeLabel} colour={colour} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>
              {entry.date}
            </span>
            {conf && (
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace,monospace' }}>
                {conf}/10 confidence
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{entry.title}</div>
          {expanded && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Reasoning', entry.reasoning], ['Expected outcome', entry.expectedOutcome], ['Actual outcome', entry.actualOutcome], ['What happened', entry.what], ['Lesson', entry.lesson], ['Context', entry.context]].map(([label, val]) =>
                val ? (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', fontFamily: 'ui-monospace,monospace', marginBottom: 3 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>{val}</div>
                  </div>
                ) : null
              )}
              {entry._type === 'decision' && !entry.actualOutcome && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Actual outcome not recorded yet.</div>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. BELIEFS
// ═══════════════════════════════════════════════════════════════════════════════

function Beliefs() {
  const beliefs   = useCollection('mind_beliefs', 'valerie_beliefs');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ title: '', context: '', confidence: '7', tags: '' });

  function handleAdd() {
    if (!form.title.trim()) return;
    beliefs.add({ ...form, confidence: parseInt(form.confidence) || 7, date: toLocalDateKey(new Date()), history: [], createdAt: new Date().toISOString() });
    setForm({ title: '', context: '', confidence: '7', tags: '' });
    setShowForm(false);
  }

  const sorted = [...beliefs.items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Belief Tracker</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Track how your beliefs evolve over time. Confidence is scored 1–10.</div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={BTN}>+ Add belief</button>
      </div>

      {showForm && (
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="The belief (e.g. 'Consistency beats intensity')" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={INPUT} />
            <textarea placeholder="Context — what formed this belief?" value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))} style={TEXTAREA} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>CONFIDENCE (1-10)</div>
                <input type="number" min="1" max="10" value={form.confidence} onChange={e => setForm(p => ({ ...p, confidence: e.target.value }))} style={INPUT} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>TAGS</div>
                <input placeholder="career, health, people..." value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} style={INPUT} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
              <button onClick={handleAdd} style={BTN}>Add belief</button>
            </div>
          </div>
        </GlassCard>
      )}

      {sorted.length === 0 && !showForm ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            No beliefs logged yet. Start with your most firmly held ones.
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((b, i) => {
            const conf = b.confidence || 0;
            const confColour = conf >= 8 ? '#6BE3A4' : conf >= 5 ? '#f4a642' : '#e55a5a';
            return (
              <GlassCard key={b.id || i}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: confColour, fontWeight: 700 }}>
                        {conf}/10
                      </span>
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace' }}>{b.date}</span>
                      {b.tags && b.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <Tag key={t} label={t} colour="rgba(255,255,255,0.35)" />
                      ))}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: b.context ? 6 : 0 }}>{b.title}</div>
                    {b.context && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{b.context}</div>}
                    {/* Confidence bar */}
                    <div style={{ marginTop: 10, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                      <div style={{ height: '100%', width: `${(conf / 10) * 100}%`, background: confColour, borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <button onClick={() => beliefs.remove(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', fontSize: 16, padding: 0, lineHeight: 1 }}>&#215;</button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MEMORY VAULT
// ═══════════════════════════════════════════════════════════════════════════════

const VAULT_TYPES = [
  { id: 'note',    label: 'Note',    colour: '#4a9eff' },
  { id: 'idea',    label: 'Idea',    colour: '#a78bfa' },
  { id: 'insight', label: 'Insight', colour: '#6BE3A4' },
  { id: 'lesson',  label: 'Lesson',  colour: '#f4a642' },
  { id: 'quote',   label: 'Quote',   colour: '#e879f9' },
  { id: 'project', label: 'Project', colour: '#e55a5a' },
];

function MemoryVault() {
  const memories  = useCollection('mind_memories', 'valerie_memories');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ title: '', content: '', type: 'note', tags: '' });
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');

  function handleAdd() {
    if (!form.title.trim()) return;
    memories.add({ ...form, date: toLocalDateKey(new Date()), createdAt: new Date().toISOString() });
    setForm({ title: '', content: '', type: 'note', tags: '' });
    setShowForm(false);
  }

  const filtered = useMemo(() => {
    return memories.items
      .filter(m => filter === 'all' || m.type === filter)
      .filter(m => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (m.title || '').toLowerCase().includes(q) ||
               (m.content || '').toLowerCase().includes(q) ||
               (m.tags || '').toLowerCase().includes(q);
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [memories.items, filter, search]);

  return (
    <div style={{ padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Memory Vault</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            Everything worth keeping. Notes, ideas, insights, lessons, quotes, projects.
          </div>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={BTN}>+ Add memory</button>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search vault..."
          style={{ ...INPUT, flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={{
          padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
          fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em',
          background: filter === 'all' ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
          color: filter === 'all' ? '#fff' : 'rgba(255,255,255,0.4)',
        }}>ALL</button>
        {VAULT_TYPES.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em',
            background: filter === t.id ? t.colour + '33' : 'rgba(255,255,255,0.06)',
            color: filter === t.id ? t.colour : 'rgba(255,255,255,0.4)',
            outline: filter === t.id ? `0.5px solid ${t.colour}44` : 'none',
          }}>{t.label.toUpperCase()}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', alignSelf: 'center' }}>
          {filtered.length} / {memories.items.length}
        </span>
      </div>

      {/* Add form */}
      {showForm && (
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ ...INPUT, fontSize: 14, fontWeight: 500 }} />
            <textarea placeholder="Content — the full thought, idea, or insight..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} style={{ ...TEXTAREA, minHeight: 100 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>TYPE</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {VAULT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, type: t.id }))} style={{
                      padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                      background: form.type === t.id ? t.colour + '33' : 'rgba(255,255,255,0.05)',
                      color: form.type === t.id ? t.colour : 'rgba(255,255,255,0.4)',
                      outline: form.type === t.id ? `0.5px solid ${t.colour}44` : 'none',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: '0 0 180px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: '0.06em' }}>TAGS</div>
                <input placeholder="growth, finance..." value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} style={INPUT} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={BTN_GHOST}>Cancel</button>
              <button onClick={handleAdd} style={BTN}>Add to Vault</button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Entries */}
      {filtered.length === 0 ? (
        <GlassCard>
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            {search ? `No results for "${search}"` : 'Vault is empty. Add your first memory.'}
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filtered.map((m, i) => {
            const t = VAULT_TYPES.find(x => x.id === m.type) || VAULT_TYPES[0];
            return (
              <GlassCard key={m.id || i} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Tag label={t.label.toUpperCase()} colour={t.colour} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace' }}>{m.date}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 5, lineHeight: 1.4 }}>{m.title}</div>
                {m.content && (
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.content}
                  </div>
                )}
                {m.tags && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.tags.split(',').map(t2 => t2.trim()).filter(Boolean).map(tag => (
                      <span key={tag} style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)',
                        padding: '1px 6px', borderRadius: 20, cursor: 'pointer' }}
                        onClick={() => setSearch(tag)}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <button onClick={() => memories.remove(m.id)} style={{
                  position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.15)', fontSize: 14, padding: 0,
                }}>&#215;</button>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. INSIGHTS (Contradiction Detector + Regret Forecast + Personal Laws)
// ═══════════════════════════════════════════════════════════════════════════════

function Insights({ constitution, settings }) {
  const [activeInsight, setActiveInsight] = useState(null); // null | 'alignment' | 'regret' | 'laws'
  const [result,        setResult]        = useState('');
  const [loading,       setLoading]       = useState(false);

  const constitutionText = constitution
    ? `Identity: ${constitution.identity || ''}\nValues: ${constitution.values || ''}\nPrinciples: ${constitution.principles || ''}\nRules: ${constitution.rules || ''}\nNon-Negotiables: ${constitution.nonNegotiables || ''}`
    : 'No constitution set.';

  const INSIGHTS = [
    {
      id: 'alignment',
      title: 'Alignment Score',
      subtitle: 'Contradiction Detector',
      colour: '#6BE3A4',
      description: 'Compares your stated values and principles against observable patterns. Surfaces where your actions and your identity diverge.',
      prompt: `You are analysing a person's alignment between their stated values and their actual behaviour patterns.

PERSONAL CONSTITUTION:
${constitutionText}

Based on what you can observe from their stated values and principles, identify:
1. Where they are likely living in alignment
2. Where there may be contradictions or gaps between stated values and typical human behaviour
3. Specific behaviours they should watch for that would indicate drift from their values
4. A suggested Alignment Score out of 100 based on the specificity and strength of their constitution

Be direct, specific, and honest. This person wants real insight, not validation. Format with clear sections.`,
    },
    {
      id: 'regret',
      title: 'Regret Forecast',
      subtitle: 'Future Regret Analysis',
      colour: '#e879f9',
      description: 'Projects likely future regrets based on your current constitution and stated priorities. What will you wish you had done differently in 10 years?',
      prompt: `You are conducting a regret forecasting analysis. Your job is to identify what this person is likely to regret in 10 years if their current trajectory continues.

PERSONAL CONSTITUTION:
${constitutionText}

Based on their stated values, principles, and non-negotiables, identify:
1. The top 3 most likely regrets if they don't live up to their constitution
2. The behaviours or patterns that typically lead to these regrets
3. The single most important thing they should start doing NOW to avoid their most likely regret
4. What their future self would say to them right now

Be honest and direct. This is meant to create urgency and clarity, not anxiety. Format clearly with numbered sections.`,
    },
    {
      id: 'laws',
      title: 'Personal Laws',
      subtitle: 'Pattern Discovery',
      colour: '#f4a642',
      description: 'Surfaces likely personal patterns and recurring truths from your constitution and principles. Generates candidate personal laws for you to validate.',
      prompt: `You are helping someone discover their Personal Laws — recurring patterns and truths that define how they operate.

PERSONAL CONSTITUTION:
${constitutionText}

Based on their constitution, values, and principles, generate:
1. 5-7 candidate "Personal Laws" — recurring patterns or truths that are likely true for this person based on who they've described themselves to be
2. For each law: the underlying pattern, why it exists, and whether it serves them
3. The one Personal Law that is most important for them to consciously operate by

Format each law clearly: "Law: [statement]" followed by the explanation. Be specific to them — these should feel like discoveries, not generic advice.`,
    },
  ];

  async function runInsight(insight) {
    if (!constitution?.values) {
      setResult('Complete your Personal Constitution first — Insights need your values and principles to generate meaningful analysis.');
      setActiveInsight(insight.id);
      return;
    }
    setActiveInsight(insight.id);
    setResult('');
    setLoading(true);
    try {
      const reply = await askClaudeRaw('Run the analysis now.', insight.prompt);
      setResult(reply);
    } catch (err) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 24px 32px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>Insights</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>AI-powered analysis of who you are vs how you're operating.</div>
      </div>

      {!constitution?.values && (
        <GlassCard style={{ marginBottom: 14, background: 'rgba(242,192,99,0.05)', border: '0.5px solid rgba(242,192,99,0.2)' }}>
          <div style={{ fontSize: 11.5, color: 'rgba(242,192,99,0.8)', lineHeight: 1.6 }}>
            No constitution set — Insights will be generic without your values. Head to the Constitution tab first.
          </div>
        </GlassCard>
      )}

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {INSIGHTS.map(ins => (
          <GlassCard
            key={ins.id}
            style={{ borderLeft: `3px solid ${ins.colour}`, cursor: 'pointer' }}
            onClick={() => runInsight(ins)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ins.colour }}>{ins.title}</div>
                  <Tag label={ins.subtitle} colour={ins.colour} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{ins.description}</div>
              </div>
              <button style={{ ...BTN, padding: '7px 16px', fontSize: 12, flexShrink: 0, background: ins.colour + '22', color: ins.colour, border: `0.5px solid ${ins.colour}44` }}>
                {loading && activeInsight === ins.id ? 'Analysing...' : 'Run'}
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Result */}
      {activeInsight && (
        <GlassCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: INSIGHTS.find(i => i.id === activeInsight)?.colour,
              letterSpacing: '0.1em', fontFamily: 'ui-monospace,monospace' }}>
              {INSIGHTS.find(i => i.id === activeInsight)?.title?.toUpperCase()} — ANALYSIS
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
              <Spinner />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Claude is analysing...</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {result}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MIND TAB
// ═══════════════════════════════════════════════════════════════════════════════

const MIND_TABS = [
  { id: 'constitution', label: 'CONSTITUTION' },
  { id: 'advisors',     label: 'ADVISORS'     },
  { id: 'ledger',       label: 'LEDGER'       },
  { id: 'beliefs',      label: 'BELIEFS'      },
  { id: 'vault',        label: 'VAULT'        },
  { id: 'insights',     label: 'INSIGHTS'     },
  { id: 'breathe',      label: 'BREATHE'      },
];

export default function Mind({ settings = {} }) {
  const [section, setSection] = useState('constitution');

  // Constitution stored as a single document in user_meta
  const constitutionDoc = useDocument('constitution', 'valerie_constitution', null);
  const constitution = constitutionDoc.data;

  function saveConstitution(data) {
    constitutionDoc.save(data);
  }

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [section]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.01em' }}>
            Mind
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.06em' }}>
            PERSONAL OPERATING SYSTEM
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {MIND_TABS.map(t => (
            <button key={t.id} onClick={() => setSection(t.id)} style={{
              padding: '7px 16px 9px', border: 'none', cursor: 'pointer', background: 'transparent',
              color: section === t.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'ui-monospace,monospace',
              borderBottom: section === t.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              marginBottom: -0.5, transition: 'all 0.15s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: section === 'advisors' ? 'hidden' : 'auto' }}>
        {section === 'constitution' && <Constitution constitution={constitution} onSave={saveConstitution} />}
        {section === 'advisors'     && <BoardOfAdvisors constitution={constitution} />}
        {section === 'ledger'       && <LifeLedger />}
        {section === 'beliefs'      && <Beliefs />}
        {section === 'vault'        && <MemoryVault />}
        {section === 'insights'     && <Insights constitution={constitution} settings={settings} />}
        {section === 'breathe'      && <div style={{ padding: '20px 24px' }}><BreathingTool /></div>}
      </div>

      <style>{`
        @keyframes mindBounce {
          0%, 100% { transform: translateY(0);   opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
