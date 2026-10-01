// StarButton — favourite toggle for a food. Filled when it is a favourite.
export default function StarButton({ on, onClick, name, size = 32 }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!on} aria-label={`${on ? 'Remove' : 'Add'} ${name} ${on ? 'from' : 'to'} favourites`}
      style={{ width: size, height: size, flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: on ? '#e8a13a' : 'var(--text-secondary)', WebkitTapHighlightColor: 'transparent' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8 6.7 19.6l1.1-5.8L3.5 9.7l5.9-.8z" />
      </svg>
    </button>
  );
}
