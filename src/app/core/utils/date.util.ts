import { TimeUnit } from '../models/workout.model';

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatMinutes(seconds: number): string {
  const minutes = Math.round((seconds / 60) * 2) / 2;
  const label = Number.isInteger(minutes) ? minutes.toString() : minutes.toFixed(1);
  return `${label} min`;
}

export function formatDurationValue(seconds: number, unit?: TimeUnit | null): string {
  if (unit === 'sec') return `${Math.round(seconds)}s`;
  return formatMinutes(seconds);
}

export function convertTimeValue(value: number, fromUnit: TimeUnit, toUnit: TimeUnit): number {
  if (fromUnit === toUnit) return value;
  const seconds = fromUnit === 'sec' ? value : value * 60;
  return toUnit === 'sec' ? Math.round(seconds) : Math.round((seconds / 60) * 2) / 2;
}
