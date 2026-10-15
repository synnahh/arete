// Profile — who the app is for: your name, streak, training days, goals reached, the
// week at a glance, and the details the coach needs (birth date, sex, height). All of it
// is read from, or saved to, what the rest of the app already uses.
import { useMemo, useRef, useState } from 'react';
import { useRecap } from '../hooks/useRecap.js';
import { useCollection } from '../supabase/useCollection.js';
import { STORAGE_KEYS } from '../utils/storage.js';
import { updateSettings } from '../utils/settingsStore.js';
import { toLocalDateKey } from '../utils/localDate.js';
import { weekStrip, profileStats, goalDay } from '../domain/profileStats.js';
import { ageFrom } from '../domain/intake.js';
import { GOAL_TEMPLATES } from '../domain/goals.js';
import { label } from '../components/ui.js';
import SyncCheck from '../components/SyncCheck.jsx';
import Avatar from '../components/Avatar.jsx';
import HealthSetupGuide from '../components/HealthSetupGuide.jsx';
import PasteApply from '../components/PasteApply.jsx';
import PushReminders from '../components/PushReminders.jsx';
import { avatarFromFile } from '../utils/avatar.js';

const card = { padding: 18, borderRadius: 16, background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 14 };
const field = { width: '100%', boxSizing: 'border-box', minHeight: 46, borderRadius: 12, padding: '0 14px', border: '0.5px solid var(--card-border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 16 };

export default function Profile({ settings: settingsProp }) {
  const settings = settingsProp || {}; // null until the saved settings have loaded
  const today = toLocalDateKey(new Date());
  const { streak, data } = useRecap();
  const { items: workouts = [] } = useCollection('workout_logs', STORAGE_KEYS.WORKOUT_LOGS);
  const stats = useMemo(() => profileStats({ workouts, coachLog: settings.coachLog }), [workouts, settings.coachLog]);
  const strip = useMemo(() => weekStrip(data, today), [data, today]);
  const goal = settings.coachGoal;
  const day = goalDay(goal, today);

  const profile = settings.profile || {};
  const [name, setName] = useState(settings.userName || '');
  const [birthDate, setBirthDate] = useState(profile.birthDate || '');
  const [sex, setSex] = useState(profile.sex || '');
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [saved, setSaved] = useState(false);
  const age = ageFrom(birthDate, today);
  const fileRef = useRef(null);
  const [photoError, setPhotoError] = useState('');

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const avatar = await avatarFromFile(file);
      updateSettings({ profile: { ...(settings.profile || {}), avatar } });
      setPhotoError('');
    } catch (err) { setPhotoError(err?.message || 'Could not use that photo.'); }
  }
  function removePhoto() {
    const { avatar, ...rest } = settings.profile || {};
    updateSettings({ profile: rest });
  }

  function save() {
    updateSettings({
      userName: name.trim(),
      profile: { ...profile, birthDate: birthDate || null, sex: sex || null, heightCm: Number(heightCm) > 0 ? Number(heightCm) : null },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const stat = (value, name) => (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div className="val-num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{name}</div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px clamp(14px, 3vw, 28px) 40px', maxWidth: 760, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={profile.avatar ? 'Change profile picture' : 'Add a profile picture'} style={{ all: 'unset', cursor: 'pointer', position: 'relative', borderRadius: '50%', WebkitTapHighlightColor: 'transparent' }}>
            <Avatar settings={settings} size={96} />
            <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)', border: '0.5px solid var(--card-border)', color: 'var(--text-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} hidden />
          {profile.avatar && <button type="button" onClick={removePhoto} style={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', textDecoration: 'underline' }}>Remove picture</button>}
          {photoError && <div role="alert" style={{ fontSize: 12.5, color: '#e25d7a' }}>{photoError}</div>}
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{settings.userName || 'Your profile'}</h1>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {goal ? `${GOAL_TEMPLATES[goal.template]?.label || 'Goal'}${day ? ` · day ${day}` : ''}` : 'No goal set yet. Start the coach intake in Goal HQ.'}
          </div>
        </div>

        <section aria-label="Your numbers" style={card}>
          <div style={{ display: 'flex', gap: 6 }}>
            {stat(streak?.current ?? 0, 'Current streak')}
            {stat(stats.goalsAchieved, 'Goals achieved')}
            {stat(stats.workoutDays, 'Training days')}
          </div>
          <div role="group" aria-label="This week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {strip.map(d => (
              <div key={d.key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, color: d.isToday ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: d.isToday ? 700 : 400 }}>{d.label}</div>
                <div aria-label={`${d.label}: ${d.logged ? 'logged' : d.isFuture ? 'to come' : 'nothing logged'}`} style={{ margin: '6px auto 0', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: d.isToday ? '1.5px solid var(--accent)' : '0.5px solid var(--card-border)', background: d.logged ? 'var(--accent)' : 'var(--hover-bg)', color: 'var(--bg-base)', opacity: d.isFuture ? 0.45 : 1 }}>
                  {d.logged && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Edit profile" style={card}>
          <div style={label}>Edit profile</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={field} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Birth date{age != null ? ` · ${age}` : ''}</span><input type="date" value={birthDate} max={today} onChange={e => setBirthDate(e.target.value)} style={field} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>Height (cm)</span><input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} style={field} /></label>
          </div>
          <div role="group" aria-label="Sex" style={{ display: 'flex', gap: 8 }}>
            {['male', 'female'].map(s => <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(sex === s ? '' : s)} style={{ flex: 1, minHeight: 46, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: sex === s ? 700 : 500, textTransform: 'capitalize', border: `1px solid ${sex === s ? 'var(--accent)' : 'var(--card-border)'}`, background: sex === s ? 'var(--active-bg)' : 'transparent', color: sex === s ? 'var(--accent)' : 'var(--text-primary)' }}>{s}</button>)}
          </div>
          <button type="button" onClick={save} style={{ minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--bg-base)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{saved ? 'Saved' : 'Save'}</button>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Birth date, sex and height are used to work out your calorie needs. Your weight comes from your weigh-ins.</div>
        </section>
        <PushReminders settings={settings} />
        <PasteApply />
        <HealthSetupGuide />
        <SyncCheck />
      </div>
    </div>
  );
}
