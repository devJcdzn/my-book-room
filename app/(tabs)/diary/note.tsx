import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useContext } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { ScreenHeader } from '@/src/components/screen-header';
import { DiaryEntryForm } from '@/src/components/diary-entry-form';
import { TabBarContext } from '@/src/context/tab-bar-context';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme } from '@/src/theme';
import { READING_NOTE_COLORS } from '@/src/utils/reading-note';

export default function DiaryNoteScreen() {
  const { bookId, entryId, color, folderId } = useLocalSearchParams<{ bookId?: string; entryId?: string; color?: string; folderId?: string }>();
  const books = useLibraryStore((state) => state.books);
  const removeEntry = useLibraryStore((state) => state.removeReadingEntry);
  const entry = books.flatMap((book) => book.readingEntries ?? []).find((item) => item.id === entryId);
  const entryBook = books.find((book) => book.readingEntries?.some((item) => item.id === entryId));
  const routeColor = READING_NOTE_COLORS.includes(color as typeof READING_NOTE_COLORS[number]) ? color : undefined;
  const initialColor = entry?.color ?? routeColor ?? READING_NOTE_COLORS[0];
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const background = isNight ? darkTheme.bg : colors.cream;
  const accent = isNight ? darkTheme.accent : colors.terracottaDark;
  const { setIsTabBarHidden } = useContext(TabBarContext);

  useFocusEffect(useCallback(() => {
    setIsTabBarHidden(true);
    return () => setIsTabBarHidden(false);
  }, [setIsTabBarHidden]));

  const handleDelete = () => {
    if (!entryId || !entryBook) return;
    Alert.alert('Excluir nota', 'Esta nota será removida do seu diário.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        removeEntry(entryBook.id, entryId);
        router.back();
      } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={entryId ? 'Editar nota' : 'Nova nota'}
        isNight={isNight}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/diary')}
        right={entryId ? (
          <Pressable accessibilityLabel="Excluir nota" accessibilityRole="button" onPress={handleDelete} style={styles.deleteButton}>
            <Ionicons color={accent} name="trash-outline" size={21} />
          </Pressable>
        ) : undefined}
      />
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <DiaryEntryForm
        key={entryId ?? 'new-note'}
        bookId={bookId}
        entryId={entryId}
        folderId={folderId}
        initialColor={initialColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deleteButton: { ...controls.iconButton },
});
