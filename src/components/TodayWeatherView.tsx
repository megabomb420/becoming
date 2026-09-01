import React from 'react';
import { WorldEnvironment } from '../types';
import { getWeatherConditionLabel, getWeatherIcon } from '../systems/environmentSystem';
import { getLocalDateKey, getTimeOfDay } from '../systems/timeSystem';
import { selectWeatherDay } from '../systems/weatherService';
import GlyphIcon from './GlyphIcon';

interface TodayWeatherViewProps {
  world: WorldEnvironment;
  language: 'pl' | 'en';
  now?: number;
  onClose: () => void;
}

function localTime(value: string) {
  const match = /T(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value;
}

function formatUpdatedAt(timestamp: number, timezone: string, language: 'pl' | 'en') {
  try {
    return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
      timeZone: timezone === 'auto' ? undefined : timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }
}

function windArrow(degrees: number | null | undefined) {
  if (!Number.isFinite(degrees)) return null;
  return <span aria-hidden="true" className="inline-block" style={{ transform: `rotate(${Number(degrees)}deg)` }}>↑</span>;
}

const TodayWeatherView: React.FC<TodayWeatherViewProps> = ({ world, language, now = Date.now(), onClose }) => {
  const polish = language === 'pl';
  const t = (english: string, polishText: string) => polish ? polishText : english;
  const snapshot = world.current;
  const location = world.settings.location;
  const localDateKey = getLocalDateKey(now, world);
  const today = snapshot ? selectWeatherDay(snapshot, localDateKey) : null;
  const currentHour = Math.floor(getTimeOfDay(now, world).minuteOfDay / 60);
  const remainingHours = today?.hours.filter(hour => Number(hour.localTime.slice(11, 13)) >= currentHour) ?? [];
  const hours = remainingHours.length > 0 ? remainingHours : today?.hours ?? [];
  const stale = world.status === 'stale' || Boolean(world.lastError);
  const updating = world.status === 'loading';
  const statusText = stale
    ? world.lastError === 'offline'
      ? t('Last known · offline', 'Ostatnie dane · offline')
      : t('Last known weather', 'Ostatnie dane pogodowe')
    : updating
      ? t('Updating', 'Aktualizowanie')
      : null;

  if (world.settings.mode !== 'device' && world.settings.mode !== 'city') return null;

  return (
    <div className="functional-sheet safe-top safe-bottom safe-x animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="today-weather-title">
      <div className="sheet-inner">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-[#a8ad91]/85">{location?.name ?? t('Selected place', 'Wybrane miejsce')}</p>
            <h2 id="today-weather-title" className="display-title mt-2 text-2xl text-warm-100">{t('Today', 'Dzisiaj')}</h2>
            <p className="mt-1 text-[10px] font-serif text-warm-200/40">{localDateKey}</p>
          </div>
          <button type="button" aria-label={t('Close today weather', 'Zamknij pogodę na dziś')} onClick={onClose} className="tap-target grid shrink-0 place-items-center rounded-full text-warm-200/60 hover:text-warm-100">
            <GlyphIcon name="close" size={21} />
          </button>
        </header>

        {snapshot ? (
          <>
            <section className="today-weather-hero mt-7" aria-label={t('Current weather', 'Aktualna pogoda')}>
              <div className="flex items-center gap-4">
                <span className="weather-hero-icon" aria-hidden="true">{getWeatherIcon(snapshot.condition)}</span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="display-title text-5xl text-warm-100">{Math.round(snapshot.temperatureC)}°</span>
                    <span className="text-[10px] font-serif text-warm-200/38">C</span>
                  </div>
                  <p className="mt-1 text-sm font-serif text-warm-100/78">{getWeatherConditionLabel(snapshot.condition, language)}</p>
                </div>
                {today && (
                  <div className="ml-auto shrink-0 text-right font-serif">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-warm-200/38">{t('High / low', 'Maks. / min.')}</p>
                    <p className="mt-1 text-sm text-warm-100/75">{Math.round(today.maxC)}° / {Math.round(today.minC)}°</p>
                  </div>
                )}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-warm-200/8 pt-4 text-center font-serif">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-warm-200/35">{t('Wind', 'Wiatr')}</p>
                  <p className="mt-1 whitespace-nowrap text-[11px] text-warm-100/68">{windArrow(snapshot.windDirectionDeg)} {Math.round(snapshot.windSpeedKph)} km/h</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-warm-200/35">{t('Sunrise', 'Wschód')}</p>
                  <p className="mt-1 text-[11px] text-warm-100/68">{today ? localTime(today.sunrise) : '—'}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-warm-200/35">{t('Sunset', 'Zachód')}</p>
                  <p className="mt-1 text-[11px] text-warm-100/68">{today ? localTime(today.sunset) : '—'}</p>
                </div>
              </div>
            </section>

            {statusText && (
              <p className="mt-3 rounded-full border border-warm-200/8 bg-room-mid/45 px-3 py-2 text-center text-[9px] font-serif text-warm-200/52">
                {statusText} · {t('updated', 'aktualizacja')} {formatUpdatedAt(snapshot.fetchedAt, snapshot.timezone, language)}
              </p>
            )}

            <section className="mt-7" aria-labelledby="hourly-weather-title">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow text-[#a8ad91]/65">{t('The day ahead', 'Dalsza część dnia')}</p>
                  <h3 id="hourly-weather-title" className="mt-2 text-base font-serif text-warm-100/88">{t('Hourly', 'Godzinowo')}</h3>
                </div>
                {today && <p className="text-[9px] font-serif text-warm-200/35">{Math.round(today.minC)}° — {Math.round(today.maxC)}°</p>}
              </div>

              {hours.length > 0 ? (
                <div className="weather-hour-strip mt-3 flex snap-x gap-2 overflow-x-auto pb-3" aria-label={t('Today hourly forecast', 'Godzinowa prognoza na dziś')}>
                  {hours.map(hour => {
                    const hourNumber = Number(hour.localTime.slice(11, 13));
                    const isCurrent = hourNumber === currentHour;
                    return (
                      <article key={hour.localTime} className={`weather-hour-card snap-start ${isCurrent ? 'is-current' : ''}`}>
                        <p className="text-[9px] font-serif text-warm-200/48">{isCurrent ? t('Now', 'Teraz') : localTime(hour.localTime)}</p>
                        <span className="my-2 block text-xl text-warm-100/82" aria-hidden="true">{getWeatherIcon(hour.condition)}</span>
                        <p className="text-sm font-serif text-warm-100/82">{Math.round(hour.temperatureC)}°</p>
                        <p className="mt-1 h-7 text-center text-[8px] leading-tight font-serif text-warm-200/42">{getWeatherConditionLabel(hour.condition, language)}</p>
                        {hour.precipitationProbability !== null && (
                          <p className="mt-2 text-[9px] font-serif text-[#9fb5bd]/72">⌇ {Math.round(hour.precipitationProbability)}%</p>
                        )}
                        {hour.windSpeedKph !== null && (
                          <p className="mt-1 whitespace-nowrap text-[8px] font-serif text-warm-200/32">{windArrow(hour.windDirectionDeg)} {Math.round(hour.windSpeedKph)} km/h</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="ink-card mt-3 px-4 py-5 text-center">
                  <p className="text-xs font-serif text-warm-100/65">{t('No hourly forecast is cached for this local day.', 'Brak zapisanej prognozy godzinowej dla tego lokalnego dnia.')}</p>
                  <p className="mt-2 text-[9px] leading-relaxed font-serif text-warm-200/38">
                    {stale
                      ? t('The last observation stays visible without pretending it is a new forecast.', 'Ostatni odczyt pozostaje widoczny, ale nie udaje nowej prognozy.')
                      : t('It will appear after the next weather refresh.', 'Pojawi się po następnym odświeżeniu pogody.')}
                  </p>
                </div>
              )}
            </section>

            {!stale && (
              <p className="mt-6 text-center text-[9px] font-serif text-warm-200/28">
                {t('Updated', 'Aktualizacja')} {formatUpdatedAt(snapshot.fetchedAt, snapshot.timezone, language)}
              </p>
            )}
          </>
        ) : (
          <div className="ink-card mt-8 px-5 py-8 text-center">
            <span className="text-3xl text-warm-200/45" aria-hidden="true">·</span>
            <p className="mt-3 text-sm font-serif text-warm-100/72">
              {world.status === 'loading' || world.status === 'locating'
                ? t('Weather is updating.', 'Pogoda jest aktualizowana.')
                : t('Weather is unavailable right now.', 'Pogoda jest teraz niedostępna.')}
            </p>
            <p className="mt-2 text-[10px] leading-relaxed font-serif text-warm-200/38">
              {t('No conditions or forecast are invented while the source is unavailable.', 'Gdy źródło jest niedostępne, nie wymyślamy warunków ani prognozy.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayWeatherView;
