//  VALERIE  Password Vault 
// AES-256-GCM  PBKDF2 key derivation  Local only  Never synced to Firebase
import { useState, useEffect, useRef, useCallback } from 'react';

//  Vault storage keys (raw localStorage, never Firebase) 
const V_SALT = 'valerie_vault_salt';
const V_DATA = 'valerie_vault_data';
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes default

//  Crypto helpers 
function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const keyMat = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

async function encryptEntries(entries, key) {
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(entries));
  const enc  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.stringify({ iv: b64(iv), data: b64(enc) });
}

async function decryptEntries(blob, key) {
  const { iv, data } = JSON.parse(blob);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) }, key, unb64(data)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

//  Password generator 
function genPassword(len = 20, opts = { upper: true, lower: true, numbers: true, symbols: true }) {
  let chars = '';
  if (opts.lower)   chars += 'abcdefghijklmnopqrstuvwxyz';
  if (opts.upper)   chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.numbers) chars += '0123456789';
  if (opts.symbols) chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

//  HaveIBeenPwned k-anonymity check 
async function checkBreach(password) {
  const encoder  = new TextEncoder();
  const data     = encoder.encode(password);
  const hash     = await crypto.subtle.digest('SHA-1', data);
  const hashHex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const prefix   = hashHex.slice(0, 5);
  const suffix   = hashHex.slice(5);
  try {
    const res  = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await res.text();
    const found = text.split('\n').find(line => line.split(':')[0] === suffix);
    return found ? parseInt(found.split(':')[1]) : 0;
  } catch { return null; }
}

//  Categories 
const CATEGORIES = ['All', 'Social', 'Finance', 'Work', 'Shopping', 'Other'];

//  Shared styles 
const INPUT = {
  width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--card-border)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};
const BTN = (accent = false) => ({
  padding: accent ? '9px 18px' : '8px 14px',
  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
  background: accent ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
  color: accent ? '#fff' : 'var(--text-secondary)', fontWeight: accent ? 500 : 400,
});

//  Lock screen 
function LockScreen({ onUnlock, isFirstTime }) {
  const [pw,    setPw]    = useState('');
  const [pw2,   setPw2]   = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  async function handleSubmit() {
    if (!pw) return;
    if (isFirstTime && pw !== pw2) { setErr('Passwords do not match.'); return; }
    if (isFirstTime && pw.length < 8) { setErr('Master password must be at least 8 characters.'); return; }
    setBusy(true);
    setErr('');
    try {
      await onUnlock(pw, isFirstTime);
    } catch {
      setErr('Incorrect master password.');
    }
    setBusy(false);
  }

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '0.5px solid #f4a64244',
        borderRadius: 16, padding: '32px 36px', width: 340,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Amber lock banner */}
        <div style={{
          background: '#f4a64218', border: '0.5px solid #f4a64244',
          borderRadius: 8, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>=</span>
          <span style={{ fontSize: 12, color: '#f4a642' }}>
            {isFirstTime ? 'Set your master password to create the vault' : 'Vault locked  enter master password'}
          </span>
        </div>

        <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--text-primary)', textAlign: 'center' }}>
          {isFirstTime ? 'Create Vault' : 'Unlock Vault'}
        </div>

        {isFirstTime && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
            Choose a strong master password. It is never stored anywhere  if forgotten, the vault cannot be recovered.
          </div>
        )}

        <input
          type="password"
          placeholder={isFirstTime ? 'Master password (min 8 chars)' : 'Master password'}
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={INPUT}
          autoFocus
        />

        {isFirstTime && (
          <input type="password" placeholder="Confirm master password"
            value={pw2} onChange={e => setPw2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={INPUT}
          />
        )}

        {err && <div style={{ fontSize: 12, color: '#e55a5a', textAlign: 'center' }}>{err}</div>}

        <button onClick={handleSubmit} disabled={busy} style={{
          ...BTN(true), width: '100%',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Unlocking…' : isFirstTime ? 'Create Vault' : 'Unlock'}
        </button>

        {!isFirstTime && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Desktop only  Encrypted with AES-256  Never synced to cloud
          </div>
        )}
      </div>
    </div>
  );
}

