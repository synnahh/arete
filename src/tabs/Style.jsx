// Style tab — Session 5
// Sub-tabs: Discover (occasion search + AI outfit visualisation + optional Google Custom Search)
//           My Board (saved items — Wishlist / Purchased / Pass)

import { useState, useEffect } from 'react';
import { useCollection }        from '../firebase/useCollection.js';
import { STORAGE_KEYS, storage } from '../utils/storage.js';

// ─── Currency helper ───────────────────────────────────────────────────────────
function getCurrSymbol(currency) {
  switch (currency) {
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'AUD': return 'A$';
    default:    return '$';
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const OCCASIONS = ['Smart Casual', 'Date Night', 'Work', 'Gym', 'Beach', 'Evening'];

const CATEGORIES = ['Clothing', 'Jewellery', 'Footwear', 'Accessories', 'Outfits'];

const STATUS_CONFIG = {
  wishlist:  { label: 'Wishlist',  color: '#5b9cf6' },
  purchased: { label: 'Purchased', color: '#4caf7d' },
  pass:      { label: 'Pass',      color: '#888'    },
};

const AESTHETICS = [
  'minimalist', 'bold', 'elegant', 'casual', 'chic',
  'modern', 'classic', 'refined', 'edgy',
];

// ─── Pollinations.ai ───────────────────────────────────────────────────────────

function pollinationsUrl(prompt, seed) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=400&height=500&seed=${seed}&nologo=true`;
}

function buildResults(occasion, query) {
  const base = [occasion, query].filter(Boolean).join(' ');
  const fallback = 'fashion outfit';
  return Array.from({ length: 9 }, (_, i) => {
    const seed      = Math.floor(Math.random() * 50000) + i * 137;
    const aesthetic = AESTHETICS[i % AESTHETICS.length];
    const subject   = base || fallback;
    const prompt    = `${aesthetic} ${subject} outfit, fashion editorial, soft studio background, full body shot, professional photography`;
    return {
      id:          `r_${seed}_${i}`,
      title:       `${aesthetic.charAt(0).toUpperCase() + aesthetic.slice(1)} ${subject}`,
      prompt,
      imageUrl:    pollinationsUrl(prompt, seed),
      occasion,
      query,
      fromGoogle:  false,
      seed,
    };
  });
}

// ─── Google Custom Search ──────────────────────────────────────────────────────

async function searchGoogle(query, key, cx) {
  const url =
    `https://www.googleapis.com/customsearch/v1` +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(query)}` +
    `&searchType=image&num=9&imgSize=medium&safe=active`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Google API ${res.status}`);
  }
  const data = await res.json();
  return (data.items || []).map((item, i) => ({
    id:         `g_${i}_${Date.now()}`,
    title:      item.title,
    prompt:     query,
    imageUrl:   item.link,
    occasion:   '',
    query,
    fromGoogle: true,
    sourceUrl:  item.image?.contextLink || '',
  }));
}

// ─── SaveModal ─────────────────────────────────────────────────────────────────

function SaveModal({ result, onSave, onClose }) {
  const [category, setCategory] = useState('Clothing');
  const [status,   setStatus]   = useState('wishlist');
  const [title,    setTitle]    = useState(result?.title || '');
  const [price,    setPrice]    = useState('');

  if (!result) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text-primary)' }}>
          Save to Board
        </h3>

        <img
          src={result.imageUrl}
          alt={result.title}
          onError={e => { e.target.style.display = 'none'; }}
          style={{
            width: '100%', height: 160, objectFit: 'cover',
            borderRadius: 8, marginBottom: 14,
          }}
        />

        {/* Title */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Title
          </span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </label>

        {/* Category */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Category
          </span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
            }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Status */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Status
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11,
                  border: `1px solid ${status === key ? cfg.color : 'var(--border)'}`,
                  background: status === key ? cfg.color + '22' : 'var(--bg-primary)',
                  color: status === key ? cfg.color : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: status === key ? 700 : 400,
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Price (optional)
          </span>
          <input
            type="number" placeholder="0.00" value={price}
            onChange={e => setPrice(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({
              title:    title.trim() || result.title,
              category,
              status,
              price:    price ? parseFloat(price) : null,
              imageUrl: result.imageUrl,
              occasion: result.occasion,
            })}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ResultCard ────────────────────────────────────────────────────────────────

function ResultCard({ result, onSave }) {
  const [loaded, setLoaded]   = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 10,
      border: '1px solid var(--border)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '4/5', background: 'var(--bg-primary)', overflow: 'hidden' }}>
        {!errored && (
          <img
            src={result.imageUrl}
            alt={result.title}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: loaded ? 1 : 0, transition: 'opacity 0.4s',
            }}
          />
        )}

        {/* Skeleton / placeholder while loading */}
        {!loaded && !errored && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, color: 'var(--text-secondary)',
          }}>
            <span style={{ fontSize: 24, opacity: 0.2 }}>👗</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>Generating…</span>
          </div>
        )}

        {/* Error state */}
        {errored && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, color: 'var(--text-secondary)',
          }}>
            <span style={{ fontSize: 24, opacity: 0.2 }}>👗</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>Unavailable</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          margin: '0 0 6px', fontSize: 11, color: 'var(--text-primary)',
          lineHeight: 1.35, display: '-webkit-box', overflow: 'hidden',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {result.title}
        </p>
        {result.fromGoogle && result.sourceUrl && (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 10, color: 'var(--accent)', display: 'block', marginBottom: 6 }}
          >
            View source ↗
          </a>
        )}
        <button
          onClick={() => onSave(result)}
          style={{
            width: '100%', padding: '5px 0', borderRadius: 6,
            border: '1px solid var(--accent)', background: 'var(--accent)1a',
            color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}
        >
          + Save to Board
        </button>
      </div>
    </div>
  );
}

// ─── BoardCard ─────────────────────────────────────────────────────────────────

function BoardCard({ item, selected, onSelect, currSymbol = '$' }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.wishlist;
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        background: 'var(--bg-secondary)', borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: selected ? '0 0 0 2px var(--accent)33' : 'none',
        cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Image */}
      <div style={{
        aspectRatio: '4/5', background: 'var(--bg-primary)',
        position: 'relative', overflow: 'hidden',
      }}>
        {item.imageUrl && !imgErr ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, opacity: 0.2,
          }}>
            👗
          </div>
        )}
        {/* Status badge */}
        <span style={{
          position: 'absolute', top: 8, right: 8,
          background: cfg.color + 'ee', color: '#fff',
          fontSize: 9, fontWeight: 700, padding: '2px 7px',
          borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '9px 11px 11px' }}>
        <p style={{
          margin: '0 0 2px', fontSize: 12, fontWeight: 600,
          color: 'var(--text-primary)', overflow: 'hidden',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {item.title}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
          {item.category}
          {item.price != null ? ` · ${currSymbol}${Number(item.price).toFixed(2)}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ item, onUpdate, onRemove, onClose, currSymbol = '$' }) {
  const [fields, setFields] = useState({
    title:    item.title    || '',
    brand:    item.brand    || '',
    price:    item.price    != null ? String(item.price) : '',
    notes:    item.notes    || '',
    url:      item.url      || '',
    category: item.category || 'Clothing',
    status:   item.status   || 'wishlist',
  });
  const [imgErr, setImgErr] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Sync when item changes
  useEffect(() => {
    setFields({
      title:    item.title    || '',
      brand:    item.brand    || '',
      price:    item.price    != null ? String(item.price) : '',
      notes:    item.notes    || '',
      url:      item.url      || '',
      category: item.category || 'Clothing',
      status:   item.status   || 'wishlist',
    });
    setImgErr(false);
    setSaved(false);
  }, [item.id]);

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    onUpdate(item.id, {
      ...fields,
      price: fields.price !== '' ? parseFloat(fields.price) : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handleDelete = () => {
    if (window.confirm('Remove this item from your board?')) {
      onRemove(item.id);
      onClose();
    }
  };

  return (
    <div style={{
      width: 272, flexShrink: 0, height: '100%',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-secondary)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Item Detail
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', fontSize: 20, lineHeight: 1,
            color: 'var(--text-secondary)', cursor: 'pointer', padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Image */}
        <div style={{
          width: '100%', aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden',
          background: 'var(--bg-primary)', marginBottom: 14,
        }}>
          {item.imageUrl && !imgErr ? (
            <img
              src={item.imageUrl} alt={item.title}
              onError={() => setImgErr(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, opacity: 0.15,
            }}>
              👗
            </div>
          )}
        </div>

        {/* Status selector */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            Status
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => set('status', key)}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10,
                  border: `1px solid ${fields.status === key ? cfg.color : 'var(--border)'}`,
                  background: fields.status === key ? cfg.color + '22' : 'var(--bg-primary)',
                  color: fields.status === key ? cfg.color : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: fields.status === key ? 700 : 400,
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        {[
          { key: 'title',  label: 'Title',    type: 'text'   },
          { key: 'brand',  label: 'Brand',    type: 'text'   },
          { key: 'price',  label: `Price (${currSymbol})`, type: 'number' },
          { key: 'url',    label: 'Shop URL', type: 'url'    },
        ].map(({ key, label, type }) => (
          <label key={key} style={{ display: 'block', marginBottom: 10 }}>
            <span style={{
              fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3,
            }}>
              {label}
            </span>
            <input
              type={type}
              value={fields[key]}
              onChange={e => set(key, e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
          </label>
        ))}

        {/* Category */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            Category
          </span>
          <select
            value={fields.category}
            onChange={e => set('category', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
            }}
          >
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        {/* Notes */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>
            Notes
          </span>
          <textarea
            value={fields.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '7px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
              resize: 'vertical', outline: 'none',
            }}
          />
        </label>

        {/* Open shop link */}
        {fields.url && (
          <a
            href={fields.url} target="_blank" rel="noreferrer"
            style={{
              display: 'block', textAlign: 'center', padding: '7px',
              background: 'var(--bg-primary)', borderRadius: 6,
              color: 'var(--accent)', fontSize: 12, textDecoration: 'none',
              border: '1px solid var(--border)', marginBottom: 14,
            }}
          >
            Open shop link ↗
          </a>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8,
              border: 'none', background: saved ? '#4caf7d' : 'var(--accent)',
              color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              transition: 'background 0.3s',
            }}
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid #e55a5a44', background: 'none',
              color: '#e55a5a', fontSize: 12, cursor: 'pointer',
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AddManualModal ────────────────────────────────────────────────────────────

function AddManualModal({ onAdd, onClose, currSymbol = '$' }) {
  const [form, setForm] = useState({
    title: '', brand: '', category: 'Clothing', status: 'wishlist',
    price: '', url: '', notes: '', imageUrl: '',
  });
  const [genPrompt,   setGenPrompt]   = useState('');
  const [imgPreview,  setImgPreview]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGenerate = () => {
    const seed   = Math.floor(Math.random() * 99999);
    const prompt = genPrompt.trim() || `${form.category.toLowerCase()} fashion item, elegant, clean background`;
    const url    = pollinationsUrl(prompt, seed);
    set('imageUrl', url);
    setImgPreview(url);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAdd({ ...form, price: form.price !== '' ? parseFloat(form.price) : null });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 24, width: 440, maxWidth: '95vw',
          maxHeight: '88vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text-primary)' }}>
          Add to Board
        </h3>

        {/* Title */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Title *
          </span>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Black slim-fit trousers"
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </label>

        {/* Brand + Price row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Brand</span>
            <input
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Price ({currSymbol})</span>
            <input
              type="number"
              value={form.price}
              onChange={e => set('price', e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
          </label>
        </div>

        {/* Category + Status row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</span>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
              }}
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Status</span>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
              }}
            >
              {Object.entries(STATUS_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Image section */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Image
          </span>
          {/* URL paste */}
          <input
            value={form.imageUrl}
            onChange={e => { set('imageUrl', e.target.value); setImgPreview(e.target.value); }}
            placeholder="Paste image URL, or generate one below…"
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
              marginBottom: 8, outline: 'none',
            }}
          />
          {/* AI generate */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="AI prompt (optional, leave blank to auto-generate)"
              style={{
                flex: 1, padding: '7px 10px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={handleGenerate}
              style={{
                padding: '7px 13px', borderRadius: 6,
                border: '1px solid var(--accent)', background: 'var(--accent)22',
                color: 'var(--accent)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              ✨ Generate
            </button>
          </div>
          {/* Preview */}
          {imgPreview && (
            <img
              src={imgPreview} alt="preview"
              onError={e => e.target.style.display = 'none'}
              style={{
                width: '100%', height: 120, objectFit: 'cover',
                borderRadius: 6, marginTop: 8,
              }}
            />
          )}
        </div>

        {/* URL */}
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Shop URL</span>
          <input
            type="url"
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="https://…"
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
            }}
          />
        </label>

        {/* Notes */}
        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes</span>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
              resize: 'vertical', outline: 'none',
            }}
          />
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600,
              opacity: form.title.trim() ? 1 : 0.45,
            }}
          >
            Add to Board
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DiscoverView ──────────────────────────────────────────────────────────────

function DiscoverView({ settings, onSaveResult, currSymbol = '$' }) {
  const [occasion,    setOccasion]    = useState('');
  const [query,       setQuery]       = useState('');
  const [budget,      setBudget]      = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saveTarget,  setSaveTarget]  = useState(null);

  const hasGoogle = !!(settings?.googleSearchKey && settings?.googleSearchCx);

  const handleSearch = async () => {
    if (!occasion && !query.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      let res;
      if (hasGoogle) {
        const q = [occasion, query.trim(), budget ? `under ${currSymbol}${budget}` : '']
          .filter(Boolean).join(' ');
        res = await searchGoogle(q, settings.googleSearchKey, settings.googleSearchCx);
      } else {
        // Synchronous — but images load async via <img> tags
        res = buildResults(occasion, query.trim());
      }
      setResults(res);
    } catch (err) {
      setSearchError(err.message || 'Search failed. Check your API key in Settings.');
    } finally {
      setSearching(false);
    }
  };

  const handleKey = e => { if (e.key === 'Enter') handleSearch(); };

  const searchLabel = hasGoogle ? '🔍 Search' : '✨ Generate';
  const resultLabel = hasGoogle ? 'results' : 'generated looks';
  const searchTerm  = [occasion, query].filter(Boolean).join(' ') || 'your search';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{
        padding: '18px 24px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Gate notice */}
        {!hasGoogle && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: 'var(--accent)0d', border: '1px solid var(--accent)33',
            borderRadius: 8, padding: '9px 12px', marginBottom: 14,
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
          }}>
            <span style={{ flexShrink: 0 }}>💡</span>
            <span>
              Add a <strong style={{ color: 'var(--text-primary)' }}>Google Custom Search API key</strong> and Engine ID in{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Settings → Integrations</strong> to unlock real shopping results.{' '}
              Until then, you're getting AI-generated outfit visualisations via Pollinations.
            </span>
          </div>
        )}

        {/* Occasion pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {OCCASIONS.map(occ => (
            <button
              key={occ}
              onClick={() => setOccasion(occasion === occ ? '' : occ)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12,
                border: `1px solid ${occasion === occ ? 'var(--accent)' : 'var(--border)'}`,
                background: occasion === occ ? 'var(--accent)22' : 'var(--bg-secondary)',
                color: occasion === occ ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: occasion === occ ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {occ}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search style, item, aesthetic…"
            style={{
              flex: 1, padding: '9px 14px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          {/* Budget */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-secondary)', fontSize: 13, pointerEvents: 'none',
            }}>
              {currSymbol}
            </span>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Budget"
              style={{
                width: 110, padding: `9px 10px 9px ${currSymbol.length > 1 ? 32 : 22}px`,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || (!occasion && !query.trim())}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              cursor: searching || (!occasion && !query.trim()) ? 'not-allowed' : 'pointer',
              opacity: searching || (!occasion && !query.trim()) ? 0.5 : 1,
            }}
          >
            {searching ? '…' : searchLabel}
          </button>
        </div>

        {searchError && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#e55a5a' }}>
            {searchError}
          </p>
        )}
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Empty state */}
        {results.length === 0 && !searching && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', gap: 10,
          }}>
            <span style={{ fontSize: 52, opacity: 0.15 }}>👗</span>
            <p style={{ margin: 0, fontSize: 14 }}>Pick an occasion or search to discover looks</p>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
              {hasGoogle
                ? 'Real shopping results · save anything to your board'
                : 'AI-generated outfit visualisations · save anything to your board'}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {searching && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-secondary)', borderRadius: 10,
                  border: '1px solid var(--border)', aspectRatio: '4/5',
                  opacity: 0.4 + (i % 3) * 0.15,
                }}
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!searching && results.length > 0 && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {results.length} {resultLabel} for "{searchTerm}"
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {results.map(r => (
                <ResultCard key={r.id} result={r} onSave={setSaveTarget} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Save modal */}
      {saveTarget && (
        <SaveModal
          result={saveTarget}
          onSave={(data) => { onSaveResult(data); setSaveTarget(null); }}
          onClose={() => setSaveTarget(null)}
        />
      )}
    </div>
  );
}

