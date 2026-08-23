import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { SupportedUiLanguage, uiText } from '../systems/uiLanguage';

interface PwaUpdateNoticeProps {
  language: SupportedUiLanguage;
}

const PwaUpdateNotice: React.FC<PwaUpdateNoticeProps> = ({ language }) => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: error => console.warn('PWA update check failed.', error),
  });

  if (!needRefresh) return null;
  const t = (english: string, polish: string) => uiText(language, english, polish);

  return (
    <div className="fixed left-4 right-4 bottom-4 z-[100] safe-bottom pointer-events-none animate-slide-up" role="status" aria-live="polite">
      <div className="max-w-md mx-auto rounded-2xl border border-warm-300/25 bg-room-dark/96 backdrop-blur-xl p-4 shadow-2xl pointer-events-auto">
        <p className="text-warm-100 text-sm font-serif">{t('A new version is ready.', 'Nowa wersja jest gotowa.')}</p>
        <p className="text-warm-200/45 text-[10px] font-serif mt-1">{t('Your creature and memories will stay exactly where they are.', 'Stworek i wspomnienia zostaną dokładnie na swoim miejscu.')}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => setNeedRefresh(false)} className="min-h-11 rounded-xl border border-warm-200/10 px-3 py-2 text-warm-200/55 text-xs font-serif">
            {t('Later', 'Później')}
          </button>
          <button onClick={() => void updateServiceWorker(true)} className="min-h-11 rounded-xl border border-warm-300/25 bg-warm-300/15 px-3 py-2 text-warm-100 text-xs font-serif">
            {t('Update now', 'Aktualizuj')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdateNotice;
