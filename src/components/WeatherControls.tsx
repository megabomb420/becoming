import { authoritativeNow } from '../systems/authoritativeTime';
import React, { FormEvent, useMemo, useState } from 'react';
import { GameState, WeatherLocation } from '../types';
import {
  disableWeather,
  getWeatherConditionLabel,
  getWeatherIcon,
  markWeatherPermissionFailure,
  setWeatherLocation,
} from '../systems/environmentSystem';
import {
  CitySearchResult,
  requestCurrentWeatherLocation,
  searchCities,
  WeatherServiceError,
} from '../systems/weatherService';

interface WeatherControlsProps {
  state: GameState;
  language: 'pl' | 'en';
  onStateChange: (state: GameState | ((previous: GameState) => GameState)) => void;
  variant: 'onboarding' | 'settings';
}

function placeLabel(location: WeatherLocation, language: 'pl' | 'en') {
  if (location.source === 'device') return language === 'pl' ? 'Bieżąca okolica' : 'Current area';
  const suffix = location.country;
  return suffix ? `${location.name}, ${suffix}` : location.name;
}

function relativeUpdate(fetchedAt: number, language: 'pl' | 'en') {
  const minutes = Math.max(0, Math.floor((authoritativeNow() - fetchedAt) / 60_000));
  if (minutes < 2) return language === 'pl' ? 'przed chwilą' : 'just now';
  if (minutes < 60) return language === 'pl' ? `${minutes} min temu` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return language === 'pl' ? `${hours} godz. temu` : `${hours}h ago`;
}

