import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveAmbience } from '@/src/types/ambience';
import { useRoomEditor } from '@/src/store/room-editor-store';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';

export default function TabLayout() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const insets = useSafeAreaInsets();
  const activeColor = isNight ? darkTheme.selectionText : colors.sageDark;
  const inactiveColor = isNight ? darkTheme.textMuted : colors.inkSoft;
  const pathname = usePathname();
  const isOrganizing = useRoomEditor(state => Boolean(state.draft));
  const isTabBarHidden = pathname === '/diary/note' || (pathname === '/' && isOrganizing);

  if (process.env.EXPO_OS === 'ios') {
    return (
      <NativeTabs
        backgroundColor={isNight ? darkTheme.surface : colors.paper}
        disableTransparentOnScrollEdge
        unstable_nativeProps={{ colorScheme: isNight ? 'dark' : 'light' }}
        iconColor={{ default: inactiveColor, selected: activeColor }}
        blurEffect={isNight ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
        hidden={isTabBarHidden}
        tintColor={activeColor}
      >
        <NativeTabs.Trigger disableAutomaticContentInsets name="index" accessibilityLabel="Ambiente">
          <NativeTabs.Trigger.Icon md="home" sf={{ default: "house", selected: "house.fill" }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="books" accessibilityLabel="Biblioteca">
          <NativeTabs.Trigger.Icon md="auto_stories" sf={{ default: "books.vertical", selected: "books.vertical.fill" }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="diary" accessibilityLabel="Diário">
          <NativeTabs.Trigger.Icon md="edit_note" sf={{ default: "book.pages", selected: "book.pages.fill" }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile" accessibilityLabel="Perfil">
          <NativeTabs.Trigger.Icon md="person" sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const tabIcon = (color: ColorValue, focused: boolean, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={[styles.iconSlot, focused && { backgroundColor: isNight ? darkTheme.selection : colors.sageSoft }]}>
      <Ionicons color={color} name={icon} size={22} accessible={false} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isNight ? darkTheme.surface : colors.paper,
          borderTopColor: isNight ? darkTheme.border : colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          display: isTabBarHidden ? 'none' : 'flex',
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ambiente',
          tabBarAccessibilityLabel: 'Ambiente',
          tabBarIcon: ({ color, focused }) => tabIcon(color, focused, focused ? 'home' : 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Biblioteca',
          tabBarAccessibilityLabel: 'Biblioteca',
          tabBarIcon: ({ color, focused }) => tabIcon(color, focused, focused ? 'book' : 'book-outline'),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diário',
          tabBarAccessibilityLabel: 'Diário',
          tabBarIcon: ({ color, focused }) => tabIcon(color, focused, focused ? 'journal' : 'journal-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: ({ color, focused }) => tabIcon(color, focused, focused ? 'person' : 'person-outline'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconSlot: { width: 52, height: 28, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
});