//  Password generator modal 
function GeneratorPanel({ onUse }) {
  const [len,     setLen]     = useState(20);
  const [upper,   setUpper]   = useState(true);
  const [lower,   setLower]   = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [pw,      setPw]      = useState('');
  const [copied,  setCopied]  = useState(false);

  useEffect(() => { regenerate(); }, [len, upper, lower, numbers, symbols]);

  function regenerate() {
    setPw(genPassword(len, { upper, lower, numbers, symbols }));
    setCopied(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>PASSWORD GENERATOR</div>

      <div style={{
        fontFamily: 'monospace', fontSize: 14, color: 'var(--text-primary)',
        background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8,
        wordBreak: 'break-all', letterSpacing: '0.05em', lineHeight: 1.5,
      }}>
        {pw}
      </div>

      {/* Length slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50 }}>Length: {len}</span>
        <input type="range" min={8} max={64} value={len} onChange={e => setLen(+e.target.value)}
          style={{ flex: 1, accentColor: 'var(--accent)' }} />
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['Uppercase', upper,   setUpper],
          ['Lowercase', lower,   setLower],
          ['Numbers',   numbers, setNumbers],
          ['Symbols',   symbols, setSymbols],
        ].map(([label, val, set]) => (
          <button key={label} onClick={() => set(v => !v)} style={{
            padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11,
            background: val ? 'var(--accent)33' : 'rgba(255,255,255,0.05)',
            color: val ? 'var(--accent)' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={regenerate} style={{ ...BTN(false), flex: 1 }}> Regenerate</button>
        <button onClick={copy} style={{ ...BTN(false), flex: 1 }}>
          {copied ? ' Copied!' : ' Copy'}
        </button>
        {onUse && (
          <button onClick={() => onUse(pw)} style={{ ...BTN(true), flex: 1 }}>Use</button>
        )}
      </div>
    </div>
  );
}

//  Entry detail panel 
function DetailPanel({ entry, onUpdate, onDelete }) {
  const [revealed,  setRevealed]  = useState(false);
  const [breach,    setBreach]    = useState(null); // null | number | 'checking' | 'error'
  const [copied,    setCopied]    = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState({ ...entry });
  const [showGen,   setShowGen]   = useState(false);
  const clipTimerRef = useRef(null);

  useEffect(() => {
    setForm({ ...entry });
    setEditing(false);
    setRevealed(false);
    setBreach(null);
  }, [entry.id]);

  async function copyPassword() {
    await navigator.clipboard.writeText(entry.password || '');
    setCopied(true);
    // Auto-clear clipboard after 30 seconds
    clearTimeout(clipTimerRef.current);
    clipTimerRef.current = setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === entry.password) await navigator.clipboard.writeText('');
      } catch {}
      setCopied(false);
    }, 30000);
    setTimeout(() => setCopied(false), 2000);
  }

  async function runBreachCheck() {
    setBreach('checking');
    try {
      const count = await checkBreach(entry.password || '');
      setBreach(count === null ? 'error' : count);
    } catch { setBreach('error'); }
  }

  function handleSave() {
    onUpdate(entry.id, form);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>EDIT ENTRY</div>
        {[
          ['Site / App', 'site', 'text'],
          ['Username / Email', 'username', 'text'],
          ['URL', 'url', 'url'],
        ].map(([label, field, type]) => (
          <div key={field}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
            <input type={type} value={form[field] || ''}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              style={INPUT} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Password</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={form.password || ''}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ ...INPUT, fontFamily: 'monospace' }} />
            <button onClick={() => setShowGen(v => !v)} title="Generator"
              style={{ ...BTN(false), padding: '8px 10px', flexShrink: 0 }}></button>
          </div>
        </div>
        {showGen && (
          <GeneratorPanel onUse={pw => { setForm(f => ({ ...f, password: pw })); setShowGen(false); }} />
        )}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Category</div>
          <select value={form.category || 'Other'}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ ...INPUT, width: '100%' }}>
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Notes</div>
          <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={BTN(false)}>Cancel</button>
          <button onClick={handleSave} style={BTN(true)}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Site + category */}
      <div>
        <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 400 }}>{entry.site}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.category}</div>
      </div>

      {/* Username */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>USERNAME / EMAIL</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {entry.username || ''}
        </div>
      </div>

      {/* Password row */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>PASSWORD</div>
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 12px',
          fontFamily: 'monospace', fontSize: 13, letterSpacing: revealed ? '0.04em' : '0.2em',
          color: 'var(--text-primary)', wordBreak: 'break-all', minHeight: 36,
        }}>
          {revealed ? entry.password : '"'.repeat(Math.min(entry.password?.length || 12, 20))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={() => setRevealed(v => !v)} style={{ ...BTN(false), flex: 1, fontSize: 12 }}>
            {revealed ? '=H Hide' : '=A Reveal'}
          </button>
          <button onClick={copyPassword} style={{ ...BTN(false), flex: 1, fontSize: 12 }}>
            {copied ? ' Copied' : ' Copy'}
          </button>
        </div>
        {copied && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
            Clipboard clears automatically in 30 seconds
          </div>
        )}
      </div>

      {/* URL */}
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer" style={{
          fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
          wordBreak: 'break-all',
        }}>= {entry.url}</a>
      )}

      {/* Notes */}
      {entry.notes && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{entry.notes}</div>
      )}

      {/* Breach check */}
      <div>
        <button onClick={runBreachCheck} disabled={breach === 'checking'} style={{
          ...BTN(false), width: '100%', fontSize: 12,
          opacity: breach === 'checking' ? 0.6 : 1,
        }}>
          {breach === 'checking' ? 'Checking…'
            : breach === null ? '🔍 Check for breaches (HIBP)'
            : breach === 'error' ? '⚠️ Check failed — tap to retry'
            : breach === 0 ? '✓ Not found in any known breach'
            : `⚠️ Found in ${breach.toLocaleString()} breach${breach !== 1 ? 'es' : ''}`}
        </button>
        {typeof breach === 'number' && breach > 0 && (
          <div style={{ fontSize: 10, color: '#f4a642', marginTop: 4, textAlign: 'center' }}>
            Consider changing this password
          </div>
        )}
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
          Uses k-anonymity  only the first 5 chars of the SHA-1 hash are sent
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(true)} style={{ ...BTN(false), flex: 1 }}>Edit</button>
        <button onClick={() => onDelete(entry.id)} style={{ ...BTN(false), flex: 1, color: '#e55a5a' }}>Delete</button>
      </div>
    </div>
  );
}

