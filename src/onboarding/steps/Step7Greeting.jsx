import { useEffect, useRef } from 'react';
import { getGreeting } from '../../utils/time.js';

// VALERIE's exact first words  from the locked spec
function buildGreeting(userName, assistantName) {
  const timeGreeting = getGreeting();
  const name = userName || 'Rob';
  // Exact locked line for Rob; adapts name dynamically
  return `${timeGreeting}, ${name}. Quite the setup you've put together. I'll admit  I'm impressed. Let's make it worth it.`;
}

export default function Step7Greeting({ data, finish }) {
  const spoken = useRef(false);
  const greeting = buildGreeting(data.userName, data.assistantName);

  // Speak the greeting once on mount
  useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;

    const utt = new SpeechSynthesisUtterance(greeting);

    // Apply selected voice if available
    if (data.voice?.type === 'system' && data.voice.name) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.name === data.voice.name);
      if (match) utt.voice = match;
    }

    utt.rate  = 0.95;
    utt.pitch = 1.0;

    // Small delay  let the animation settle first
    setTimeout(() => window.speechSynthesis.speak(utt), 600);

    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36,
      textAlign: 'center',
    }}>
      {/* Orb  warm glow version */}
      <div className="fade-in" style={{ animationDelay: '0.1s', opacity: 0 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 35%, var(--accent), transparent 65%)',
          border: '0.5px solid var(--card-border)',
          boxShadow: '0 0 40px var(--orb-glow-active)',
          animation: 'orb-breathe 3.2s ease-in-out infinite',
        }} />
      </div>

      {/* Greeting text */}
      <div className="fade-in" style={{
        animationDelay: '0.3s', opacity: 0,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{
          fontSize: 17, fontWeight: 300, color: 'var(--text-primary)',
          lineHeight: 1.65, letterSpacing: '0.02em',
          maxWidth: 380,
          fontStyle: 'italic',
        }}>
          "{greeting}"
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
           {data.assistantName}
        </p>
      </div>

      {/* Enter button */}
      <div className="fade-in" style={{ animationDelay: '0.7s', opacity: 0 }}>
        <button onClick={finish} style={{
          padding: '14px 40px',
          borderRadius: 10,
          border: '0.5px solid var(--accent)',
          background: 'var(--active-bg)',
          color: 'var(--accent)',
          fontSize: 14, fontWeight: 500, letterSpacing: '0.06em',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={e => {
          e.target.style.background = 'var(--hover-bg)';
          e.target.style.boxShadow = '0 0 20px var(--orb-glow)';
        }}
        onMouseLeave={e => {
          e.target.style.background = 'var(--active-bg)';
          e.target.style.boxShadow = 'none';
        }}>
          Enter {data.assistantName} 
        </button>
      </div>
    </div>
  );
}
