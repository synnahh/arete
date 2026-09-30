/**
 * VaIerieOrb.jsx
 * ─────────────────────────────────────────────────────────────
 * VALERIE Audio Visualiser Orb Component
 *
 * Props:
 *   state   : 'idle' | 'listening' | 'thinking' | 'speaking'
 *   theme   : 'obsidian' | 'midnight' | 'ember' | 'phantom' | 'arctic' | 'crimson'
 *   size    : number (canvas px, default 320)
 *   showHUD : boolean (show state label + status lines, default true)
 *   showWave: boolean (show bottom waveform bar, default true)
 *
 * Usage:
 *   import VaIerieOrb from '@/components/VaIerieOrb'
 *   <VaIerieOrb state="idle" theme="obsidian" />
 *
 * State is driven externally — wire it to your AI call lifecycle:
 *   idle      → default, no call in progress
 *   listening → SpeechRecognition is active (user speaking)
 *   thinking  → Claude / Ollama API call in flight
 *   speaking  → TTS (SpeechSynthesis / ElevenLabs) is playing
 *
 * Theme is driven by the global theme setting in localStorage/Firebase.
 * Pull the current theme from your settings store and pass it as a prop.
 */

import { useEffect, useRef } from 'react'

// ── Theme definitions — mirrors the 6 locked themes in the Build Prompt ──
const THEMES = {
  obsidian: { bg: '#06020e', ac: [210, 210, 210] },
  midnight: { bg: '#020614', ac: [100, 160, 255] },
  ember:    { bg: '#0e0600', ac: [230, 150,  40] },
  phantom:  { bg: '#06020e', ac: [160, 100, 230] },
  arctic:   { bg: '#f0f2f6', ac: [ 60, 120, 200] },
  crimson:  { bg: '#0e0202', ac: [220,  70,  70] },
}

// ── HUD copy per state ──
const HUD = {
  idle:      { dot: '#888',    lines: ['SYSTEM STANDBY', 'CORE STABLE', 'AWAITING INPUT'],          right: [] },
  listening: { dot: '#00ff88', lines: [' AUDIO DETECTED', 'SCANNING...', 'ANALYZING FREQUENCIES'], right: [{ l: 'INPUT GAIN', v: 72 }, { l: 'SIGNAL STR.', v: 88 }, { l: 'NOISE RED.', v: 55 }] },
  thinking:  { dot: '#ffaa00', lines: [' PROCESSING', 'NEURAL NETWORK ACTIVE', 'COMPUTING...'],    right: [], cpu: 87 },
  speaking:  { dot: '#ff4466', lines: [' OUTPUT ACTIVE', 'SYNTHESIZING VOICE', 'TRANSMITTING'],    right: [{ l: 'OUTPUT VOL.', v: 91 }, { l: 'VOICE CLAR.', v: 78 }, { l: 'POWER', v: 95 }] },
}

