import React, { useRef, useEffect, useCallback } from 'react';
import { GameState } from '../types';

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
  const posRef = useRef({ x: state.position.x, y: state.position.y });
  const targetPosRef = useRef({ x: state.position.x, y: state.position.y });
  const blinkStateRef = useRef({ isBlinking: false, blinkTimer: 0, nextBlink: 2000 + Math.random() * 3000 });
  const holdTimerRef = useRef<number>(0);
  const isHoldingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth position interpolation
  useEffect(() => {
    targetPosRef.current = { ...state.position };
  }, [state.position]);

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
    const breath = Math.sin(time * 0.003) * 0.02 + 1;
    const { eyeSize, roundness } = app;
    const hue = app.baseHue;
    
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
    ctx.translate(x, y);
    ctx.scale(state.facing === 'left' ? -1 : 1, 1);
    ctx.scale(breath, breath);

    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 38, 35 * roundness, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    if (app.tailLength > 0) {
      const tailWag = Math.sin(time * 0.005) * 0.3;
      ctx.save();
      ctx.rotate(tailWag - 0.2);
      ctx.fillStyle = `hsl(${hue}, 25%, 55%)`;
      ctx.beginPath();
      ctx.ellipse(-35 * roundness, 10, 18 * app.tailLength, 8, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Main body
    const bodyGrad = ctx.createRadialGradient(-10, -15, 5, 0, 5, 45);
    bodyGrad.addColorStop(0, `hsl(${hue}, 20%, 65%)`);
    bodyGrad.addColorStop(1, `hsl(${hue}, 25%, 45%)`);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 5, 38 * roundness, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    if (app.earShape !== 'none') {
      ctx.fillStyle = `hsl(${hue}, 25%, 48%)`;
      const earW = app.earShape === 'pointy' ? 12 : 16;
      const earH = app.earShape === 'pointy' ? 22 : 18;
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
    ctx.fillStyle = `hsl(${hue}, 18%, 68%)`;
    ctx.beginPath();
    ctx.ellipse(0, -8, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeW = 10 * eyeSize;
    const eyeH = blink.isBlinking ? 1 : 10 * eyeSize;
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
    if (state.emotionalState === 'happy') {
      ctx.arc(0, 4, 6, 0.1, Math.PI - 0.1);
    } else if (state.emotionalState === 'sad') {
      ctx.arc(0, 10, 6, Math.PI + 0.1, -0.1);
    } else {
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(0, 6, 4, 4);
    }
    ctx.stroke();

    ctx.restore();
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

      // Smooth position
      posRef.current.x += (targetPosRef.current.x - posRef.current.x) * 0.05;
      posRef.current.y += (targetPosRef.current.y - posRef.current.y) * 0.05;

      const px = (posRef.current.x / 100) * rect.width;
      const py = (posRef.current.y / 100) * rect.height;

      ctx.clearRect(0, 0, rect.width, rect.height);

      if (state.development.stage === 'egg') {
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
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [state.development.stage, renderEgg, renderCreature]);

  // Touch handlers
  const clearHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isHoldingRef.current = true;
    hasMovedRef.current = false;
    holdTimerRef.current = 0;
    strokeStartRef.current = { x, y };
    
    holdIntervalRef.current = setInterval(() => {
      holdTimerRef.current += 100;
      if (holdTimerRef.current >= 600 && isHoldingRef.current) {
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
      
      if (dist > 20 && !hasMovedRef.current) {
        onStroke();
      } else if (holdTimerRef.current < 600 && dist <= 30) {
        onTap();
      }
    }
    
    isHoldingRef.current = false;
    strokeStartRef.current = null;
    hasMovedRef.current = false;
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
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-pointer"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    />
  );
};

export default CreatureCanvas;
