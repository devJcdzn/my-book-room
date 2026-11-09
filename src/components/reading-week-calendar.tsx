import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayReadingDate, getReadingWeek } from '@/src/utils/reading-days';
import { colors, darkTheme, radii } from '@/src/theme';

export function ReadingWeekCalendar({ readingDays, isNight, onLayout }: { readingDays: string[]; isNight: boolean; onLayout?: (event: LayoutChangeEvent) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const week = getReadingWeek(new Date(), readingDays);
  const size = Math.min(36, Math.floor((width - insets.left - insets.right - 64) / 7));
  const surface = isNight ? darkTheme.surface : colors.paper;
  const border = isNight ? darkTheme.border : colors.line;
  const text = isNight ? darkTheme.text : colors.ink;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const readFill = isNight ? darkTheme.selection : colors.sageSoft;

  return (
    <View onLayout={onLayout} pointerEvents="none" style={[styles.container, {
      top: insets.top + 61, left: insets.left + 18, right: insets.right + 18,
      backgroundColor: surface, borderColor: border,
    }]}>
      {week.map((day) => (
        <View key={day.key} accessible
          accessibilityLabel={`${day.isToday ? 'Hoje, ' : ''}${displayReadingDate(day.key)}, ${day.isRead ? 'leitura registrada' : day.isFuture ? 'dia futuro' : 'sem leitura registrada'}`}
          style={styles.day}>
          <Text style={[styles.label, { color: day.isToday ? text : muted }, day.isToday && styles.emphasis]}>
            {day.isToday ? 'Hoje' : day.label}
          </Text>
          <View style={[styles.circle, {
            width: size, minHeight: size,
            backgroundColor: day.isRead ? readFill : 'transparent',
            borderColor: day.isToday ? text : 'transparent',
          }]}>
            <Text style={[styles.number, { color: day.isRead ? accent : day.isToday ? text : muted },
              (day.isToday || day.isRead) && styles.emphasis]}>{day.number}</Text>
            {day.isRead && (
              <View style={[styles.readMark, { backgroundColor: accent, borderColor: surface }]}>
                <Ionicons name="checkmark" size={9} color={isNight ? darkTheme.bg : colors.paper} accessible={false} />
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', zIndex: 2, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: radii.large, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  circle: { borderRadius: radii.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] },
  emphasis: { fontWeight: '700' },
  readMark: {
    position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});
