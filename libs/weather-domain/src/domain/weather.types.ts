export type Activity =
  | 'SKIING'
  | 'SURFING'
  | 'OUTDOOR_SIGHTSEEING'
  | 'INDOOR_SIGHTSEEING';

export interface DailyWeather {
  date: string; // ISO YYYY-MM-DD (local calendar day)
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  rainMm: number;
  snowfallCm: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
  precipitationProbabilityMax: number;
}

export interface Location {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Forecast {
  location: Location;
  days: DailyWeather[];
}

export interface DailyScore {
  date: string;
  score: number; // 0..100
  weather: DailyWeather;
}

export interface ActivityRanking {
  activity: Activity;
  overallScore: number; // 0..100
  daily: DailyScore[];
}

export interface CityRanking {
  location: Location;
  rankings: ActivityRanking[]; // sorted best -> worst
}
