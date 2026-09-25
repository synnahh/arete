import { useState, useEffect } from 'react';
import { PrimaryButton } from './Step1Welcome.jsx';
import { BackButton } from './Step2Name.jsx';

export default function Step5Voice({ data, update, next, back }) {
  const [azureKey, setAzureKey]       = useState('');
  const [systemVoices, setSystemVoices] = useState([]);
  const [selected, setSelected]        = useState(null);

  useEffect(() => {
    // Load available system voices
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setSystemVoices(voices.slice(0, 8)); // show first 8
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  function previewVoice(voice) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(`Hello, I'm ${data.assistantName}.`);
    utt.voice = voice;
    window.speechSynthesis.speak(utt);
    setSelected(voice.name);
    update({ voice: { type: 'system', name: voice.name } });
  }

  function handleContinue() {
    if (azureKey.trim()) {
      update({ voice: { type: 'azure', key: azureKey.trim() } });
    }
    next();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <BackButton onClick={back} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}><</div>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Choose my voice
        </h2>
      </div>

      {/* Tier 1  Azure */}
      <VoiceSection title="Recommended  Azure Neural" badge="High quality  free tier">
        <input
          type="password"
          value={azureKey}
          onChange={e => setAzureKey(e.target.value)}
          placeholder="Paste Azure Speech API key"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            border: '0.5px solid var(--input-border)',
            background: 'var(--input-bg)', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; }}
        />
        <a href="https://azure.microsoft.com/free/cognitive-services/" target="_blank" rel="noreferrer"
          style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.7, marginTop: 4, display: 'block' }}>
          Get free Azure key 
        </a>
      </VoiceSection>

      {/* Tier 2  System voices */}
      <VoiceSection title="Free  System voices" badge="No setup required">
        {systemVoices.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading voices&</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {systemVoices.map(v => (
              <div key={v.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8,
                border: `0.5px solid ${selected === v.name ? 'var(--accent)' : 'var(--card-border)'}`,
                background: selected === v.name ? 'var(--active-bg)' : 'var(--card-fill)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }} onClick={() => previewVoice(v)}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {v.name.replace(/Microsoft\s/i, '').split(' (')[0]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selected === v.name ? ' previewing' : ' preview'}
                </span>
              </div>
            ))}
          </div>
        )}
      </VoiceSection>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={handleContinue}>Continue </PrimaryButton>
        <button onClick={() => { update({ voice: null }); next(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, padding: '6px 0', textAlign: 'left',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
        >
          Use system voice for now
        </button>
      </div>
    </div>
  );
}

function VoiceSection({ title, badge, children }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      border: '0.5px solid var(--card-border)',
      background: 'var(--card-fill)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{
          fontSize: 10, color: 'var(--accent)', opacity: 0.7,
          border: '0.5px solid var(--accent)', borderRadius: 4, padding: '2px 6px',
        }}>{badge}</span>
      </div>
      {children}
    </div>
  );
}
