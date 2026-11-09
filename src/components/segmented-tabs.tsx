import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, controls, darkTheme, typography } from '@/src/theme';

type Segment<T extends string> = {
  id: T;
  label: string;
  accessibilityLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function SegmentedTabs<T extends string>({ items, selected, onSelect, isNight, style }: {
  items: readonly Segment<T>[];
  selected: NoInfer<T>;
  onSelect: (id: T) => void;
  isNight: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const width = useSharedValue(0);
  const index = items.findIndex(item => item.id === selected);
  const count = items.length;
  const position = useDerivedValue(() => withTiming(Math.max(0, index), {
    duration: 120, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
  }));
  const indicatorStyle = useAnimatedStyle(() => {
    const segmentWidth = width.get() / Math.max(1, count);
    const markerWidth = Math.min(32, segmentWidth);
    return { width: markerWidth, transform: [{ translateX: (position.get() + 0.5) * segmentWidth - markerWidth / 2 }] };
  });

  if (!count) return null;

  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;

  return (
    <View accessibilityRole="tablist" style={[styles.track, isNight && styles.trackNight, style]}>
      <View style={styles.row} onLayout={event => width.set(event.nativeEvent.layout.width)}>
        {index >= 0 && <Animated.View pointerEvents="none" style={[styles.indicator, isNight && styles.indicatorNight, indicatorStyle]} />}
        {items.map(item => {
          const active = item.id === selected;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active && process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                onSelect(item.id);
              }}
              style={({ pressed }) => [styles.segment, pressed && controls.buttonPressed]}
            >
              {item.icon && <Ionicons name={item.icon} size={17} color={active ? accent : muted} accessible={false} />}
              <Text style={[styles.label, { color: active ? accent : muted }, active && styles.activeLabel]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  trackNight: { borderColor: darkTheme.border },
  row: { flexDirection: 'row' },
  indicator: { position: 'absolute', bottom: 0, left: 0, height: 2, borderRadius: 1, backgroundColor: colors.sageDark },
  indicatorNight: { backgroundColor: darkTheme.selectionText },
  segment: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8, gap: 5 },
  label: { flexShrink: 1, fontFamily: typography.ui, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  activeLabel: { fontWeight: '600' },
});