export default function VaIerieOrb({
  state = 'idle',
  theme = 'obsidian',
  size = 320,
  showHUD = true,
  showWave = true,
}) {
  const canvasRef  = useRef(null)
  const waveRef    = useRef(null)
  const rafRef     = useRef(null)
  const stateRef   = useRef(state)
  const themeRef   = useRef(theme)
  const TRef       = useRef(0)
  const thinkARef  = useRef(0)

  // Keep refs in sync with props so the animation loop always reads latest
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { themeRef.current = theme }, [theme])

  useEffect(() => {
    const cv  = canvasRef.current
    const wCv = waveRef.current
    if (!cv) return
    cv.width  = size
    cv.height = size
    if (wCv) { wCv.width = Math.round(size * 0.82); wCv.height = 28 }

    const ctx  = cv.getContext('2d')
    const wCtx = wCv ? wCv.getContext('2d') : null

    // ── Helpers ──────────────────────────────────────────────
    const rgb = (ac, a = 1) => `rgba(${ac[0]},${ac[1]},${ac[2]},${a})`

    function starPts(cx, cy, R, r, twist) {
      const p = []
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + twist
        p.push([cx + Math.cos(a) * (i % 2 === 0 ? R : r), cy + Math.sin(a) * (i % 2 === 0 ? R : r)])
      }
      return p
    }

    function drawStarFrame(c, cx, cy, R, r, twist, fillA, strokeA, ac) {
      const op = starPts(cx, cy, R, r, twist)
      const ip = starPts(cx, cy, R * 0.5, r * 0.5, twist)
      c.save()
      c.beginPath()
      c.moveTo(op[0][0], op[0][1])
      for (let i = 1; i < op.length; i++) c.lineTo(op[i][0], op[i][1])
      c.closePath()
      c.moveTo(ip[0][0], ip[0][1])
      for (let i = ip.length - 1; i >= 0; i--) c.lineTo(ip[i][0], ip[i][1])
      c.closePath()
      c.fillStyle = rgb(ac, fillA)
      c.fill('evenodd')
      // Outer stroke
      c.beginPath()
      c.moveTo(op[0][0], op[0][1])
      for (let i = 1; i < op.length; i++) c.lineTo(op[i][0], op[i][1])
      c.closePath()
      c.strokeStyle = rgb(ac, strokeA); c.lineWidth = 1.4; c.lineJoin = 'miter'; c.miterLimit = 15
      c.stroke()
      // Inner bevel
      c.beginPath()
      c.moveTo(ip[0][0], ip[0][1])
      for (let i = 1; i < ip.length; i++) c.lineTo(ip[i][0], ip[i][1])
      c.closePath()
      c.strokeStyle = rgb(ac, strokeA * 0.45); c.lineWidth = 0.8; c.stroke()
      // Tip highlights
      for (let i = 0; i < 5; i++) {
        const tip = op[i * 2], L = op[((i * 2) - 1 + 10) % 10], Ri = op[(i * 2 + 1) % 10]
        c.beginPath(); c.moveTo(L[0], L[1]); c.lineTo(tip[0], tip[1]); c.lineTo(Ri[0], Ri[1])
        c.strokeStyle = rgb(ac, Math.min(strokeA * 1.2, 1)); c.lineWidth = 1.8; c.stroke()
      }
      c.restore()
    }

    function drawTipGlow(c, cx, cy, R, r, twist, glowA, ac) {
      const pts = starPts(cx, cy, R, r, twist)
      for (let i = 0; i < 10; i += 2) {
        const [tx, ty] = pts[i]
        const gr = c.createRadialGradient(tx, ty, 0, tx, ty, R * 0.5)
        gr.addColorStop(0, rgb(ac, glowA * 1.5)); gr.addColorStop(1, rgb(ac, 0))
        c.fillStyle = gr; c.beginPath(); c.arc(tx, ty, R * 0.5, 0, Math.PI * 2); c.fill()
      }
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8)
      cg.addColorStop(0, rgb(ac, glowA * 0.45)); cg.addColorStop(1, rgb(ac, 0))
      c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, R * 0.8, 0, Math.PI * 2); c.fill()
    }

    function drawPlatform(c, cx, cy, R, ac, alpha) {
      const gr = c.createRadialGradient(cx, cy + R * 0.85, 0, cx, cy + R * 0.85, R * 1.1)
      gr.addColorStop(0, rgb(ac, alpha * 0.6)); gr.addColorStop(0.5, rgb(ac, alpha * 0.2)); gr.addColorStop(1, rgb(ac, 0))
      c.fillStyle = gr; c.beginPath(); c.ellipse(cx, cy + R * 0.85, R * 1.1, R * 0.2, 0, 0, Math.PI * 2); c.fill()
      c.strokeStyle = rgb(ac, alpha * 0.35); c.lineWidth = 0.5
      c.beginPath(); c.ellipse(cx, cy + R * 0.85, R * 0.9, R * 0.14, 0, 0, Math.PI * 2); c.stroke()
    }

    // ── Idle: lightning bolts from tips ──
    const bolts = Array.from({ length: 5 }, (_, i) => ({ tipIdx: i * 2, life: 0, maxLife: 30 + Math.random() * 50, path: [] }))
    function updateBolts(pts) {
      bolts.forEach(b => {
        b.life++
        if (b.life > b.maxLife) { b.life = 0; b.maxLife = 40 + Math.random() * 60; b.path = [] }
        if (b.path.length === 0) {
          const [sx, sy] = pts[b.tipIdx]; b.path = [[sx, sy]]
          let lx = sx, ly = sy
          for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
            lx += (-12 + Math.random() * 24); ly += (-8 + Math.random() * 16); b.path.push([lx, ly])
          }
        }
      })
    }
    function drawBolts(c, pts, ac, alpha) {
      updateBolts(pts)
      bolts.forEach(b => {
        if (b.path.length < 2) return
        const prog = 1 - b.life / b.maxLife
        c.save(); c.globalAlpha = prog * alpha; c.strokeStyle = rgb(ac, 0.8); c.lineWidth = 0.7
        c.beginPath(); c.moveTo(b.path[0][0], b.path[0][1])
        b.path.forEach(p => c.lineTo(p[0], p[1])); c.stroke(); c.restore()
      })
    }

    // ── Listening: expanding rings ──
    function drawListenRings(c, cx, cy, R, ac, T) {
      for (let i = 0; i < 3; i++) {
        const phase = (T * 0.35 + i / 3) % 1
        c.beginPath(); c.arc(cx, cy, R * 0.9 + phase * R * 1.4, 0, Math.PI * 2)
        c.strokeStyle = rgb(ac, (1 - phase) * 0.22); c.lineWidth = 0.8; c.stroke()
      }
    }

    // ── Thinking: circuit rings + scan ──
    function drawThinkRings(c, cx, cy, R, ac, T, thinkA) {
      for (let i = 0; i < 5; i++) {
        const phase = (T * 0.25 + i / 5) % 1
        c.beginPath(); c.arc(cx, cy, R * 0.85 + phase * R * 1.5, 0, Math.PI * 2)
        c.strokeStyle = rgb(ac, (1 - phase) * 0.16); c.lineWidth = 0.6; c.stroke()
      }
      for (let i = 0; i < 8; i++) {
        const ang = thinkA + i * Math.PI * 0.25
        c.beginPath(); c.arc(cx, cy, R * 1.2, ang, ang + 0.45)
        c.strokeStyle = rgb(ac, 0.32); c.lineWidth = 2; c.stroke()
      }
      for (let i = 0; i < 5; i++) {
        const ang = -thinkA * 1.2 + i * Math.PI * 0.4
        c.beginPath(); c.arc(cx, cy, R * 1.55, ang, ang + 0.28)
        c.strokeStyle = rgb(ac, 0.18); c.lineWidth = 1; c.stroke()
      }
      c.save(); c.globalAlpha = 0.06; c.strokeStyle = rgb(ac, 1); c.lineWidth = 0.5
      for (let x = -R * 1.6; x < R * 1.6; x += 14) { c.beginPath(); c.moveTo(cx + x, cy - R * 1.6); c.lineTo(cx + x, cy + R * 1.6); c.stroke() }
      for (let y = -R * 1.6; y < R * 1.6; y += 14) { c.beginPath(); c.moveTo(cx - R * 1.6, cy + y); c.lineTo(cx + R * 1.6, cy + y); c.stroke() }
      c.restore()
      // Scan line
      const sy = cy - R + ((T * 45) % (R * 2))
      c.save(); c.globalAlpha = 0.25; c.strokeStyle = rgb(ac, 1); c.lineWidth = 0.8
      c.beginPath(); c.moveTo(cx - R, sy); c.lineTo(cx + R, sy); c.stroke(); c.restore()
    }

    // ── Speaking: slow breathing bars + rotating beams ──
    function drawSpeakBars(c, cx, cy, R, ac, T) {
      for (let i = 0; i < 56; i++) {
        const ang = (i / 56) * Math.PI * 2
        const amp = Math.abs(Math.sin(T * 1.2 + i * 0.28)) * 0.5 + Math.abs(Math.sin(T * 0.7 + i * 0.45)) * 0.3 + Math.abs(Math.sin(T * 1.8 + i * 0.18)) * 0.2
        const r1 = R + 5, r2 = r1 + 6 + amp * 30
        c.beginPath()
        c.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
        c.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
        c.strokeStyle = rgb(ac, 0.1 + amp * 0.55); c.lineWidth = amp > 0.6 ? 1.6 : 0.9; c.lineCap = 'round'; c.stroke()
      }
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + T * 0.18
        const beam = 0.4 + Math.abs(Math.sin(T * 0.8 + i * 1.2)) * 0.5
        const bLen = R + 20 + beam * 50
        const gr = c.createLinearGradient(cx, cy, cx + Math.cos(ang) * bLen, cy + Math.sin(ang) * bLen)
        gr.addColorStop(0, rgb(ac, 0)); gr.addColorStop(0.5, rgb(ac, beam * 0.4)); gr.addColorStop(1, rgb(ac, 0))
        c.strokeStyle = gr; c.lineWidth = 1.2; c.lineCap = 'round'
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * bLen, cy + Math.sin(ang) * bLen); c.stroke()
      }
    }

    // ── Flank waveforms ──
    function drawFlankWave(c, cx, cy, R, ac, T, mode) {
      const side = R * 1.15
      const wH = mode === 'speaking' ? 42 : 32
      const spd = mode === 'speaking' ? 1.8 : 3.0
      ;[[cx - side - 80, 1], [cx + side + 20, -1]].forEach(([startX, dir]) => {
        c.save(); c.globalAlpha = 0.5; c.strokeStyle = rgb(ac, 1); c.lineWidth = 1; c.beginPath()
        for (let i = 0; i <= 120; i++) {
          const x = startX + i * dir
          const amp = wH * (0.2 + Math.abs(Math.sin(i * 0.14 + T * spd)) * 0.8)
          const y = cy + Math.sin(i * 0.11 + T * spd) * amp
          i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        }
        c.stroke(); c.restore()
      })
    }

    // ── Chromatic aberration ──
    function drawChromatic(c, drawFn, amt) {
      const tmp = document.createElement('canvas'); tmp.width = size; tmp.height = size
      const tc = tmp.getContext('2d'); drawFn(tc)
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.45
      c.drawImage(tmp, -amt, 0); c.drawImage(tmp, amt, 0)
      c.restore(); c.drawImage(tmp, 0, 0)
    }

    // ── Small waveform ──
    function drawWaveSmall(T, ac, mode) {
      if (!wCtx) return
      const ww = wCv.width
      wCtx.clearRect(0, 0, ww, 28)
      wCtx.strokeStyle = rgb(ac, 1); wCtx.lineWidth = 1; wCtx.beginPath()
      const spd = mode === 'speaking' ? 1.5 : mode === 'listening' ? 2.5 : 0.6
      const amp = mode === 'idle' ? 3 : mode === 'thinking' ? 5 : 11
      for (let x = 0; x < ww; x++) {
        const y = 14 + Math.sin(x * 0.07 * spd + T * spd * 1.5) * amp * (0.5 + Math.sin(x * 0.035 + T) * 0.5)
        x === 0 ? wCtx.moveTo(x, y) : wCtx.lineTo(x, y)
      }
      wCtx.globalAlpha = mode === 'idle' ? 0.35 : 0.7; wCtx.stroke(); wCtx.globalAlpha = 1
    }

    // ── Main animation loop ──────────────────────────────────
    function frame() {
      TRef.current += 0.016
      thinkARef.current += 0.028
      const T      = TRef.current
      const thinkA = thinkARef.current
      const S      = stateRef.current
      const ac     = (THEMES[themeRef.current] || THEMES.obsidian).ac

      const CX = size / 2
      const CY = size * 0.46
      const pulse = Math.pow(Math.max(0, Math.sin(T * 1.05)), 0.35)

      let R = 76
      if (S === 'listening') R = 80 + Math.sin(T * 2.5) * 3
      if (S === 'speaking')  R = 77 + Math.sin(T * 1.4) * 3
      R *= (1 + pulse * 0.05)
      const r      = R * 0.4
      const twist  = S === 'speaking' ? T * 0.12 : S === 'listening' ? T * 0.13 : T * 0.08
      const glowA  = S === 'speaking'  ? 0.2  + Math.sin(T * 1.2) * 0.06
                   : S === 'listening' ? 0.22 + Math.sin(T * 2)   * 0.08
                   : 0.12 + pulse * 0.07
      const fillA  = S === 'speaking'  ? 0.10 + Math.sin(T * 1.0) * 0.03
                   : S === 'listening' ? 0.12 : 0.07 + pulse * 0.03
      const edgeA  = S === 'speaking'  ? 0.9  + Math.sin(T * 1.2) * 0.08
                   : S === 'listening' ? 0.95 : 0.85 + pulse * 0.1

      ctx.clearRect(0, 0, size, size)

      // Background radial
      const bgGr = ctx.createRadialGradient(CX, CY, 0, CX, CY, size * 0.6)
      bgGr.addColorStop(0, rgb(ac, S === 'thinking' ? 0.07 : 0.04)); bgGr.addColorStop(1, rgb(ac, 0))
      ctx.fillStyle = bgGr; ctx.fillRect(0, 0, size, size)

      if (S === 'thinking')                  drawThinkRings(ctx, CX, CY, R, ac, T, thinkA)
      if (S === 'listening')                 drawListenRings(ctx, CX, CY, R, ac, T)
      if (S === 'listening' || S === 'speaking') drawFlankWave(ctx, CX, CY, R, ac, T, S)
      if (S === 'speaking')                  drawSpeakBars(ctx, CX, CY, R, ac, T)

      drawPlatform(ctx, CX, CY, R, ac, glowA * 0.85)

      const logoFn = (c) => {
        drawTipGlow(c, CX, CY, R, r, twist, glowA, ac)
        drawStarFrame(c, CX, CY, R, r, twist, fillA, edgeA, ac)
      }

      if (S === 'speaking')       drawChromatic(ctx, logoFn, 1.2 + Math.sin(T * 1.0) * 0.8)
      else if (S === 'listening') drawChromatic(ctx, logoFn, 2   + Math.sin(T * 3)   * 1.2)
      else                        logoFn(ctx)

      if (S === 'idle') {
        const pts = starPts(CX, CY, R, r, twist)
        drawBolts(ctx, pts, ac, 0.55 + pulse * 0.3)
      }

      if (showWave) drawWaveSmall(T, ac, S)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, showWave])

  const hud     = HUD[state]     || HUD.idle
  const themeObj = THEMES[theme] || THEMES.obsidian

  return (
    <div style={{ position: 'relative', width: size, height: size, background: 'transparent' }}>
      {/* Main canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />

      {/* HUD overlay */}
      {showHUD && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', fontFamily: "'Courier New', monospace",
        }}>
          {/* State title */}
          <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: hud.dot, display: 'inline-block', flexShrink: 0 }} />
            {state.toUpperCase()}
          </div>

          {/* Status lines */}
          <div style={{ position: 'absolute', top: 30, left: 14 }}>
            {hud.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase', color: `rgb(${themeObj.ac.join(',')})`, opacity: 0.6, lineHeight: 1.9 }}>{l}</div>
            ))}
          </div>

          {/* Right stats */}
          {hud.right.length > 0 && (
            <div style={{ position: 'absolute', top: 30, right: 14, textAlign: 'right' }}>
              {hud.right.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: 7, letterSpacing: '0.1em', color: `rgb(${themeObj.ac.join(',')})`, opacity: 0.55, minWidth: 52, textAlign: 'right', textTransform: 'uppercase' }}>{r.l}</span>
                  <div style={{ width: 44, height: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ width: `${r.v}%`, height: '100%', background: `rgb(${themeObj.ac.join(',')})` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CPU (thinking only) */}
          {hud.cpu && (
            <div style={{ position: 'absolute', bottom: 36, right: 14, textAlign: 'right' }}>
              <div style={{ fontSize: 7, letterSpacing: '0.12em', color: `rgb(${themeObj.ac.join(',')})`, opacity: 0.5, textTransform: 'uppercase' }}>CPU LOAD</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: `rgb(${themeObj.ac.join(',')})`, letterSpacing: '0.05em' }}>{hud.cpu}%</div>
            </div>
          )}
        </div>
      )}

      {/* Waveform bar */}
      {showWave && (
        <div style={{ position: 'absolute', bottom: 10, left: 14 }}>
          <div style={{ fontSize: 7, letterSpacing: '0.14em', color: `rgb(${themeObj.ac.join(',')})`, opacity: 0.4, textTransform: 'uppercase', marginBottom: 3 }}>AUDIO LEVEL</div>
          <canvas ref={waveRef} height={28} />
        </div>
      )}
    </div>
  )
}