// ─── BoardView ─────────────────────────────────────────────────────────────────

function BoardView({ items, onAdd, onUpdate, onRemove, currSymbol = '$' }) {
  const [boardCat,      setBoardCat]      = useState('All');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [selected,      setSelected]      = useState(null);
  const [addOpen,       setAddOpen]       = useState(false);

  // Keep selected in sync when items update
  useEffect(() => {
    if (selected) {
      const updated = items.find(i => i.id === selected.id);
      if (updated) setSelected(updated);
      else setSelected(null);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const catCounts = ['All', ...CATEGORIES].reduce((acc, cat) => {
    acc[cat] = cat === 'All' ? items.length : items.filter(i => i.category === cat).length;
    return acc;
  }, {});

  const filtered = items.filter(item => {
    const catOk    = boardCat === 'All' || item.category === boardCat;
    const statusOk = statusFilter === 'all' || item.status === statusFilter;
    return catOk && statusOk;
  });

  const statusFilters = [
    { key: 'all',       label: 'All',       color: 'var(--text-secondary)' },
    ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({
      key: k, label: v.label, color: v.color,
    })),
  ];

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Category sidebar */}
      <div style={{
        width: 160, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '12px 0',
      }}>
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setBoardCat(cat)}
            style={{
              width: '100%', padding: '9px 16px', textAlign: 'left',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: boardCat === cat ? 'var(--accent)15' : 'none',
              border: 'none',
              borderLeft: `2px solid ${boardCat === cat ? 'var(--accent)' : 'transparent'}`,
              color: boardCat === cat ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer',
              fontWeight: boardCat === cat ? 600 : 400,
            }}
          >
            <span>{cat}</span>
            <span style={{
              fontSize: 10, background: 'var(--bg-primary)',
              color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 10,
            }}>
              {catCounts[cat]}
            </span>
          </button>
        ))}

        {/* Add manually button */}
        <div style={{ margin: '14px 10px 0', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 8,
              border: '1px dashed var(--border)', background: 'none',
              color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Status pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {statusFilters.map(({ key, label, color }) => {
              const count = key === 'all'
                ? filtered.length
                : items.filter(i => i.status === key && (boardCat === 'All' || i.category === boardCat)).length;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12,
                    border: `1px solid ${statusFilter === key ? color : 'var(--border)'}`,
                    background: statusFilter === key ? color + '22' : 'none',
                    color: statusFilter === key ? color : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: statusFilter === key ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {label} {key !== 'all' && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 300,
              color: 'var(--text-secondary)', gap: 10,
            }}>
              <span style={{ fontSize: 40, opacity: 0.15 }}>🧥</span>
              <p style={{ margin: 0, fontSize: 13 }}>
                {items.length === 0
                  ? 'Your board is empty — discover looks and save them here'
                  : 'No items match this filter'}
              </p>
              {items.length === 0 && (
                <button
                  onClick={() => setAddOpen(true)}
                  style={{
                    padding: '7px 18px', borderRadius: 8, marginTop: 4,
                    border: '1px solid var(--accent)', background: 'var(--accent)15',
                    color: 'var(--accent)', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  + Add manually
                </button>
              )}
            </div>
          ) : (
            /* 2-col grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {filtered.map(item => (
                <BoardCard
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={setSelected}
                  currSymbol={currSymbol}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            item={selected}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onClose={() => setSelected(null)}
            currSymbol={currSymbol}
          />
        )}
      </div>

      {/* Add modal */}
      {addOpen && (
        <AddManualModal
          onAdd={async (data) => { await onAdd(data); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
          currSymbol={currSymbol}
        />
      )}
    </div>
  );
}

// ─── StyleTab ──────────────────────────────────────────────────────────────────

export default function StyleTab({ settings }) {
  const { items, add, update, remove } = useCollection('style_board', STORAGE_KEYS.STYLE_BOARD);
  const [view, setView] = useState('discover');
  const currSymbol = getCurrSymbol(settings?.currency || 'AUD');

  const handleSaveResult = async (data) => {
    await add({
      title:    data.title,
      brand:    '',
      category: data.category,
      status:   data.status,
      price:    data.price ?? null,
      imageUrl: data.imageUrl,
      notes:    '',
      url:      '',
      occasion: data.occasion || '',
    });
  };

  const tabs = [
    { key: 'discover', label: '🔍 Discover' },
    { key: 'board',    label: '📌 My Board', count: items.length },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sub-tab nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 24px', height: 48, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              border: 'none',
              background: view === tab.key ? 'var(--accent)22' : 'none',
              color: view === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer',
              fontWeight: view === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span style={{
                fontSize: 10, background: 'var(--accent)22',
                color: 'var(--accent)', padding: '1px 6px', borderRadius: 10,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'discover'
          ? <DiscoverView settings={settings} onSaveResult={handleSaveResult} currSymbol={currSymbol} />
          : <BoardView items={items} onAdd={add} onUpdate={update} onRemove={remove} currSymbol={currSymbol} />
        }
      </div>
    </div>
  );
}
