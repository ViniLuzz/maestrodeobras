import * as Location from 'expo-location';

export type WeatherInfo = {
  isRaining: boolean;
  description: string;
};

// Códigos WMO que representam chuva / tempestade (Open-Meteo)
// https://open-meteo.com/en/docs#weathervariables
const RAIN_CODES = new Set([
  51, 53, 55,          // garoa leve / moderada / intensa
  56, 57,              // garoa com gelo
  61, 63, 65,          // chuva leve / moderada / forte
  66, 67,              // chuva com gelo
  80, 81, 82,          // pancadas de chuva
  85, 86,              // pancadas de neve
  95,                  // trovoada
  96, 99,              // trovoada com granizo
]);

function descricaoClima(code: number, precip: number): string {
  if (code >= 95) return `trovoada${precip > 0 ? ` (${precip.toFixed(1)} mm)` : ''}`;
  if (code >= 80) return `pancadas de chuva${precip > 0 ? ` (${precip.toFixed(1)} mm)` : ''}`;
  if (code >= 61) return `chuva${precip > 0 ? ` (${precip.toFixed(1)} mm)` : ''}`;
  if (code >= 51) return 'garoa';
  return 'chuva';
}

export async function getWeather(): Promise<WeatherInfo | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=weathercode,precipitation&timezone=auto`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return null;

    const json = await resp.json() as {
      current: { weathercode: number; precipitation: number };
    };

    const code   = json.current.weathercode;
    const precip = json.current.precipitation ?? 0;
    const isRaining = RAIN_CODES.has(code) || precip > 0;

    return {
      isRaining,
      description: isRaining ? descricaoClima(code, precip) : 'tempo limpo',
    };
  } catch {
    return null;
  }
}
