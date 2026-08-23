import React, { useRef, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { getLifePathVisual } from '../systems/lifePathSystem';

interface CreatureCanvasProps {
  state: GameState;
  onTap: () => void;
  onStroke: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

const CreatureCanvas: React.FC<CreatureCanvasProps> = ({ state, onTap, onStroke, onHoldStart, onHoldEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const posRef = useRef({ x: state.position.x, y: state.position.y });
  const targetPosRef = useRef({ x: state.position.x, y: state.position.y });
  const blinkStateRef = useRef({ isBlinking: false, blinkTimer: 0, nextBlink: 2000 + Math.random() * 3000 });
  const holdTimerRef = useRef<number>(0);
  const isHoldingRef = useRef(false);
  const didHoldRef = useRef(false);
  const hasMovedRef = useRef(false);
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth position interpolation
  useEffect(() => {
    targetPosRef.current = { ...state.position };
  }, [state.position.x, state.position.y]);

  const renderEgg = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
    const pulse = Math.sin(time * 0.002) * 0.03 + 1;
    const wobble = Math.sin(time * 0.001) * 2;
    
    ctx.save();
    ctx.translate(x, y + wobble);
    ctx.scale(pulse, pulse);
    
    // Egg glow
    const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
    glow.addColorStop(0, 'rgba(200, 180, 150, 0.3)');
    glow.addColorStop(1, 'rgba(200, 180, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    
    // Egg body
    const gradient = ctx.createRadialGradient(-10, -15, 5, 0, 0, 45);
    gradient.addColorStop(0, '#e8ddd0');
    gradient.addColorStop(0.7, '#c9b8a0');
    gradient.addColorStop(1, '#a08b70');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Subtle pattern
    ctx.strokeStyle = 'rgba(160, 140, 110, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -5, 20, 30, 0.1, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }, []);

  const renderCreature = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
    const app = state.identity.appearance;
    const isSleeping = state.sleepState === 'sleeping';
    const behavior = state.creatureBehavior;
    const breathSpeed = isSleeping ? 0.0016 : 0.003;
    const breathAmount = isSleeping ? 0.035 : 0.02;
    const breath = Math.sin(time * breathSpeed) * breathAmount + 1;
    const { eyeSize, roundness } = app;
    const pathVisual = getLifePathVisual(state);
    const hue = (app.baseHue + pathVisual.hueShift * pathVisual.strength + 360) % 360;
    const saturation = 20 + (pathVisual.saturation - 20) * pathVisual.strength;
    const lightness = 52 + (pathVisual.lightness - 52) * pathVisual.strength;
    const hasPath = (id: typeof pathVisual.paths[number]) => pathVisual.paths.includes(id);

    // Each state has its own body language. The movement is deliberately
    // small: it should make the creature readable without turning it into a
    // collection of disconnected canned animations.
    let motionY = 0;
    let motionRotation = 0;
    let motionScaleX = 1;
    let motionScaleY = 1;
    if (isSleeping || behavior === 'sleeping') {
      motionY = 3;
      motionRotation = 0.035;
      motionScaleX = 1.06;
      motionScaleY = 0.94;
    } else if (behavior === 'walking') {
      const step = Math.sin(time * 0.012);
      motionY = -Math.abs(step) * 4;
      motionRotation = step * 0.025;
      motionScaleX = 1.02;
      motionScaleY = 0.98;
    } else if (behavior === 'observing') {
      motionY = -1.5;
      motionRotation = Math.sin(time * 0.0025) * 0.055;
    } else if (behavior === 'hesitating') {
      const hesitate = Math.sin(time * 0.004);
      motionY = -Math.max(0, hesitate) * 2;
      motionRotation = -0.055 + hesitate * 0.018;
      motionScaleX = 0.98;
      motionScaleY = 1.015;
    } else if (behavior === 'investigating') {
      motionY = Math.sin(time * 0.005) * 1.5 + 1;
      motionRotation = 0.065 + Math.sin(time * 0.003) * 0.018;
    } else if (behavior === 'eating') {
      motionY = Math.abs(Math.sin(time * 0.009)) * 5;
      motionRotation = Math.sin(time * 0.009) * 0.018;
      motionScaleX = 1.025;
      motionScaleY = 0.975;
    } else if (behavior === 'playing') {
      const bounce = Math.abs(Math.sin(time * 0.009));
      motionY = -bounce * 9;
      motionRotation = Math.sin(time * 0.009) * 0.045;
      motionScaleX = 1 - bounce * 0.035;
      motionScaleY = 1 + bounce * 0.05;
    } else if (behavior === 'settling') {
      const settle = (Math.sin(time * 0.0035) + 1) / 2;
      motionY = 2 + settle * 2;
      motionScaleX = 1.045 + settle * 0.018;
      motionScaleY = 0.955 - settle * 0.012;
    } else if (behavior === 'imitating') {
      const echo = Math.sin(time * 0.006);
      motionY = -Math.max(0, echo) * 4;
      motionRotation = echo * 0.065;
    } else if (behavior === 'proud') {
      const lift = (Math.sin(time * 0.004) + 1) / 2;
      motionY = -2 - lift * 2;
      motionScaleX = 0.985;
      motionScaleY = 1.025;
    } else if (behavior === 'uncomfortable') {
      const shift = Math.sin(time * 0.006);
      motionY = Math.abs(shift) * 1.5;
      motionRotation = shift * 0.035;
      motionScaleX = 0.985;
      motionScaleY = 1.015;
    } else if (behavior === 'toileting') {
      const settle = (Math.sin(time * 0.003) + 1) / 2;
      motionY = 5 + settle;
      motionScaleX = 1.07;
      motionScaleY = 0.91;
    } else if (behavior === 'washing') {
      const shake = Math.sin(time * 0.022);
      motionRotation = shake * 0.045;
      motionScaleX = 1 + Math.abs(shake) * 0.018;
      motionScaleY = 1 - Math.abs(shake) * 0.012;
    } else if (behavior === 'reacting') {
      const settle = Math.sin(time * 0.006);
      motionY = -Math.max(0, settle) * 2;
      motionScaleX = 1 + settle * 0.025;
      motionScaleY = 1 - settle * 0.018;
    }
    
    // Blink logic
    const blink = blinkStateRef.current;
    blink.blinkTimer += 16;
    if (blink.blinkTimer > blink.nextBlink) {
      blink.isBlinking = true;
      if (blink.blinkTimer > blink.nextBlink + 150) {
        blink.isBlinking = false;
        blink.blinkTimer = 0;
        blink.nextBlink = 2000 + Math.random() * 4000;
      }
    }

    ctx.save();
    ctx.translate(x, y + motionY);
    ctx.scale(state.facing === 'left' ? -1 : 1, 1);
    ctx.rotate(motionRotation);
    ctx.scale(breath * motionScaleX * pathVisual.width, breath * motionScaleY * pathVisual.height);

    // The skin is a consequence of the creature's life, not a wardrobe. Its
    // aura begins faint and becomes readable as a path stabilises.
    if (pathVisual.paths.length > 0) {
      const aura = ctx.createRadialGradient(0, 0, 24, 0, 0, 62);
      aura.addColorStop(0, pathVisual.aura);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.globalAlpha = 0.35 + pathVisual.strength * 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 38, 35 * roundness, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    if (app.tailLength > 0) {
      const excited = behavior === 'playing' || state.emotionalState === 'happy' || state.emotionalState === 'excited';
      const tailWag = Math.sin(time * (excited ? 0.014 : 0.005)) * (excited ? 0.55 : 0.28);
      ctx.save();
      ctx.rotate(tailWag - 0.2);
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness + 3}%)`;
      ctx.beginPath();
      ctx.ellipse(-35 * roundness, 10, 18 * app.tailLength, 8, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Main body
    const bodyGrad = ctx.createRadialGradient(-10, -15, 5, 0, 5, 45);
    bodyGrad.addColorStop(0, `hsl(${hue}, ${Math.max(12, saturation - 4)}%, ${Math.min(72, lightness + 14)}%)`);
    bodyGrad.addColorStop(1, `hsl(${hue}, ${saturation}%, ${Math.max(30, lightness - 7)}%)`);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 5, 38 * roundness, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cleanliness is body language, not a meter. A few muted floor-coloured
    // flecks appear gradually and disappear completely after washing.
    const dirtStrength = Math.max(0, Math.min(1, (55 - state.needs.hygiene) / 42));
    if (dirtStrength > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(67, 57, 43, ${0.18 + dirtStrength * 0.42})`;
      [
        [-23, 13, 5, 3, -0.35],
        [19, 20, 4, 5, 0.25],
        [-10, 28, 3.5, 2.5, 0.1],
        [28, 4, 2.8, 2.2, 0],
      ].slice(0, 1 + Math.ceil(dirtStrength * 3)).forEach(([sx, sy, rx, ry, rotation]) => {
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, rotation, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Ears
    if (app.earShape !== 'none') {
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${Math.max(32, lightness - 4)}%)`;
      const earW = app.earShape === 'pointy' ? 12 : 16;
      const perk = behavior === 'observing' || behavior === 'investigating' || behavior === 'hesitating' || behavior === 'proud' ? 4 : 0;
      const earH = (app.earShape === 'pointy' ? 22 : 18) + perk;
      // Left ear
      ctx.beginPath();
      ctx.ellipse(-22, -22, earW, earH, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Right ear
      ctx.beginPath();
      ctx.ellipse(22, -22, earW, earH, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face area (slightly lighter)
    ctx.fillStyle = `hsl(${hue}, ${Math.max(10, saturation - 7)}%, ${Math.min(76, lightness + 16)}%)`;
    ctx.beginPath();
    ctx.ellipse(0, -8, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const attentive = behavior === 'observing' || behavior === 'investigating' || behavior === 'hesitating' || behavior === 'imitating' || behavior === 'proud' || behavior === 'uncomfortable';
    const eyeW = 10 * eyeSize * (attentive ? 1.08 : 1);
    const pathEyeHeight = 1 - pathVisual.eyeDroop * pathVisual.strength;
    const openEyeHeight = 10 * eyeSize * pathEyeHeight * (attentive ? 1.18 : behavior === 'eating' ? 0.72 : 1);
    const eyeH = isSleeping || blink.isBlinking ? 1 : openEyeHeight;
    ctx.fillStyle = isSleeping ? '#4a4035' : '#2a2018';
    
    // Left eye
    ctx.beginPath();
    ctx.ellipse(-12, -12, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.ellipse(12, -12, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!isSleeping && !blink.isBlinking) {
      // Eye shine
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-10, -15, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, -15, 3, 0, Math.PI * 2);
      ctx.fill();

      if (attentive) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(-14, -9, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -9, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (state.emotionalState === 'skeptical' || state.emotionalState === 'wary') {
        ctx.strokeStyle = 'rgba(42,32,24,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-20, -25);
        ctx.lineTo(-6, -22);
        ctx.moveTo(6, -22);
        ctx.lineTo(20, -25);
        ctx.stroke();
      } else if (state.emotionalState === 'concerned') {
        ctx.strokeStyle = 'rgba(42,32,24,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-20, -22);
        ctx.lineTo(-7, -25);
        ctx.moveTo(7, -25);
        ctx.lineTo(20, -22);
        ctx.stroke();
      }
    }

    // Nose
    ctx.fillStyle = '#3a3028';
    ctx.beginPath();
    ctx.ellipse(0, -2, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth - subtle expression
    ctx.strokeStyle = '#3a3028';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (state.emotionalState === 'happy' || state.emotionalState === 'excited') {
      ctx.arc(0, 4, 6, 0.1, Math.PI - 0.1);
    } else if (state.emotionalState === 'sad' || state.emotionalState === 'concerned') {
      ctx.arc(0, 10, 6, Math.PI + 0.1, -0.1);
    } else if (state.emotionalState === 'skeptical' || state.emotionalState === 'wary') {
      ctx.moveTo(-5, 5);
      ctx.quadraticCurveTo(1, 3, 5, 5);
    } else {
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(0, 6, 4, 4);
    }
    ctx.stroke();

    // Path marks deliberately layer when two lives cross. A Gymbro/Gamer
    // keeps both the headband and headset; a Stoner/Monk can grow a beanie
    // under a quiet halo. Crossbreeds therefore look authored, not recoloured.
    ctx.save();
    ctx.globalAlpha = 0.28 + pathVisual.strength * 0.72;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (hasPath('doomer')) {
      ctx.strokeStyle = 'rgba(32, 31, 45, 0.9)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, -8, 31, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }
    if (hasPath('stoner')) {
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.arc(0, -29, 23, Math.PI, Math.PI * 2);
      ctx.lineTo(23, -25);
      ctx.lineTo(-23, -25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 46, 36, 0.75)';
      ctx.fillRect(-24, -28, 48, 5);
    }
    if (hasPath('gymbro')) {
      ctx.strokeStyle = pathVisual.accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-25, -24);
      ctx.quadraticCurveTo(0, -19, 25, -24);
      ctx.stroke();
    }
    if (hasPath('gamer')) {
      ctx.strokeStyle = pathVisual.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -10, 32, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.fillStyle = pathVisual.accent;
      ctx.fillRect(-34, -16, 6, 17);
      ctx.fillRect(28, -16, 6, 17);
    }
    if (hasPath('conspiracist')) {
      ctx.fillStyle = 'rgba(205, 208, 198, 0.92)';
      ctx.strokeStyle = 'rgba(90, 93, 84, 0.72)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-18, -29);
      ctx.lineTo(2, -48);
      ctx.lineTo(19, -28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, -34);
      ctx.lineTo(9, -30);
      ctx.moveTo(1, -45);
      ctx.lineTo(4, -31);
      ctx.stroke();
    }
    if (hasPath('workaholic')) {
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(6, 15);
      ctx.lineTo(2, 31);
      ctx.lineTo(-2, 31);
      ctx.lineTo(-6, 15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(55, 55, 58, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-12, -5, 9, 0.12, Math.PI - 0.12);
      ctx.arc(12, -5, 9, 0.12, Math.PI - 0.12);
      ctx.stroke();
    }
    if (hasPath('alcoholic')) {
      ctx.fillStyle = 'rgba(174, 70, 58, 0.22)';
      ctx.beginPath();
      ctx.ellipse(-19, 0, 8, 5, -0.1, 0, Math.PI * 2);
      ctx.ellipse(19, 0, 8, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 48, 46, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-12, -6, 8, 0.1, Math.PI - 0.1);
      ctx.arc(12, -6, 8, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    if (hasPath('degen')) {
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.arc(30, 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(22, 58, 34, 0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 30, 21.5);
    }
    if (hasPath('party_animal')) {
      ctx.fillStyle = pathVisual.accent;
      [[-31, -2], [31, -1], [-27, 20], [27, 24]].forEach(([sx, sy], index) => {
        const twinkle = 2.2 + ((Math.sin(time * 0.006 + index) + 1) * 1.2);
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (hasPath('caretaker')) {
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.moveTo(-19, 13);
      ctx.bezierCurveTo(-27, 5, -34, 16, -19, 27);
      ctx.bezierCurveTo(-4, 16, -11, 5, -19, 13);
      ctx.fill();
    }
    if (hasPath('monk')) {
      ctx.strokeStyle = pathVisual.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -39, 25, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.arc(0, -17, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hasPath('rebel')) {
      ctx.strokeStyle = pathVisual.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(17, -20);
      ctx.lineTo(9, -12);
      ctx.lineTo(17, -8);
      ctx.stroke();
      ctx.fillStyle = pathVisual.accent;
      ctx.beginPath();
      ctx.arc(25, -16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // A few restrained reaction marks make delight visible even before the
    // creature has language. They are canvas-native and require no asset load.
    if (behavior === 'playing' || (behavior === 'reacting' && state.emotionalState === 'happy')) {
      const pulse = (Math.sin(time * 0.008) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = `rgba(232, 213, 183, ${0.3 + pulse * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      [-1, 1].forEach(side => {
        const markX = x + side * (49 + pulse * 4);
        const markY = y - 28 - pulse * 5;
        ctx.beginPath();
        ctx.moveTo(markX, markY - 4);
        ctx.lineTo(markX, markY + 4);
        ctx.moveTo(markX - 4, markY);
        ctx.lineTo(markX + 4, markY);
        ctx.stroke();
      });
      ctx.restore();
    }
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resizeCanvas();

    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Smooth position at the same perceived speed on 60 Hz and 120 Hz
      // screens. The previous fixed per-frame factor moved twice as fast on
      // high-refresh phones.
      const previousTime = lastFrameTimeRef.current ?? time - 16;
      const deltaMs = Math.min(48, Math.max(1, time - previousTime));
      lastFrameTimeRef.current = time;
      const follow = 1 - Math.exp(-deltaMs * 0.0032);
      posRef.current.x += (targetPosRef.current.x - posRef.current.x) * follow;
      posRef.current.y += (targetPosRef.current.y - posRef.current.y) * follow;

      const px = (posRef.current.x / 100) * rect.width;
      const py = (posRef.current.y / 100) * rect.height;

      ctx.clearRect(0, 0, rect.width, rect.height);

      // CRITICAL: Never render egg if creature has already hatched.
      // The hatched flag is the source of truth for lifecycle state.
      if (!state.development.hatched && state.development.stage === 'egg') {
        renderEgg(ctx, px, py, time);
      } else {
        renderCreature(ctx, px, py, time);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      lastFrameTimeRef.current = null;
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [state.development.hatched, state.development.stage, renderEgg, renderCreature]);

  // Touch handlers
  const clearHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // The canvas spans the room, but only the visible creature should react.
    // Without hit testing, tapping empty floor or an object also counted as a
    // creature touch.
    const creatureX = (posRef.current.x / 100) * rect.width;
    const creatureY = (posRef.current.y / 100) * rect.height;
    if (Math.abs(x - creatureX) > 55 || Math.abs(y - creatureY) > 65) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    isHoldingRef.current = true;
    didHoldRef.current = false;
    hasMovedRef.current = false;
    holdTimerRef.current = 0;
    strokeStartRef.current = { x, y };
    
    holdIntervalRef.current = setInterval(() => {
      holdTimerRef.current += 100;
      if (holdTimerRef.current >= 600 && isHoldingRef.current) {
        didHoldRef.current = true;
        onHoldStart();
        clearHold();
      }
    }, 100);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    clearHold();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isHoldingRef.current && strokeStartRef.current) {
      const dx = x - strokeStartRef.current.x;
      const dy = y - strokeStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (didHoldRef.current) {
        onHoldEnd();
      } else if (dist > 20) {
        onStroke();
      } else {
        onTap();
      }
    }
    
    isHoldingRef.current = false;
    strokeStartRef.current = null;
    hasMovedRef.current = false;
    didHoldRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isHoldingRef.current || !strokeStartRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - strokeStartRef.current.x;
    const dy = y - strokeStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 30) {
      hasMovedRef.current = true;
      clearHold();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    e.preventDefault();
    clearHold();
    isHoldingRef.current = false;
    strokeStartRef.current = null;
    hasMovedRef.current = false;
    didHoldRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      role="button"
      aria-label={state.conversation.language === 'pl'
        ? `Wejdź w interakcję z ${state.identity.name || 'stworkiem'}`
        : `Interact with ${state.identity.name || 'the creature'}`}
      className="absolute inset-0 z-10 w-full h-full cursor-pointer"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    />
  );
};

export default CreatureCanvas;