//  Main Vault Tab 
export default function Vault() {
  const [locked,    setLocked]    = useState(true);
  const [entries,   setEntries]   = useState([]);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [catFilter, setCatFilter] = useState('All');
  const [search,    setSearch]    = useState('');
  const [adding,    setAdding]    = useState(false);
  const [showGen,   setShowGen]   = useState(false);
  const [addForm,   setAddForm]   = useState({ site: '', username: '', password: '', url: '', category: 'Other', notes: '' });
  const autoLockRef = useRef(null);

  const isFirstTime = !localStorage.getItem(V_DATA);

  // Reset auto-lock timer on any activity
  const resetAutoLock = useCallback(() => {
    clearTimeout(autoLockRef.current);
    if (!locked) {
      autoLockRef.current = setTimeout(() => {
        setLocked(true);
        setCryptoKey(null);
        setEntries([]);
        setSelected(null);
      }, AUTO_LOCK_MS);
    }
  }, [locked]);

  useEffect(() => {
    if (!locked) resetAutoLock();
    return () => clearTimeout(autoLockRef.current);
  }, [locked]);

  // Unlock / create vault
  async function handleUnlock(password, create = false) {
    let salt;
    if (create) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(V_SALT, b64(salt.buffer));
    } else {
      const savedSalt = localStorage.getItem(V_SALT);
      if (!savedSalt) throw new Error('No salt');
      salt = unb64(savedSalt);
    }

    const key = await deriveKey(password, salt);

    if (create) {
      const blob = await encryptEntries([], key);
      localStorage.setItem(V_DATA, blob);
      setCryptoKey(key);
      setEntries([]);
      setLocked(false);
    } else {
      const blob = localStorage.getItem(V_DATA);
      if (!blob) throw new Error('No data');
      const decrypted = await decryptEntries(blob, key); // throws on wrong password
      setCryptoKey(key);
      setEntries(decrypted);
      setLocked(false);
    }
  }

  // Persist entries to localStorage (encrypted)
  async function persist(newEntries) {
    if (!cryptoKey) return;
    const blob = await encryptEntries(newEntries, cryptoKey);
    localStorage.setItem(V_DATA, blob);
  }

  async function handleAdd() {
    if (!addForm.site.trim()) return;
    const entry = {
      id:        crypto.randomUUID(),
      site:      addForm.site.trim(),
      username:  addForm.username.trim() || null,
      password:  addForm.password,
      url:       addForm.url.trim() || null,
      category:  addForm.category,
      notes:     addForm.notes.trim() || null,
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    await persist(updated);
    setAdding(false);
    setAddForm({ site: '', username: '', password: '', url: '', category: 'Other', notes: '' });
    setSelected(entry.id);
    resetAutoLock();
  }

  async function handleUpdate(id, data) {
    const updated = entries.map(e => e.id === id ? { ...e, ...data } : e);
    setEntries(updated);
    await persist(updated);
    resetAutoLock();
  }

  async function handleDelete(id) {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    await persist(updated);
    setSelected(null);
    resetAutoLock();
  }

  if (locked) {
    return <LockScreen onUnlock={handleUnlock} isFirstTime={isFirstTime} />;
  }

  // Filter entries
  const filtered = entries.filter(e => {
    const matchCat = catFilter === 'All' || e.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || e.site?.toLowerCase().includes(q) || e.username?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const selectedEntry = entries.find(e => e.id === selected);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }} onClick={resetAutoLock}>

      {/*  Left list  */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        borderRight: '0.5px solid var(--card-border)', overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '12px 14px', borderBottom: '0.5px solid var(--card-border)',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT, flex: 1, minWidth: 100, padding: '7px 12px' }} />
          <button onClick={() => { setAdding(true); setSelected(null); setShowGen(false); }}
            style={BTN(true)}>+ Add</button>
          <button onClick={() => { setLocked(true); setCryptoKey(null); setEntries([]); setSelected(null); }}
            title="Lock vault" style={{ ...BTN(false), padding: '7px 10px' }}>=</button>
        </div>

        {/* Category filter */}
        <div style={{
          padding: '8px 14px', borderBottom: '0.5px solid var(--card-border)',
          display: 'flex', gap: 5, flexWrap: 'wrap',
        }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
              background: catFilter === c ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: catFilter === c ? '#fff' : 'var(--text-secondary)',
            }}>{c}</button>
          ))}
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>=</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {entries.length === 0 ? 'Vault is empty. Add your first password.' : 'No entries match.'}
              </div>
            </div>
          ) : filtered.map(e => {
            const isSelected = e.id === selected;
            return (
              <div key={e.id}
                onClick={() => { setSelected(e.id); setAdding(false); setShowGen(false); }}
                style={{
                  padding: '10px 14px',
                  borderBottom: '0.5px solid var(--card-border)',
                  background: isSelected ? 'var(--active-bg)' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.12s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: 'var(--text-muted)',
                }}>
                  {e.site?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.site}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.username || e.category}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*  Right panel  */}
      <div style={{
        width: 300, flexShrink: 0,
        padding: '20px 16px',
        overflowY: 'auto',
        background: 'var(--bg-panel)',
      }}>
        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>NEW ENTRY</div>
            {[
              ['Site / App *', 'site',     'text'],
              ['Username / Email', 'username', 'text'],
              ['URL (optional)', 'url',      'url'],
            ].map(([label, field, type]) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                <input type={type} value={addForm[field]}
                  onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  style={INPUT} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Password</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={addForm.password} placeholder="Enter or generate"
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  style={{ ...INPUT, fontFamily: 'monospace' }} />
                <button onClick={() => setShowGen(v => !v)} title="Generator"
                  style={{ ...BTN(false), padding: '8px 10px', flexShrink: 0 }}></button>
              </div>
            </div>
            {showGen && (
              <GeneratorPanel onUse={pw => {
                setAddForm(f => ({ ...f, password: pw }));
                setShowGen(false);
              }} />
            )}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Category</div>
              <select value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                style={{ ...INPUT }}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Notes (optional)</div>
              <textarea value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setAdding(false); setShowGen(false); }} style={BTN(false)}>Cancel</button>
              <button onClick={handleAdd} style={BTN(true)}>Save Entry</button>
            </div>
          </div>
        ) : selectedEntry ? (
          <DetailPanel
            entry={selectedEntry}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>=</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select an entry to view</div>
            <div style={{ marginTop: 24 }}>
              <GeneratorPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
