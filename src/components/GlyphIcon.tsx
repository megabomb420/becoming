import React from 'react';

export type GlyphIconName =
  | 'chat'
  | 'moon'
  | 'sun'
  | 'memory'
  | 'settings'
  | 'shelf'
  | 'close'
  | 'send'
  | 'becoming'
  | 'dream'
  | 'trace'
  | 'care'
  | 'food'
  | 'toilet'
  | 'wash'
  | 'clean';

interface GlyphIconProps {
  name: GlyphIconName;
  size?: number;
  className?: string;
}

const GlyphIcon: React.FC<GlyphIconProps> = ({ name, size = 22, className }) => {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.65,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {name === 'chat' && <g {...common}><path d="M5.3 5.7c3.5-2.6 9.9-2 12.5 1.2 2.8 3.5.8 8-3.4 9.4-2.1.7-4.2.3-5.4-.2l-3.2 2.1.7-3.8C3.9 12 3.2 7.3 5.3 5.7Z" /><path d="M8.3 10.8c1.8-1.4 5.5-1.4 7.4.1" /></g>}
      {name === 'moon' && <path {...common} d="M17.9 15.7A7.2 7.2 0 0 1 8.3 6.1a7.8 7.8 0 1 0 9.6 9.6Z" />}
      {name === 'sun' && <g {...common}><circle cx="12" cy="12" r="3.5" /><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" /></g>}
      {name === 'memory' && <g {...common}><path d="M5.2 4.2c2.5-.8 5.1-.4 6.8 1.2 1.7-1.6 4.3-2 6.8-1.2v14c-2.5-.8-5.1-.4-6.8 1.2-1.7-1.6-4.3-2-6.8-1.2Z" /><path d="M12 5.4v14" /><path d="M7.4 8.1c1-.2 1.8-.1 2.6.2M14.2 8.2c.8-.2 1.6-.2 2.5 0M7.4 11.2c1-.2 1.8-.1 2.6.2" /></g>}
      {name === 'settings' && <g {...common}><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="1.5" fill="var(--ink-deep, #171913)" /><circle cx="15" cy="12" r="1.5" fill="var(--ink-deep, #171913)" /><circle cx="11" cy="17" r="1.5" fill="var(--ink-deep, #171913)" /></g>}
      {name === 'shelf' && <g {...common}><path d="M4 18.5h16M5.5 17V7.3l6.5-3 6.5 3V17" /><path d="M8 10.2c2.6 1.1 5.4 1.1 8 0M8 14c2.6 1.1 5.4 1.1 8 0" /></g>}
      {name === 'close' && <g {...common}><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></g>}
      {name === 'send' && <g {...common}><path d="m4 11.8 15-7-4.7 15-2.6-6.1Z" /><path d="m11.7 13.7 3.8-4.1" /></g>}
      {name === 'becoming' && <g {...common}><path d="M12 20c-4.4-2.2-6.5-5.4-5.6-9.1.6-2.7 2.7-5.1 5.6-6.9 2.9 1.8 5 4.2 5.6 6.9.9 3.7-1.2 6.9-5.6 9.1Z" /><path d="M12 19V7.2M12 12.2 9.2 9.5M12 15.1l3.1-3" /></g>}
      {name === 'dream' && <g {...common}><path d="M6 15.8c1.6-1.3 3.3-1.7 5-.9 2.2 1 4.4.5 6.6-1.4" /><path d="M7.1 10.1c1.1-2.5 3-4 5.8-4.5 1.8 2.3 2.3 4.7 1.5 7.2" /><circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="18.2" cy="8.3" r=".7" fill="currentColor" stroke="none" /></g>}
      {name === 'trace' && <g {...common}><path d="M6.2 17.8c2-4.7 5-8.6 9.1-11.6" /><path d="M8.2 13.3c-2.8-.5-4.4-1.9-4.8-4.3 2.6-.2 4.6.8 6 3M12.6 9c.1-3 1.2-5 3.4-6.2 1 2.4.5 4.6-1.4 6.5M10.1 14.3c2.9.2 4.8 1.5 5.7 3.8-2.4.8-4.6.1-6.5-2" /></g>}
      {name === 'care' && <g {...common}><path d="M6.2 13.2c2.8-1.9 8.8-1.9 11.6 0l-1.1 4.2c-.4 1.5-1.8 2.5-3.3 2.5h-2.8c-1.5 0-2.9-1-3.3-2.5l-1.1-4.2Z" /><path d="M7 13.1c2.3 1.4 7.7 1.4 10 0M12 4.1c-2 2.1-2 4.2 0 6.2 2-2 2-4.1 0-6.2Z" /></g>}
      {name === 'food' && <g {...common}><path d="M5 11.8h14l-1.4 5.6c-.4 1.5-1.7 2.5-3.2 2.5H9.6c-1.5 0-2.8-1-3.2-2.5L5 11.8Z" /><path d="M5.4 11.8c3.4 1.7 9.8 1.7 13.2 0M9 7.8c1.1-1 2.1-.9 3 .2 1-1.8 2.4-2.3 4-1.4" /></g>}
      {name === 'toilet' && <g {...common}><path d="M7 4.5h9v6.2H7zM6.1 11h11.8v2.2c0 3.8-2.3 6.3-5.9 6.3s-5.9-2.5-5.9-6.3V11Z" /><path d="M16 6.3h2.2M9 15.1c1.8.8 4.2.8 6 0" /></g>}
      {name === 'wash' && <g {...common}><path d="M12 3.6c3.1 4.1 5.2 6.9 5.2 10.1a5.2 5.2 0 0 1-10.4 0c0-3.2 2.1-6 5.2-10.1Z" /><path d="M9.4 14.1c.2 1.2 1 2 2.2 2.3" /></g>}
      {name === 'clean' && <g {...common}><path d="m14.8 4.2-4.1 10.5M11.8 5.5l5 1.9M6 13.8l8.4 3.2-2 3.2-8.4-3.3 2-3.1Z" /><path d="M16.9 12.5v2.2M15.8 13.6H18M19.1 8.3v1.8M18.2 9.2H20" /></g>}
    </svg>
  );
};

export default GlyphIcon;
