import { lockedCollection, useCollectionPurchases } from '@/src/services/collection-access';
import { openCollectionPaywall } from '@/src/services/collection-purchases';
import { useState } from "react";
import { colors, darkTheme, radii, typography } from "@/src/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoomEditor } from "@/src/store/room-editor-store";
import {
  CAT_OPTIONS,
  ROOM_COLOR_CATEGORIES,
  roomPaletteCategory,
  FLOOR_PALETTES,
  RUG_PALETTES,
  WALL_PALETTES,
} from "@/src/types/room-customization";

export function RoomColorCategories({ selected, onSelect, isNight }: { selected: string; onSelect: (id: string) => void; isNight: boolean }) {
  const owned = useCollectionPurchases(state => state.owned);
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  return <ScrollView accessibilityRole="tablist" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
    {ROOM_COLOR_CATEGORIES.map(category => {
      const active = selected === category.id;
      const locked = Boolean(lockedCollection(category.id, owned));
      const color = active ? accent : muted;
      return <Pressable key={category.id} accessibilityRole="tab"
        accessibilityLabel={locked ? `${category.name}, coleção bloqueada` : category.name}
        accessibilityState={{ selected: active }} onPress={() => onSelect(category.id)}
        style={({ pressed }) => [styles.category, {
          backgroundColor: active ? (isNight ? darkTheme.selection : colors.paper) : (isNight ? darkTheme.surface : colors.softFill),
          borderColor: isNight ? darkTheme.border : colors.line,
        }, pressed && styles.pressed]}>
        {locked || active ? <Ionicons name={locked ? "lock-closed-outline" : "checkmark"} size={15} color={color} accessible={false} /> : null}
        <Text style={[styles.categoryLabel, { color }]}>{category.name}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export function RoomColorSwatch({ label, color, selected, locked, isNight, onPress }: {
  label: string; color: string; selected: boolean; locked: boolean; isNight: boolean; onPress: () => void;
}) {
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={locked ? `${label}, coleção bloqueada` : label}
      accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.colorOption, {
        backgroundColor: isNight ? darkTheme.surface : colors.paper,
        borderColor: selected ? accent : (isNight ? darkTheme.border : colors.line),
      }, pressed && styles.pressed]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      {locked || selected ? <View style={[styles.swatchMark, {
        backgroundColor: isNight ? darkTheme.surfaceElevated : colors.paper,
        borderColor: accent,
      }]}>
        <Ionicons name={locked ? "lock-closed" : "checkmark"} size={11} color={accent} accessible={false} />
      </View> : null}
    </Pressable>
  );
}

export function RoomAppearanceOptions({
  category,
  isNight,
  loadingCatId,
}: {
  category: "environment" | "rug" | "cat";
  isNight: boolean;
  loadingCatId?: string | null;
}) {
  const owned = useCollectionPurchases(state => state.owned);
  const [colorCategory, setColorCategory] = useState("base");
  const appearance = useRoomEditor((state) => state.appearance);
  const setAppearance = useRoomEditor((state) => state.setAppearance);
  if (!appearance) return null;
  const groups =
    category === "environment"
      ? [
          {
            title: "Paredes",
            field: "wallPaletteId" as const,
            options: WALL_PALETTES.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.previewColor,
            })),
          },
          {
            title: "Piso",
            field: "floorPaletteId" as const,
            options: FLOOR_PALETTES.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.plankColor,
            })),
          },
        ]
      : category === "rug"
        ? [
            {
              title: "Tapete",
              field: "rugPaletteId" as const,
              options: RUG_PALETTES.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.mainColor,
              })),
            },
          ]
        : [
            {
              title: "Gatinho",
              field: "catId" as const,
              options: CAT_OPTIONS.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.furColor,
              })),
            },
          ];
  const color = isNight ? darkTheme.text : colors.ink;
  return (
    <View style={styles.groups}>
      {category === "environment" ? <RoomColorCategories selected={colorCategory} onSelect={setColorCategory} isNight={isNight} /> : null}
      {groups.map((group) => (
        <View key={group.field} style={styles.groups}>
          {category === "environment" ? (
            <Text style={[styles.title, { color }]}>{group.title}</Text>
          ) : null}
          <View style={styles.options}>
            {group.options.filter(option => category !== "environment" || roomPaletteCategory(option.id) === colorCategory).map((option) => {
              const selected = appearance[group.field] === option.id;
              const locked = lockedCollection(option.id, owned);
              const choose = () => {
                if (locked) { void openCollectionPaywall(locked); return; }
                setAppearance({ [group.field]: option.id });
                if (category === "rug") {
                  const editor = useRoomEditor.getState();
                  const rug = editor.draft?.pieces.find((p) => p.category === "rug");
                  if (rug) editor.update({ ...rug, finish: "original" });
                }
              };
              if (category !== "cat") return <RoomColorSwatch key={option.id} label={option.name}
                color={option.color} selected={selected} locked={Boolean(locked)} isNight={isNight} onPress={choose} />;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={option.name}
                  accessibilityState={{ selected }}
                  onPress={choose}
                  style={[
                    styles.option,
                    { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill },
                    selected && { borderColor: isNight ? darkTheme.selectionText : colors.sageDark },
                  ]}
                >
                  <View
                    style={[styles.swatch, { backgroundColor: option.color }]}
                  >
                    {category === "cat" ? (
                      <Ionicons name="paw" size={22} color={colors.paper} />
                    ) : null}
                  </View>
                  {category === "cat" ? <Text style={[styles.label, { color }]}>{option.name}</Text> : null}
                  {locked ? <Ionicons name="lock-closed" size={16} color={color} style={{ position: 'absolute' }} /> : null}
                  {loadingCatId === option.id ? (
                    <ActivityIndicator color={color} />
                  ) : selected ? (
                    <Ionicons name="checkmark" size={20} color={color}  />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  categories: { gap: 8, paddingVertical: 2 },
  category: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radii.small, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  categoryLabel: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  groups: { gap: 14 },
  title: { fontFamily: typography.editorial, fontSize: 18, lineHeight: 24 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    width: "48%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOption: {
    width: 48, height: 48, borderRadius: radii.full, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  swatchMark: { position: "absolute", right: 0, bottom: 0, width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 14, fontWeight: "500" },
});
