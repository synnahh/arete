// Avatar — the profile picture, or the first letter of your name on the tab colour when there is none.
export default function Avatar({ settings = {}, size = 84, style }) {
  const src = settings?.profile?.avatar;
  const initial = (settings?.userName || '?').trim().charAt(0).toUpperCase() || '?';
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style };
  if (typeof src === 'string' && src.startsWith('data:image/')) {
    return <img src={src} alt="" draggable={false} style={{ ...base, objectFit: 'cover', display: 'block', border: '0.5px solid var(--card-border)' }} />;
  }
  return (
    <div aria-hidden="true" style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: Math.round(size * 0.43), fontWeight: 700, color: 'var(--on-tab-accent, #111)', background: 'var(--tab-accent, var(--accent))' }}>{initial}</div>
  );
}
