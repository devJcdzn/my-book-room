import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getReadingWeek } from '@/src/utils/reading-days';
import { colors, darkTheme } from '@/src/theme';

export function ReadingWeekCalendar({ readingDays, isNight }: { readingDays: string[]; isNight: boolean }) {
  const insets = useSafeAreaInsets();
  const week = getReadingWeek(new Date(), readingDays);
  const palette = isNight
      ? {
        label: darkTheme.textMuted,
        circleBorder: darkTheme.textMuted,
        futureBorder: darkTheme.textMuted,
        futureNumber: darkTheme.textMuted,
        missedNumber: darkTheme.text,
        readBackground: colors.sage,
        readNumber: darkTheme.text,
        todayBorder: '#A6B897',
      }
    : {
        label: colors.muted,
        circleBorder: colors.inkSoft,
        futureBorder: colors.muted,
        futureNumber: colors.inkSoft,
        missedNumber: colors.ink,
        readBackground: colors.sage,
        readNumber: colors.paper,
        todayBorder: '#465640',
      };

  return (
    <View accessibilityLabel="Dias de leitura desta semana" pointerEvents="none" style={[styles.container, { top: insets.top + 61 }]}>
      {week.map((day) => (
        <View key={day.key} style={styles.day}>
          <Text style={[styles.label, { color: palette.label }]}>{day.label}</Text>
          <View style={[
            styles.circle,
            {
              backgroundColor: day.isRead ? palette.readBackground : 'transparent',
              borderColor: day.isToday
                ? palette.todayBorder
                : day.isFuture
                  ? palette.futureBorder
                  : palette.circleBorder,
              borderStyle: day.isFuture ? 'dashed' : 'solid',
            },
            day.isToday && styles.today,
          ]}>
            <Text style={[
              styles.number,
              { color: day.isRead ? palette.readNumber : day.isFuture ? palette.futureNumber : palette.missedNumber },
            ]}>{day.number}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', zIndex: 2, left: 18, right: 18, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 7 },
  label: { fontSize: 11, fontWeight: '500' },
  circle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  today: { borderWidth: 2 },
});
