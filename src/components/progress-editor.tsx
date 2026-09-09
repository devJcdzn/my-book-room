import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';
import type { Book } from '@/src/types/book';

type Props = {
  book: Book;
  completionLocked: boolean;
  showIdentity?: boolean;
  onChangePage: (page: number) => void;
  onComplete: () => void;
};

export function ProgressEditor({ book, completionLocked, showIdentity = true, onChangePage, onComplete }: Props) {
  const [draftPage, setDraftPage] = useState<string>();
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const pageText = draftPage ?? String(book.currentPage);
  const progress = book.totalPages > 0 ? Math.min(1, Math.max(0, book.currentPage / book.totalPages)) : 0;
  const canEdit = book.status === 'reading';

  const commitPage = (value = pageText) => {
    const parsed = Number(value.replace(/\D/g, ''));
    const next = Number.isFinite(parsed) ? Math.min(book.totalPages, Math.max(0, parsed)) : book.currentPage;
    onChangePage(next);
    setDraftPage(undefined);
  };

  const step = (amount: number) => {
    const next = Math.min(book.totalPages, Math.max(0, book.currentPage + amount));
    setDraftPage(undefined);
    onChangePage(next);
  };

  return (
    <View style={styles.container}>
      {showIdentity ? (
        <View style={styles.headingRow}>
          <View style={styles.titleBlock}>
            <Text selectable numberOfLines={1} style={[styles.title, isNight && styles.darkText]}>{book.title}</Text>
            <Text selectable numberOfLines={1} style={[styles.author, isNight && styles.darkMutedText]}>{book.author}</Text>
          </View>
          <Text selectable style={[styles.percent, isNight && styles.darkPercent]}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : (
        <View style={styles.progressLabelRow}>
          <Text selectable style={[styles.pagesReadLabel, isNight && styles.darkMutedText]}>
            {book.currentPage} de {book.totalPages} páginas
          </Text>
          <Text selectable style={[styles.percent, isNight && styles.darkPercent]}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
      <View style={[styles.track, isNight && styles.darkTrack]}>
        <View style={[styles.fill, isNight && styles.darkFill, { width: `${progress * 100}%` }]} />
      </View>
      {book.status === 'completed' ? (
        <Text selectable style={styles.completed}>Leitura concluída · {book.totalPages} páginas</Text>
      ) : (
        <>
          <View style={styles.pageRow}>
            <Pressable
              accessibilityLabel="Diminuir dez páginas"
              accessibilityRole="button"
              disabled={!canEdit}
              onPress={() => step(-10)}
              style={({ pressed }) => [
                styles.stepButton,
                isNight && styles.darkStepButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.stepLabel, isNight && styles.darkText]}>−10</Text>
            </Pressable>
            <View style={[styles.pageInputWrap, isNight && styles.darkPageInputWrap]}>
              <TextInput
                accessibilityLabel={`Página atual de ${book.title}`}
                editable={canEdit}
                keyboardType="number-pad"
                maxLength={5}
                onBlur={() => commitPage()}
                onChangeText={setDraftPage}
                onSubmitEditing={() => commitPage()}
                selectTextOnFocus
                style={[styles.pageInput, isNight && styles.darkText]}
                value={pageText}
              />
              <Text selectable style={[styles.pageTotal, isNight && styles.darkMutedText]}>/ {book.totalPages}</Text>
            </View>
            <Pressable
              accessibilityLabel="Avançar dez páginas"
              accessibilityRole="button"
              disabled={!canEdit}
              onPress={() => step(10)}
              style={({ pressed }) => [
                styles.stepButton,
                isNight && styles.darkStepButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.stepLabel, isNight && styles.darkText]}>+10</Text>
            </Pressable>
          </View>
          <PrimaryButton
            disabled={completionLocked || !canEdit}
            label={book.status === 'completing' ? 'Guardando…' : 'Concluir leitura'}
            loading={book.status === 'completing'}
            onPress={onComplete}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  author: { color: colors.muted, fontSize: 13 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pagesReadLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  percent: { color: colors.terracotta, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  darkPercent: { color: '#FFAE70' },
  track: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.softFill },
  darkTrack: { backgroundColor: '#25293A' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.terracotta },
  darkFill: { backgroundColor: '#FFAE70' },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: {
    minWidth: 50,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
  },
  darkStepButton: { backgroundColor: darkTheme.surfaceElevated },
  pressed: { opacity: 0.7 },
  stepLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pageInputWrap: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.small,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
  },
  darkPageInputWrap: { backgroundColor: darkTheme.surfaceElevated },
  pageInput: {
    minWidth: 40,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  pageTotal: { color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  completed: { color: colors.sage, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
  darkText: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
});
