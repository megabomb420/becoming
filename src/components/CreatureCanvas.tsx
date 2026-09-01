import React, { useRef, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { getLifePathVisual } from '../systems/lifePathSystem';
import { getDominantNeed, getNeedUrgency } from '../systems/needsSystem';
import { getEffectiveStimulus } from '../systems/environmentSystem';

interface CreatureCanvasProps {
  state: GameState;
  onTap: () => void;
  onStroke: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

function fillCoat(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
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
  const environmentalStimulus = getEffectiveStimulus(state.world);

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

    // Egg glow — softer, more like moonlight on shell
    const glow = ctx.createRadialGradient(0, 0, 18, 0, 0, 72);
    glow.addColorStop(0, 'rgba(220, 208, 188, 0.34)');
    glow.addColorStop(0.4, 'rgba(200, 180, 150, 0.12)');
    glow.addColorStop(1, 'rgba(200, 180, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.fill();

    // Egg body — layered cel with subtle mottling
    const gradient = ctx.createRadialGradient(-12, -18, 4, 0, 0, 48);
    gradient.addColorStop(0, '#efe6d4');
    gradient.addColorStop(0.55, '#d3c5ad');
    gradient.addColorStop(1, '#9b8a71');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mottle
    ctx.fillStyle = 'rgba(122, 105, 82, 0.14)';
    ctx.beginPath();
    ctx.ellipse(-9, -14, 11, 16, -0.3, 0, Math.PI * 2);
    ctx.ellipse(12, 9, 8, 12, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle pattern line
    ctx.strokeStyle = 'rgba(150, 130, 100, 0.26)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -5, 20, 30, 0.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, []);

  const renderCreature = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
    const app = state.identity.appearance;
    const isSleeping = state.sleepState === 'sleeping';
    const behavior = state.creatureBehavior;
    const breathSpeed = isSleeping ? 0.00105 : 0.003;
    const breathAmount = isSleeping ? 0.012 : 0.022;
    const breath = Math.sin(time * breathSpeed) * breathAmount + 1;
    const { eyeSize, roundness } = app;
    const pathVisual = getLifePathVisual(state);
    const hue = (app.baseHue + pathVisual.hueShift * pathVisual.strength + 360) % 360;
    const saturation = 20 + (pathVisual.saturation - 20) * pathVisual.strength;
    const lightness = 52 + (pathVisual.lightness - 52) * pathVisual.strength;
    const hasPath = (id: typeof pathVisual.paths[number]) => pathVisual.paths.includes(id);
    const dominantNeed = getDominantNeed(state, true);
    const dominantUrgency = dominantNeed ? getNeedUrgency(state.needs[dominantNeed]) : 'settled';
    const needStrength = dominantUrgency === 'urgent' ? 1 : dominantUrgency === 'attention' ? 0.65 : dominantUrgency === 'notice' ? 0.3 : 0;
    const environment = environmentalStimulus;
    const coldStrength = Math.max(0, -environment.temperatureStress);
    const heatStrength = Math.max(0, environment.temperatureStress);
    const stormCaution = environment.condition === 'storm'
      ? environment.intensity * Math.max(0, state.personality.caution - state.personality.curiosity + 25) / 125
      : 0;
    const weatherCuriosity = (environment.condition === 'snow' || environment.condition === 'fog' || environment.condition === 'storm')
      ? environment.novelty * state.personality.curiosity / 100
      : 0;

    // Each state has its own body language. The movement is deliberately
    // small: it should make the creature readable without turning it into a
    // collection of disconnected canned animations.
    let motionX = 0;
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

    if (!isSleeping && dominantNeed === 'energy') {
      motionY += 2.5 * needStrength;
      motionScaleY -= 0.035 * needStrength;
      motionScaleX += 0.025 * needStrength;
    }
    if (!isSleeping && (dominantNeed === 'hunger' || dominantNeed === 'hydration')) {
      motionY += 1.5 * needStrength;
      motionRotation += 0.018 * needStrength;
    }
    if (!isSleeping && (dominantNeed === 'bladder' || dominantNeed === 'bowel')) {
      motionX += Math.sin(time * 0.008) * 2.8 * needStrength;
      motionRotation += Math.sin(time * 0.01) * 0.025 * needStrength;
    }
    if (!isSleeping && coldStrength > 0.08) {
      motionX += Math.sin(time * 0.026) * coldStrength * 1.7;
      motionScaleX += coldStrength * 0.035;
      motionScaleY -= coldStrength * 0.045;
    }
    if (!isSleeping && heatStrength > 0.08) {
      motionY += heatStrength * 1.8;
      motionScaleY -= heatStrength * 0.025;
    }
    if (!isSleeping && environment.wind > 0.22) {
      motionRotation += Math.sin(time * 0.0065) * environment.wind * 0.018;
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

    // Contact shadow stays on the floor even when the body curls or tilts.
    ctx.save();
    ctx.translate(x, y + 36);
    const shadow = ctx.createRadialGradient(0, 0, 3, 0, 0, 44);
    shadow.addColorStop(0, `rgba(0,0,0,${isSleeping ? 0.32 : 0.24})`);
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38 * roundness * (isSleeping ? 1.14 : 1), isSleeping ? 7 : 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x + motionX, y + motionY);
    ctx.scale(state.facing === 'left' ? -1 : 1, 1);
    ctx.rotate(motionRotation);
    ctx.scale(breath * motionScaleX * pathVisual.width, breath * motionScaleY * pathVisual.height);

    // The skin is a consequence of the creature's life, not a wardrobe. Its
    // aura begins faint and becomes readable as a path stabilises.
    if (pathVisual.paths.length > 0) {
      const aura = ctx.createRadialGradient(0, 0, 22, 0, 0, 70);
      aura.addColorStop(0, pathVisual.aura);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.globalAlpha = 0.28 + pathVisual.strength * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const fur = (dL: number, dS = 0, alpha = 1) => {
      const s = Math.max(8, Math.min(62, saturation + dS));
      const l = Math.max(22, Math.min(86, lightness + dL));
      return alpha >= 1 ? `hsl(${hue}, ${s}%, ${l}%)` : `hsla(${hue}, ${s}%, ${l}%, ${alpha})`;
    };
    const ink = fur(-34, 8);
    const tail = app.tailLength;
    const r = roundness;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const outline = () => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    };

    // Layered coat: a soft gradient body over a flat ink base so the mass reads
    // as one sculptural shape, not as strokes.
    const bodyGradient = (cx: number, cy: number, rx: number, ry: number, light: number) => {
      const grad = ctx.createRadialGradient(cx - rx * 0.4, cy - ry * 0.5, rx * 0.12, cx, cy, Math.max(rx, ry) * 1.35);
      grad.addColorStop(0, fur(light));
      grad.addColorStop(0.62, fur(light - 5));
      grad.addColorStop(1, fur(light - 11));
      return grad;
    };

    // A sleeping tail does not wag. One kawaii teardrop, not a string of lumps.
    if (tail > 0) {
      const excited = !isSleeping && (behavior === 'playing' || state.emotionalState === 'happy' || state.emotionalState === 'excited');
      const tailWag = isSleeping
        ? 0
        : Math.sin(time * (excited ? 0.014 : 0.0045)) * (excited ? 0.34 : 0.12)
          + Math.sin(time * 0.007) * environment.wind * 0.07;
      const len = 38 + tail * 22;
      ctx.save();
      ctx.translate(-16 * r, 20);
      if (!isSleeping) ctx.rotate(tailWag - 0.35);
      else ctx.rotate(0.85);
      ctx.beginPath();
      if (isSleeping) {
        ctx.moveTo(4, -4);
        ctx.quadraticCurveTo(-len * 0.35, 16, -4, 22);
        ctx.quadraticCurveTo(len * 0.12, 10, 4, -4);
      } else {
        ctx.moveTo(6, -6);
        ctx.quadraticCurveTo(-len * 0.55, -18, -len * 0.92, 4);
        ctx.quadraticCurveTo(-len * 0.5, 16, 6, 8);
      }
      ctx.closePath();
      ctx.fillStyle = fur(9, 2);
      ctx.fill();
      outline();
      ctx.restore();
    }

    // Chibi: small body, huge head. Layered gradient coat, no hair strokes.
    ctx.beginPath();
    ctx.ellipse(0, 26, 19 * r, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyGradient(0, 26, 19 * r, 15, 2);
    ctx.fill();
    outline();

    // Belly glow — a soft lighter patch, not a texture.
    fillCoat(ctx, fur(16, -6, 0.55), 0, 24, 11 * r, 8, 0);

    // Tiny paws keep them on the floor instead of floating as a blob.
    ctx.beginPath();
    ctx.ellipse(-11, 36, 7.5, 5.2, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = fur(-4);
    ctx.fill();
    outline();
    ctx.beginPath();
    ctx.ellipse(11, 36, 7.5, 5.2, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = fur(-4);
    ctx.fill();
    outline();

    // Cleanliness is body language, not a meter. A few muted floor-coloured
    // flecks appear gradually and disappear completely after washing.
    const dirtStrength = Math.max(0, Math.min(1, (55 - state.needs.hygiene) / 42));
    if (dirtStrength > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(67, 57, 43, ${0.18 + dirtStrength * 0.42})`;
      [
        [-8, 24, 4, 2.4, -0.2],
        [7, 29, 3.4, 2.2, 0.15],
        [0, 32, 3, 2, 0],
      ].slice(0, 1 + Math.ceil(dirtStrength * 3)).forEach(([sx, sy, rx, ry, rotation]) => {
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, rotation, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Round moe ears on the head, not botanical leaves.
    if (app.earShape !== 'none') {
      const pointy = app.earShape === 'pointy';
      const small = app.earShape === 'small';
      const perk = !isSleeping && (behavior === 'observing' || behavior === 'investigating' || behavior === 'hesitating' || behavior === 'proud' || weatherCuriosity > 0.2);
      const drawEar = (side: number) => {
        ctx.save();
        ctx.translate(side * 22, isSleeping ? -26 : -32);
        ctx.rotate(side * (isSleeping ? 0.7 : perk ? 0.08 : 0.18));
        const h = (pointy ? 20 : 16) * (small ? 0.78 : 1) * (perk ? 1.08 : 1);
        const w = (pointy ? 11 : 13) * (small ? 0.82 : 1);
        ctx.beginPath();
        if (pointy) {
          ctx.moveTo(0, 8);
          ctx.quadraticCurveTo(-w * side, 0, 0, -h);
          ctx.quadraticCurveTo(w * 0.7 * side, -2, 0, 8);
        } else {
          ctx.ellipse(0, -h * 0.28, w, h * 0.72, 0, 0, Math.PI * 2);
        }
        ctx.fillStyle = fur(6);
        ctx.fill();
        outline();
        ctx.fillStyle = 'hsla(350, 55%, 72%, 0.55)';
        ctx.beginPath();
        ctx.ellipse(side * 1.5, -h * 0.22, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawEar(-1);
      drawEar(1);
    }

    // Kawaii head: big circle, cel highlight, no muzzle mass.
    ctx.beginPath();
    ctx.ellipse(0, -8, 31, 29, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyGradient(0, -8, 31, 29, 10);
    ctx.fill();
    outline();

    // Soft sheen on the crown.
    fillCoat(ctx, 'rgba(255,255,255,0.24)', -11, -18, 12, 8, -0.5);

    const attentive = behavior === 'observing' || behavior === 'investigating' || behavior === 'hesitating' || behavior === 'imitating' || behavior === 'proud' || behavior === 'uncomfortable';
    const weatherEyeScale = 1 + weatherCuriosity * 0.06 + stormCaution * 0.04;
    const pathEyeHeight = 1 - pathVisual.eyeDroop * pathVisual.strength * 0.45;
    const tiredEyeScale = state.sleepState === 'drowsy' || dominantNeed === 'energy' ? Math.max(0.55, 1 - needStrength * 0.35) : 1;
    const eyeW = 13.5 * eyeSize * (attentive ? 1.06 : 1) * weatherEyeScale;
    const openEyeHeight = 16.5 * eyeSize * pathEyeHeight * tiredEyeScale * (attentive ? 1.08 : behavior === 'eating' ? 0.78 : 1);
    const eyeH = blink.isBlinking && !isSleeping ? 1.4 : openEyeHeight;
    const eyeY = -9;
    if (isSleeping) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-20, -8);
      ctx.quadraticCurveTo(-12, -6, -5, -8);
      ctx.moveTo(5, -8);
      ctx.quadraticCurveTo(12, -6, 20, -8);
      ctx.stroke();
    } else {
      const drawEye = (ex: number) => {
        // Glossy base
        ctx.fillStyle = '#fffaf1';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, Math.max(2.6, eyeH), 0, 0, Math.PI * 2);
        ctx.fill();
        outline();
        // Iris
        ctx.fillStyle = `hsl(${(hue + 12) % 360}, ${Math.min(58, saturation + 22)}%, ${Math.max(28, lightness - 18)}%)`;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY + 1.4, eyeW * 0.72, eyeH * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#1a1410';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY + 2.2, eyeW * 0.34, eyeH * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!blink.isBlinking) {
          // Gloss highlight
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.ellipse(ex - eyeW * 0.28, eyeY - eyeH * 0.32, 4.6, 5.4, -0.25, 0, Math.PI * 2);
          ctx.fill();
          // Micro reflection
          ctx.beginPath();
          ctx.arc(ex + eyeW * 0.22, eyeY + eyeH * 0.18, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      drawEye(-14);
      drawEye(14);
    }

    // Blush — a soft plum flush that reads in the dark room.
    fillCoat(ctx, 'hsla(352, 70%, 72%, 0.42)', -22, 8, 8, 4.5, -0.15);
    fillCoat(ctx, 'hsla(352, 70%, 72%, 0.42)', 22, 8, 8, 4.5, 0.15);

    if (!isSleeping && (state.emotionalState === 'skeptical' || state.emotionalState === 'wary')) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-24, -24);
      ctx.lineTo(-8, -20);
      ctx.moveTo(8, -20);
      ctx.lineTo(24, -24);
      ctx.stroke();
    } else if (!isSleeping && state.emotionalState === 'concerned') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-24, -19);
      ctx.lineTo(-8, -23);
      ctx.moveTo(8, -23);
      ctx.lineTo(24, -19);
      ctx.stroke();
    }

    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.ellipse(0, 5, 2.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    if (isSleeping) {
      ctx.moveTo(-3, 11);
      ctx.quadraticCurveTo(0, 13, 3, 11);
    } else if (heatStrength > 0.42) {
      ctx.ellipse(0, 12, 3.2, 2.4 + Math.abs(Math.sin(time * 0.008)), 0, 0, Math.PI * 2);
    } else if (state.emotionalState === 'happy' || state.emotionalState === 'excited') {
      ctx.arc(0, 9, 4.5, 0.15, Math.PI - 0.15);
    } else if (state.emotionalState === 'sad' || state.emotionalState === 'concerned') {
      ctx.arc(0, 16, 4.2, Math.PI + 0.2, -0.2);
    } else {
      ctx.moveTo(-3.5, 11);
      ctx.lineTo(0, 13.5);
      ctx.lineTo(3.5, 11);
    }
    ctx.stroke();

    if (!isSleeping && dominantNeed === 'hydration' && needStrength >= 0.65) {
      ctx.fillStyle = 'rgba(164, 102, 104, 0.75)';
      ctx.beginPath();
      ctx.ellipse(1, 7, 2.2, 3.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

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
      ctx.globalAlpha = isSleeping ? 0.18 + pathVisual.strength * 0.22 : 0.28 + pathVisual.strength * 0.72;
      [[-31, -2], [31, -1], [-27, 20], [27, 24]].forEach(([sx, sy], index) => {
        const twinkle = isSleeping ? 2.1 : 2.2 + ((Math.sin(time * 0.006 + index) + 1) * 1.2);
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.28 + pathVisual.strength * 0.72;
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
  }, [environmentalStimulus, state]);

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
