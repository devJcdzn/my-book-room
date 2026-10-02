import { colors, darkTheme, typography } from "@/src/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoomEditor } from "@/src/store/room-editor-store";
import {
  CAT_OPTIONS,
  FLOOR_PALETTES,
  RUG_PALETTES,
  WALL_PALETTES,
} from "@/src/types/room-customization";

export function RoomAppearanceOptions({
  category,
  isNight,
  loadingCatId,
}: {
  category: "environment" | "rug" | "cat";
  isNight: boolean;
  loadingCatId?: string | null;
}) {
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
      {groups.map((group) => (
        <View key={group.field} style={styles.groups}>
          {category === "environment" ? (
            <Text style={[styles.title, { color }]}>{group.title}</Text>
          ) : null}
          <View style={styles.options}>
            {group.options.map((option) => {
              const selected = appearance[group.field] === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={option.name}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setAppearance({ [group.field]: option.id });
                    if (category === "rug") {
                      const editor = useRoomEditor.getState();
                      const rug = editor.draft?.pieces.find(
                        (p) => p.category === "rug",
                      );
                      if (rug) editor.update({ ...rug, finish: "original" });
                    }
                  }}
                  style={[
                    styles.option,
                    { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill },
                    selected && { borderColor: isNight ? darkTheme.accent : colors.terracotta },
                  ]}
                >
                  <View
                    style={[styles.swatch, { backgroundColor: option.color }]}
                  >
                    {category === "cat" ? (
                      <Ionicons name="paw" size={22} color="#FFF9F0" />
                    ) : null}
                  </View>
                  <Text style={[styles.label, { color }]}>{option.name}</Text>
                  {loadingCatId === option.id ? (
                    <ActivityIndicator color={color} />
                  ) : selected ? (
                    <Ionicons name="checkmark" size={20} color={color} />
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
  groups: { gap: 12 },
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
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontSize: 14, fontWeight: "500" },
});
