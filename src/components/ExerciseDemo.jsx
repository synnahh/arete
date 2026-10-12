// ExerciseDemo — start and finish photos (they swap by themselves, or tap to flip), the written
// steps and the form cue for one exercise. Photos and steps come from the public-domain
// free-exercise-db; photos load from a CDN only when this opens. Exercises without a match get a
// video-search link. Data: domain/exerciseMedia.js, src/data/exerciseSteps.json.
import { useEffect, useState } from 'react';
import { mediaFor } from '../domain/exerciseMedia.js';
import { findExercise, demoUrl } from '../domain/exerciseDb.js';

const small = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 };

export default function ExerciseDemo({ name }) {
  const media = mediaFor(name);
  const cue = findExercise(name)?.cue || null;
  const [frame, setFrame] = useState(0);
  const [steps, setSteps] = useState(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!media) return undefined;
    const t = setInterval(() => setFrame(f => (f + 1) % 2), 1200);
    return () => clearInterval(t);
  }, [media]);

  useEffect(() => {
    let alive = true;
    if (media) import('../data/exerciseSteps.json').then(m => { if (alive) setSteps((m.default || m)[name] || (m.default || m)[Object.keys(m.default || m).find(k => k.toLowerCase() === String(name).toLowerCase())] || []); }).catch(() => alive && setSteps([]));
    return () => { alive = false; };
  }, [media, name]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 12, border: '0.5px solid var(--card-border)', background: 'var(--bg-base)' }}>
      {media && !broken ? (
        <button type="button" onClick={() => setFrame(f => (f + 1) % 2)} aria-label={`${name}: ${frame === 0 ? 'start' : 'finish'} position. Tap to switch`}
          style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'block', width: '100%', maxWidth: 360, alignSelf: 'center' }}>
          <img src={media.images[frame]} alt={`${name}, ${frame === 0 ? 'start' : 'finish'} position`} loading="lazy" onError={() => setBroken(true)}
            style={{ width: '100%', height: 'auto', borderRadius: 10, display: 'block', background: 'var(--hover-bg)', aspectRatio: '3 / 2', objectFit: 'cover' }} />
        </button>
      ) : (
        <div style={small}>{media ? 'The photos could not load (offline?). The steps below still work.' : 'No photos for this exercise.'}</div>
      )}
      {cue && <div style={{ ...small, color: 'var(--text-primary)' }}>{cue}</div>}
      {steps && steps.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 20, ...small }}>
          {steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
        </ol>
      )}
      <a href={demoUrl(name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--tab-accent)' }}>Watch a video of {name}</a>
      {media && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Photos and steps: free-exercise-db (public domain).</div>}
    </div>
  );
}
