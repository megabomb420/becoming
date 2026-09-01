import React from 'react';
import { SupportedUiLanguage, uiText } from '../systems/uiLanguage';

interface PwaUpdateNoticeProps {
  language: SupportedUiLanguage;
  needRefresh: boolean;
  setNeedRefresh: (value: boolean) => void;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  onBeforeUpdate?: () => Promise<void>;
  onUpdateFailed?: () => void;
}

const PwaUpdateNotice: React.FC<PwaUpdateNoticeProps> = ({ language, needRefresh, setNeedRefresh, updateServiceWorker, onBeforeUpdate, onUpdateFailed }) => {
  const [updating, setUpdating] = React.useState(false);
  const [updateError, setUpdateError] = React.useState(false);

  if (!needRefresh) return null;
  const t = (english: string, polish: string) => uiText(language, english, polish);
  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    setUpdateError(false);
    try {
      await onBeforeUpdate?.();
      await updateServiceWorker(true);
    } catch (error) {
      console.warn('PWA update could not safely reload.', error);
      onUpdateFailed?.();
      setUpdateError(true);
      setUpdating(false);
    }
  };

  return (
    <div className="fixed left-4 right-4 bottom-4 z-[100] safe-bottom pointer-events-none animate-slide-up" role="status" aria-live="polite">
      <div className="max-w-md mx-auto rounded-2xl border border-warm-300/25 bg-room-dark/96 backdrop-blur-xl p-4 shadow-2xl pointer-events-auto">
        <p className="text-warm-100 text-sm font-serif">{t('A new version is ready.', 'Nowa wersja jest gotowa.')}</p>
        <p className="text-warm-200/45 text-[10px] font-serif mt-1">{t("A living creature's latest local state will be saved before the app reloads.", 'Najnowszy lokalny stan żyjącego stworka zostanie zapisany przed ponownym wczytaniem aplikacji.')}</p>
        {updateError && <p className="text-red-100/75 text-[10px] font-serif mt-2">{t('Update paused because the latest save could not be confirmed.', 'Aktualizacja wstrzymana — nie udało się potwierdzić najnowszego zapisu.')}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button disabled={updating} onClick={() => setNeedRefresh(false)} className="min-h-11 rounded-xl border border-warm-200/10 px-3 py-2 text-warm-200/55 text-xs font-serif disabled:opacity-45">
            {t('Later', 'Później')}
          </button>
          <button disabled={updating} onClick={() => void handleUpdate()} className="min-h-11 rounded-xl border border-warm-300/25 bg-warm-300/15 px-3 py-2 text-warm-100 text-xs font-serif disabled:opacity-45">
            {updating ? t('Saving…', 'Zapisywanie…') : t('Update now', 'Aktualizuj')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdateNotice;