const WeatherControls: React.FC<WeatherControlsProps> = ({ state, language, onStateChange, variant }) => {
  const polish = language === 'pl';
  const t = (english: string, polishText: string) => polish ? polishText : english;
  const world = state.world;
  const [view, setView] = useState<'choice' | 'city'>('choice');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [busy, setBusy] = useState<'location' | 'search' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentSummary = useMemo(() => {
    if (!world.current) return null;
    return `${getWeatherIcon(world.current.condition)} ${Math.round(world.current.temperatureC)}° · ${getWeatherConditionLabel(world.current.condition, language)}`;
  }, [language, world.current]);

  const setWorld = (transform: (value: GameState['world']) => GameState['world']) => {
    onStateChange(previous => ({ ...previous, world: transform(previous.world) }));
  };

  const useCurrentArea = async () => {
    setBusy('location');
    setMessage(null);
    setWorld(value => ({ ...value, status: 'locating', lastError: null }));
    try {
      const location = await requestCurrentWeatherLocation();
      setWorld(value => setWeatherLocation(value, {
        ...location,
        name: t('Current area', 'Bieżąca okolica'),
      }, 'granted'));
    } catch (error) {
      const code = error instanceof WeatherServiceError && error.code === 'permission_denied'
        ? 'permission_denied'
        : 'location_unavailable';
      setWorld(value => markWeatherPermissionFailure(value, code));
      setView('city');
      setMessage(code === 'permission_denied'
        ? t('Location was not shared. Choose a city instead.', 'Lokalizacja nie została udostępniona. Wybierz miasto.')
        : t('This device could not find its location. Choose a city instead.', 'Urządzenie nie mogło ustalić lokalizacji. Wybierz miasto.'));
    } finally {
      setBusy(null);
    }
  };

  const findCity = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) {
      setMessage(t('Enter at least two letters.', 'Wpisz co najmniej dwie litery.'));
      return;
    }
    setBusy('search');
    setMessage(null);
    try {
      const found = await searchCities(query, language);
      setResults(found);
      if (found.length === 0) setMessage(t('No matching city was found.', 'Nie znaleziono pasującego miasta.'));
    } catch {
      setMessage(t('City search is unavailable right now. The last known weather remains safe.', 'Wyszukiwanie miast jest teraz niedostępne. Ostatnia pogoda pozostaje zapisana.'));
    } finally {
      setBusy(null);
    }
  };

  const chooseCity = (location: CitySearchResult) => {
    setWorld(value => setWeatherLocation(value, location, value.settings.permission));
    setMessage(null);
    setResults([]);
    setView('choice');
  };

  const turnOff = () => {
    setWorld(disableWeather);
    setMessage(null);
  };

  const cityPicker = (
    <div className="mt-3">
      <form onSubmit={findCity} className="flex gap-2">
        <label className="sr-only" htmlFor={`weather-city-${variant}`}>{t('City', 'Miasto')}</label>
        <input
          id={`weather-city-${variant}`}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('City or postal code', 'Miasto lub kod pocztowy')}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-warm-200/12 bg-room-dark/55 px-3 text-sm font-serif text-warm-100 outline-none placeholder:text-warm-200/25 focus:border-warm-300/45"
        />
        <button
          type="submit"
          disabled={busy !== null}
          className="min-h-11 rounded-xl border border-warm-300/25 bg-warm-300/10 px-3 text-xs font-serif text-warm-100 disabled:opacity-40"
        >
          {busy === 'search' ? t('Looking…', 'Szukam…') : t('Find', 'Szukaj')}
        </button>
      </form>
      {results.length > 0 && (
        <div className="mt-2 max-h-52 space-y-1 overflow-auto rounded-xl border border-warm-200/10 bg-room-dark/35 p-1" role="listbox" aria-label={t('Matching cities', 'Pasujące miasta')}>
          {results.map(result => (
            <button
              type="button"
              role="option"
              key={`${result.id}-${result.latitude}-${result.longitude}`}
              onClick={() => chooseCity(result)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-warm-100/5"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-serif text-warm-100/85">{result.name}</span>
                <span className="block truncate text-[9px] font-serif text-warm-200/40">{[result.admin1, result.country].filter(Boolean).join(', ')}</span>
              </span>
              <span className="shrink-0 text-warm-200/30" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (variant === 'onboarding') {
    return (
      <div className="absolute inset-0 z-[70] overflow-auto bg-[#12110f]/88 backdrop-blur-lg safe-top safe-bottom safe-x animate-fade-in">
        <div className="mx-auto flex min-h-full max-w-sm items-center px-5 py-8">
          <section className="w-full rounded-[1.75rem] border border-warm-200/12 bg-[#24201b]/96 p-5 shadow-[0_28px_90px_rgba(0,0,0,.58)]">
            <p className="text-[9px] uppercase tracking-[0.22em] text-warm-300/50">{t('The world outside', 'Świat za oknem')}</p>
            <h2 className="mt-2 text-xl font-serif text-warm-100">{t('Should this room feel your weather?', 'Czy ten pokój ma czuć twoją pogodę?')}</h2>
            <p className="mt-2 text-xs font-serif leading-relaxed text-warm-200/55">
              {t(
                'Rain, light, wind and temperature can shape the room and how this creature responds. Your precise position is never sent: coordinates are rounded before Open-Meteo receives them.',
                'Deszcz, światło, wiatr i temperatura mogą kształtować pokój oraz reakcje stworka. Dokładna pozycja nie jest wysyłana: współrzędne są zaokrąglane przed przekazaniem do Open-Meteo.',
              )}
            </p>

            {view === 'choice' ? (
              <div className="mt-5 space-y-2">
                <button type="button" disabled={busy !== null} onClick={() => void useCurrentArea()} className="min-h-12 w-full rounded-xl bg-warm-100/90 px-4 text-sm font-serif text-room-dark shadow-lg disabled:opacity-45">
                  {busy === 'location' ? t('Finding your area…', 'Szukam okolicy…') : t('Use my current area', 'Użyj bieżącej okolicy')}
                </button>
                <button type="button" onClick={() => setView('city')} className="min-h-11 w-full rounded-xl border border-warm-200/14 px-4 text-xs font-serif text-warm-100/75">
                  {t('Choose a city instead', 'Wybierz miasto')}
                </button>
                <button type="button" onClick={turnOff} className="min-h-11 w-full px-4 text-[10px] font-serif text-warm-200/38">
                  {t('Keep weather outside', 'Wyłącz wpływ pogody')}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-serif text-warm-100/75">{t('Choose the sky this room follows', 'Wybierz niebo, za którym podąża pokój')}</p>
                  <button type="button" onClick={() => setView('choice')} className="min-h-11 -my-2 px-2 text-[10px] font-serif text-warm-200/40">{t('Back', 'Wróć')}</button>
                </div>
                {cityPicker}
                <button type="button" onClick={turnOff} className="mt-3 min-h-11 w-full text-[10px] font-serif text-warm-200/38">{t('Continue without weather', 'Kontynuuj bez pogody')}</button>
              </div>
            )}
            {message && <p className="mt-3 text-[10px] font-serif leading-relaxed text-warm-300/70" aria-live="polite">{message}</p>}
            <p className="mt-4 text-[9px] font-serif leading-relaxed text-warm-200/25">{t('No API key or account. The choice and last forecast stay in this creature’s local IndexedDB save.', 'Bez klucza API i konta. Wybór oraz ostatnia prognoza zostają w lokalnym zapisie IndexedDB tego stworka.')}</p>
          </section>
        </div>
      </div>
    );
  }

  const location = world.settings.location;
  const active = world.settings.mode === 'device' || world.settings.mode === 'city';
  return (
    <section className="rounded-2xl border border-warm-200/10 bg-room-mid/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-serif text-warm-100/85">{t('Weather and daylight', 'Pogoda i światło dnia')}</div>
          <p className="mt-1 text-[10px] font-serif leading-relaxed text-warm-200/40">
            {active && location
              ? placeLabel(location, language)
              : world.settings.mode === 'disabled'
                ? t('Weather influence is off. The room uses a seasonal local-light fallback.', 'Wpływ pogody jest wyłączony. Pokój korzysta z sezonowego, lokalnego światła zastępczego.')
                : t('Choose the current area or a city to bring the outside world in.', 'Wybierz bieżącą okolicę albo miasto, aby wpuścić świat do pokoju.')}
          </p>
        </div>
        {active && currentSummary && <span className="shrink-0 rounded-full border border-warm-200/10 bg-room-dark/30 px-2.5 py-1 text-[10px] font-serif text-warm-100/65">{currentSummary}</span>}
      </div>

      {active && world.current && (
        <p className="mt-2 text-[9px] font-serif text-warm-200/28">
          {world.status === 'loading'
            ? t('Refreshing from Open-Meteo…', 'Odświeżam z Open-Meteo…')
            : world.status === 'stale' || world.lastError
              ? t(`Last known weather · ${relativeUpdate(world.current.fetchedAt, language)}`, `Ostatnia znana pogoda · ${relativeUpdate(world.current.fetchedAt, language)}`)
              : t(`Updated ${relativeUpdate(world.current.fetchedAt, language)}`, `Aktualizacja ${relativeUpdate(world.current.fetchedAt, language)}`)}
        </p>
      )}
      {active && !world.current && (
        <p className="mt-2 text-[9px] font-serif text-warm-200/32" aria-live="polite">
          {world.status === 'loading' || world.status === 'idle'
            ? t('Bringing the outside world in…', 'Wprowadzam świat za oknem…')
            : world.lastError === 'offline'
              ? t('Waiting for a connection. The room remains calm in the meantime.', 'Czekam na połączenie. Do tego czasu pokój pozostaje spokojny.')
              : t('Weather is unavailable right now. Becoming will try again quietly.', 'Pogoda jest teraz niedostępna. Becoming spróbuje ponownie w tle.')}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void useCurrentArea()} className={`min-h-11 rounded-xl border px-2 text-[10px] font-serif ${world.settings.mode === 'device' ? 'border-warm-300/35 bg-warm-300/15 text-warm-100' : 'border-warm-200/10 bg-room-dark/25 text-warm-200/55'}`}>
          {busy === 'location' ? t('Finding…', 'Szukam…') : t('Current area', 'Moja okolica')}
        </button>
        <button type="button" onClick={() => setView(previous => previous === 'city' ? 'choice' : 'city')} className={`min-h-11 rounded-xl border px-2 text-[10px] font-serif ${world.settings.mode === 'city' ? 'border-warm-300/35 bg-warm-300/15 text-warm-100' : 'border-warm-200/10 bg-room-dark/25 text-warm-200/55'}`}>
          {t('Choose city', 'Wybierz miasto')}
        </button>
        <button type="button" onClick={turnOff} className={`min-h-11 rounded-xl border px-2 text-[10px] font-serif ${world.settings.mode === 'disabled' ? 'border-warm-300/25 bg-warm-300/10 text-warm-100/75' : 'border-warm-200/10 bg-room-dark/25 text-warm-200/45'}`}>
          {t('Turn off', 'Wyłącz')}
        </button>
      </div>
      {view === 'city' && cityPicker}
      {message && <p className="mt-3 text-[10px] font-serif leading-relaxed text-warm-300/70" aria-live="polite">{message}</p>}
      <p className="mt-3 text-[9px] font-serif leading-relaxed text-warm-200/24">
        {t('Device coordinates are rounded to about a kilometre before the request. Refreshes are cached for roughly 45 minutes.', 'Współrzędne urządzenia są zaokrąglane do około kilometra przed wysłaniem. Aktualizacje są cache’owane przez około 45 minut.')}
      </p>
    </section>
  );
};

export default WeatherControls;
