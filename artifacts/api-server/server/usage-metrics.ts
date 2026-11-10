export interface DailyUsageCount {
  day: string;
  unique_devices: number;
  views: number;
}

export function completeDailyCounts(start: string, rows: DailyUsageCount[], days: number): DailyUsageCount[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, offset) => {
    const day = new Date(startTime + offset * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, unique_devices: 0, views: 0 };
  });
}
