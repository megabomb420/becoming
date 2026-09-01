import React, { useMemo } from 'react';
import { WorldEnvironment } from '../types';
import { getEffectiveStimulus } from '../systems/environmentSystem';
import { RoomLighting, TimeOfDay } from '../systems/timeSystem';

interface WeatherLayerProps {
  world: WorldEnvironment;
  lighting: RoomLighting;
  time: TimeOfDay;
  seed: number;
  now: number;
  expanded?: boolean;
}

function seededValues(seed: number, count: number) {
  let value = Math.abs(Math.floor(seed)) || 1;
  return Array.from({ length: count }, (_, index) => {
    value = (value * 16807) % 2147483647;
    const first = value / 2147483647;
    value = (value * 16807) % 2147483647;
    const second = value / 2147483647;
    return { index, first, second };
  });
}

const WeatherLayer: React.FC<WeatherLayerProps> = ({ world, lighting, time, seed, now, expanded = false }) => {
  const stimulus = getEffectiveStimulus(world, now);
  const rainDrops = useMemo(() => seededValues(seed + 311, 18), [seed]);
  const snowflakes = useMemo(() => seededValues(seed + 719, 20), [seed]);
  const precipitating = stimulus.condition === 'rain' || stimulus.condition === 'drizzle' || stimulus.condition === 'storm';
  const snowing = stimulus.condition === 'snow';
  const windStrength = Math.max(0.18, stimulus.wind);
  const style = {
    '--weather-wind': `${(1.45 - windStrength * 0.72).toFixed(2)}s`,
  } as React.CSSProperties;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* A real window gives weather a place in the room. It remains behind
          the creature and controls, so weather is experienced rather than
          promoted into a dashboard. */}
      <div className={`window-habitat absolute left-1/2 -translate-x-1/2 transition-all duration-700 ${
        expanded
          ? 'top-[6%] h-[58%] w-[min(92vw,24rem)] rounded-[1.6rem]'
          : 'top-[17%] h-[22%] w-[clamp(8rem,42vw,11.5rem)] rounded-[1.15rem]'
      }`}>
        <div className="window-frame" aria-hidden="true" />
        <div className="window-glass relative h-full overflow-hidden rounded-[inherit] bg-[#14171c]">
          <div className="absolute inset-0 transition-colors duration-[30000ms]" style={{ background: `linear-gradient(180deg, ${lighting.skyTop}, ${lighting.skyBottom})` }} />
          <div className="absolute inset-0 rounded-[inherit]" style={{ background: `radial-gradient(ellipse at 50% 122%, ${lighting.ambientGlow}, transparent 62%)`, opacity: expanded ? 0.14 : 0.3, transition: 'background 30s linear' }} />
          <div
            className="absolute inset-0 transition-opacity duration-[30000ms]"
            style={{
              opacity: lighting.starOpacity,
              backgroundImage: 'radial-gradient(circle at 22% 28%, rgba(247,239,218,.85) 0 1px, transparent 1.4px), radial-gradient(circle at 72% 18%, rgba(225,235,244,.75) 0 1px, transparent 1.4px), radial-gradient(circle at 84% 56%, rgba(247,239,218,.65) 0 1px, transparent 1.4px)',
              backgroundSize: '48px 44px, 68px 59px, 82px 71px',
            }}
          />
          {(time.phase === 'night' || time.phase === 'dusk') && (
            <div
              className="window-disc absolute rounded-full bg-[#f4efe0]"
              style={{
                width: expanded ? 18 : 13,
                height: expanded ? 18 : 13,
                right: '18%',
                top: '14%',
                opacity: 0.28 + lighting.starOpacity * 0.62,
                boxShadow: '0 0 16px rgba(244,239,224,.42)',
              }}
            />
          )}
          {(time.phase === 'day' || time.phase === 'dawn' || time.phase === 'golden_hour') && (
            <div
              className="window-disc absolute rounded-full"
              style={{
                width: time.phase === 'day' ? (expanded ? 26 : 18) : (expanded ? 18 : 13),
                height: time.phase === 'day' ? (expanded ? 26 : 18) : (expanded ? 18 : 13),
                left: time.phase === 'dawn' ? '24%' : '46%',
                top: time.phase === 'dawn' ? '62%' : time.phase === 'golden_hour' ? '30%' : '16%',
                background: time.phase === 'golden_hour' ? '#e39a62' : '#f0e2b8',
                opacity: 0.52,
                boxShadow: time.phase === 'golden_hour' ? '0 0 28px rgba(227,154,98,.5)' : '0 0 22px rgba(240,226,184,.38)',
              }}
            />
          )}
          <div className="weather-cloud absolute -left-[25%] top-[15%] h-8 w-[75%] rounded-full bg-[#d8d8d2]/45 blur-[8px]" style={{ opacity: lighting.cloudOpacity * 0.72, animationDuration: `${18 - stimulus.wind * 8}s` }} />
          <div className="weather-cloud absolute left-[38%] top-[32%] h-10 w-[88%] rounded-full bg-[#bfc4c4]/42 blur-[10px]" style={{ opacity: lighting.cloudOpacity, animationDuration: `${23 - stimulus.wind * 10}s`, animationDelay: '-9s' }} />
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[#252c2d]/45 to-transparent" />

          {precipitating && rainDrops.map(drop => (
            <span
              key={drop.index}
              className="weather-rain absolute -top-5 h-10 w-px origin-top rotate-[10deg] bg-gradient-to-b from-transparent via-[#d8e1e5]/70 to-transparent"
              style={{
                left: `${drop.first * 112 - 6}%`,
                opacity: 0.24 + stimulus.precipitation * 0.62,
                animationDuration: `${0.72 + drop.second * 0.55 - stimulus.wind * 0.18}s`,
                animationDelay: `${-drop.first * 1.7}s`,
              }}
            />
          ))}

          {snowing && snowflakes.map(flake => (
            <span
              key={flake.index}
              className="weather-snow absolute -top-3 rounded-full bg-[#f1efe8]/80 shadow-[0_0_3px_rgba(255,255,255,.35)]"
              style={{
                left: `${flake.first * 104 - 2}%`,
                width: `${1.5 + flake.second * 2.5}px`,
                height: `${1.5 + flake.second * 2.5}px`,
                opacity: 0.42 + stimulus.intensity * 0.46,
                animationDuration: `${4.2 + dropSafe(flake.first) * 4}s`,
                animationDelay: `${-flake.second * 6}s`,
              }}
            />
          ))}

          {stimulus.condition === 'fog' && <div className="weather-fog absolute -inset-x-1/2 inset-y-0 bg-[linear-gradient(90deg,transparent,rgba(225,224,215,.52),transparent)] blur-[6px]" style={{ opacity: lighting.fogOpacity + 0.22 }} />}
          {stimulus.condition === 'storm' && <div className="weather-lightning absolute inset-0 bg-[#e8eef3] mix-blend-screen" style={{ opacity: 0 }} />}
          <div className="window-sheen pointer-events-none" aria-hidden="true" />

          {!expanded && (
            <>
              <div className="absolute inset-y-0 left-1/2 w-px bg-[#171714]/55" />
              <div className="absolute inset-x-0 top-1/2 h-px bg-[#171714]/45" />
              <div className="absolute inset-0 rounded-[1.05rem] shadow-[inset_0_0_0_4px_rgba(29,26,22,.42)]" />
            </>
          )}
        </div>
        {!expanded && <div className="window-sill" aria-hidden="true" />}
      </div>

      {!expanded && (
        <>
          <div className="weather-curtain weather-curtain--left" style={{ ...style, opacity: 0.22 + stimulus.wind * 0.38 }} />
          <div className="weather-curtain weather-curtain--right" style={{ ...style, animationDelay: '-.6s', opacity: 0.22 + stimulus.wind * 0.38 }} />
        </>
      )}

      {stimulus.condition === 'fog' && <div className="absolute inset-0 bg-[#c5c6bf] transition-opacity duration-[30000ms]" style={{ opacity: lighting.fogOpacity * 0.16 }} />}
      {stimulus.thermal === 'hot' && <div className="weather-heat absolute inset-x-0 bottom-[14%] h-[34%] bg-[repeating-linear-gradient(90deg,transparent_0_18px,rgba(225,189,139,.035)_19px_21px)]" style={{ opacity: Math.abs(stimulus.temperatureStress) * 0.7 }} />}
      {stimulus.wind > 0.38 && <div className="weather-wind-line absolute left-[-25%] top-[57%] h-px w-[30%] bg-gradient-to-r from-transparent via-warm-200/15 to-transparent" style={{ animationDuration: `${2.8 - stimulus.wind * 1.2}s` }} />}
      {time.phase === 'golden_hour' && <div className="absolute left-1/2 top-[28%] h-[42%] w-[70%] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(229,159,98,.09),transparent_67%)]" />}
    </div>
  );
};

function dropSafe(value: number) {
  return Math.max(0.08, Math.min(0.96, value));
}

export default WeatherLayer;
