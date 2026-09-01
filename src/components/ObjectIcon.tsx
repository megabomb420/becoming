import React from 'react';
import { ObjectType } from '../types';

interface ObjectIconProps {
  type: ObjectType;
  size?: number;
  status?: unknown;
  className?: string;
}

const ink = '#2b2824';
const highlight = '#f1e5d1';

const ObjectIcon: React.FC<ObjectIconProps> = ({ type, size = 48, status, className = '' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    className,
  } as const;

  if (type === 'food_bowl') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="fb-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="fb-mat" cx=".42" cy=".28" r=".9"><stop offset="0" stopColor="#b97a62" /><stop offset=".62" stopColor="#b97a62" /><stop offset="1" stopColor="#966552" /></radialGradient>
          <radialGradient id="fb-rim" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#d8a087" /><stop offset=".7" stopColor="#d8a087" /><stop offset="1" stopColor="#b98a6e" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="46" rx="23" ry="6" fill="url(#fb-sh)" />
        <path d="M10 25h44l-5 20c-1 5-6 8-11 8H26c-5 0-10-3-11-8l-5-20Z" fill="url(#fb-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="25" rx="22" ry="7" fill="url(#fb-rim)" stroke={ink} strokeWidth="3" />
        <ellipse cx="32" cy="26" rx="16" ry="3.5" fill="#47372e" />
      </svg>
    );
  }

  if (type === 'water_bowl') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="wb-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="wb-mat" cx=".42" cy=".28" r=".9"><stop offset="0" stopColor="#708792" /><stop offset=".62" stopColor="#708792" /><stop offset="1" stopColor="#5e7077" /></radialGradient>
          <radialGradient id="wb-rim" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#a6c4c9" /><stop offset=".7" stopColor="#a6c4c9" /><stop offset="1" stopColor="#88a7ad" /></radialGradient>
          <radialGradient id="wb-drop" cx=".5" cy=".45" r=".8"><stop offset="0" stopColor="#8ec1cf" /><stop offset=".7" stopColor="#8ec1cf" /><stop offset="1" stopColor="#6ba0b1" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="49" rx="23" ry="6" fill="url(#wb-sh)" />
        <path d="M10 27h44l-5 18c-1 5-6 8-11 8H26c-5 0-10-3-11-8l-5-18Z" fill="url(#wb-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="27" rx="22" ry="7" fill="url(#wb-rim)" stroke={ink} strokeWidth="3" />
        <path d="M17 27c7 3 23 3 30 0" stroke="#d9eef0" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
        <path d="M32 11c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" fill="url(#wb-drop)" stroke={ink} strokeWidth="2.5" />
      </svg>
    );
  }

  if (type === 'litter_box') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="lb-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="lb-mat" cx=".42" cy=".26" r=".95"><stop offset="0" stopColor="#8b7666" /><stop offset=".6" stopColor="#8b7666" /><stop offset="1" stopColor="#736255" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="25" ry="5" fill="url(#lb-sh)" />
        <path d="M8 24h48l-4 27H12L8 24Z" fill="url(#lb-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="25" rx="23" ry="7" fill="#c7b18e" stroke={ink} strokeWidth="3" />
        <path d="M16 26c8-4 25-4 33 0-9 4-24 4-33 0Z" fill="#8c7358" opacity=".75" />
        <path d="m22 22 3 3m14-4 3 3m-11-2 2 3" stroke="#ead7b5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'wash_basin') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="ws-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="ws-mat" cx=".42" cy=".28" r=".9"><stop offset="0" stopColor="#a99582" /><stop offset=".6" stopColor="#a99582" /><stop offset="1" stopColor="#897a69" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="53" rx="23" ry="5" fill="url(#ws-sh)" />
        <path d="M10 29h44l-5 17c-2 5-6 7-11 7H26c-5 0-9-2-11-7l-5-17Z" fill="url(#ws-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="29" rx="22" ry="7" fill="#cbbca7" stroke={ink} strokeWidth="3" />
        <ellipse cx="32" cy="29" rx="15" ry="3.5" fill="#7e9ea6" />
        <circle cx="20" cy="16" r="5" fill="#dce9e7" stroke={ink} strokeWidth="2" />
        <circle cx="32" cy="11" r="4" fill="#dce9e7" stroke={ink} strokeWidth="2" />
        <circle cx="42" cy="18" r="3" fill="#dce9e7" stroke={ink} strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'apple') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="ap-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".4" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="ap-mat" cx=".4" cy=".32" r=".9"><stop offset="0" stopColor="#b85e55" /><stop offset=".6" stopColor="#b85e55" /><stop offset="1" stopColor="#955047" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="52" rx="20" ry="5" fill="url(#ap-sh)" />
        <path d="M32 21c-5-7-15-5-19 2-6 11 2 29 15 31 2 .3 3-1 4-1s2 1 4 1c13-2 21-20 15-31-4-7-14-9-19-2Z" fill="url(#ap-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 21c-1-6 1-10 5-13" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <path d="M36 12c5-4 11-3 14 1-4 4-10 5-14-1Z" fill="#788a61" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M21 27c-2 4-2 8-1 11" stroke={highlight} strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </svg>
    );
  }

  if (type === 'broccoli') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="br-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".4" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="br-stalk" cx=".5" cy=".35" r=".8"><stop offset="0" stopColor="#9a9b68" /><stop offset=".65" stopColor="#9a9b68" /><stop offset="1" stopColor="#7e7e57" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="20" ry="4" fill="url(#br-sh)" />
        <path d="m28 29-5 25h18l-5-25h-8Z" fill="url(#br-stalk)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M31 35 21 27m13 8 9-9" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="24" r="10" fill="#718061" stroke={ink} strokeWidth="3" />
        <circle cx="32" cy="18" r="12" fill="#7f906c" stroke={ink} strokeWidth="3" />
        <circle cx="44" cy="24" r="10" fill="#68785b" stroke={ink} strokeWidth="3" />
        <circle cx="31" cy="29" r="10" fill="#80906c" stroke={ink} strokeWidth="3" />
      </svg>
    );
  }

  if (type === 'ball') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="ba-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".4" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="ba-mat" cx=".4" cy=".34" r=".9"><stop offset="0" stopColor="#d8cbb4" /><stop offset=".62" stopColor="#d8cbb4" /><stop offset="1" stopColor="#aca290" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="20" ry="4" fill="url(#ba-sh)" />
        <circle cx="32" cy="31" r="22" fill="url(#ba-mat)" stroke={ink} strokeWidth="3" />
        <path d="m32 18 8 6-3 10H27l-3-10 8-6Zm-8 6-10-1m13 11-6 9m16-9 6 9m-2-19 10-1M21 43l-2 8m24-8 2 8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M15 24c2-5 6-9 11-12m23 12c-2-5-6-9-11-12" stroke="#8f8372" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'blanket') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="bl-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".4" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="bl-mat" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#7f788a" /><stop offset=".6" stopColor="#7f788a" /><stop offset="1" stopColor="#69646f" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="53" rx="23" ry="4" fill="url(#bl-sh)" />
        <path d="M10 20c8-5 36-5 44 0v29c-10 5-34 5-44 0V20Z" fill="url(#bl-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M10 27c11 4 33 4 44 0M18 17v35m28-35v35" stroke="#b7aabd" strokeWidth="2" opacity=".75" />
        <path d="M15 51v5m6-4v5m22-5v5m6-6v5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'paper') {
    const paperStatus = typeof status === 'string' ? status : '';
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="pp-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".38" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="pp-mat" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#e3d8c3" /><stop offset=".6" stopColor="#e3d8c3" /><stop offset="1" stopColor="#b5ac9b" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="21" ry="4" fill="url(#pp-sh)" />
        <path d="M15 9h27l8 8v35H15V9Z" fill="url(#pp-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M42 9v9h8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        {paperStatus === 'written' ? (
          <path d="M24 29c0-5 7-6 8-1 1-5 8-4 8 1 0 6-8 10-8 10s-8-4-8-10Z" fill="#b85e55" stroke={ink} strokeWidth="2" />
        ) : paperStatus === 'drawn' ? (
          <><path d="m21 43 8-10 5 5 4-6 7 11H21Z" fill="#7d8f78" stroke={ink} strokeWidth="2" /><circle cx="25" cy="24" r="3" fill="#c39a61" /></>
        ) : (
          <><path d="M22 25h20M22 32h16M22 39h20" stroke="#8f8372" strokeWidth="2.5" strokeLinecap="round" /><path d="m22 46 6-2 5 2 8-3" stroke="#b85e55" strokeWidth="2" strokeLinecap="round" /></>
        )}
      </svg>
    );
  }

  if (type === 'pencil') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="pc-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".38" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="pc-mat" cx=".5" cy=".32" r=".9"><stop offset="0" stopColor="#c69b60" /><stop offset=".6" stopColor="#c69b60" /><stop offset="1" stopColor="#9f7e51" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="52" rx="22" ry="4" fill="url(#pc-sh)" />
        <g transform="rotate(-38 32 32)">
          <path d="M26 7h12v40H26V7Z" fill="url(#pc-mat)" stroke={ink} strokeWidth="3" />
          <path d="m26 47 6 11 6-11H26Z" fill="#dfc9a6" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="m30 54 2 4 2-4h-4Z" fill={ink} />
          <path d="M26 8c0-3 3-5 6-5s6 2 6 5v5H26V8Z" fill="#a96f67" stroke={ink} strokeWidth="3" />
          <path d="M31 14v31" stroke="#f0c984" strokeWidth="2" opacity=".7" />
        </g>
      </svg>
    );
  }

  if (type === 'box') {
    const opened = status === 'opened';
    const occupied = status === 'hiding' || status === 'den';
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="bx-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="bx-mat" cx=".5" cy=".3" r=".9"><stop offset="0" stopColor="#a67e57" /><stop offset=".6" stopColor="#a67e57" /><stop offset="1" stopColor="#87684a" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="54" rx="24" ry="5" fill="url(#bx-sh)" />
        <path d="M12 24h40v29H12V24Z" fill="url(#bx-mat)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="m12 24 11-9h18l11 9-20 8-20-8Z" fill="#c29a6b" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        {opened ? (
          <><path d="m12 24-8-8 18-6 10 7-20 7Zm40 0 8-8-18-6-10 7 20 7Z" fill="#bd9366" stroke={ink} strokeWidth="3" strokeLinejoin="round" /><path d="M23 31h18" stroke="#66503d" strokeWidth="2.5" /></>
        ) : (
          <><path d="M32 32v21M23 15l9 17 9-17" stroke="#755a42" strokeWidth="2.5" /><path d="M27 38h10" stroke="#dfbb80" strokeWidth="2.5" /></>
        )}
        {occupied && <path d="M44 48c6 1 10 4 11 8" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
      </svg>
    );
  }

  if (type === 'stone') {
    const kept = status === 'treasured' || status === 'keepsake';
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="st-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
          <radialGradient id="st-mat" cx=".4" cy=".32" r=".9"><stop offset="0" stopColor="#77766f" /><stop offset=".6" stopColor="#77766f" /><stop offset="1" stopColor="#64625b" /></radialGradient>
          <radialGradient id="st-kept" cx=".4" cy=".32" r=".9"><stop offset="0" stopColor="#8a7a68" /><stop offset=".6" stopColor="#8a7a68" /><stop offset="1" stopColor="#726556" /></radialGradient>
        </defs>
        <ellipse cx="32" cy="52" rx="23" ry="5" fill="url(#st-sh)" />
        <path d="M9 45 17 23l13-10 18 8 8 24-10 8H20L9 45Z" fill={kept ? 'url(#st-kept)' : 'url(#st-mat)'} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="m17 23 14 8 17-10M31 31l-3 22" stroke="#9b9990" strokeWidth="2.5" opacity=".8" />
        <path d="m42 33 6 4" stroke="#5a5954" strokeWidth="2.5" strokeLinecap="round" />
        {kept && <path d="M24 38c3-4 8-5 12-2" stroke="#e4c9a1" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    );
  }

  return (
    <svg {...common}>
      <defs>
        <radialGradient id="df-sh" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#171614" stopOpacity=".42" /><stop offset="1" stopColor="#171614" stopOpacity="0" /></radialGradient>
        <radialGradient id="df-mat" cx=".4" cy=".32" r=".9"><stop offset="0" stopColor="#8d7366" /><stop offset=".6" stopColor="#8d7366" /><stop offset="1" stopColor="#746055" /></radialGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="19" ry="4" fill="url(#df-sh)" />
      <path d="M29 46h6v9h-6v-9Zm-9 9h24" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 7c-12 0-20 9-20 21s8 21 20 21 20-9 20-21S44 7 32 7Z" fill="url(#df-mat)" stroke={ink} strokeWidth="3" />
      <ellipse cx="32" cy="28" rx="15" ry="17" fill="#c5c2b7" stroke="#e8dfcf" strokeWidth="2" />
      <path d="M22 21c4-6 13-9 20-3" stroke="#f5eee1" strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
    </svg>
  );
};

export default ObjectIcon;
