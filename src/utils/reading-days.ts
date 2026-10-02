export type ReadingWeekDay = { key: string; number: number; label: string; isToday: boolean; isRead: boolean; isFuture: boolean };

export const localDateKey = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

export const normalizeReadingDays = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => {
    if (typeof item !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return false;
    const parsed = new Date(`${item}T12:00:00`);
    return Number.isFinite(parsed.getTime()) && localDateKey(parsed) === item;
  }))].sort();
};

export const getReadingWeek = (date: Date, readDays: string[]): ReadingWeekDay[] => {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const todayKey = localDateKey(today);
  return labels.map((label, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const key = localDateKey(current);
    return { key, number: current.getDate(), label, isToday: key === todayKey, isRead: readDays.includes(key), isFuture: key > todayKey };
  });
};
