import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';
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
  const progress = book.currentPage / book.totalPages;
  const canEdit = book.status === 'reading';

  const commitPage = (value = pageText) => {
    const parsed = Number(value.replace(/\D/g, ''));
    const next = Number.isFinite(parsed) ? parsed : book.currentPage;
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
      ) : <Text selectable style={[styles.percent, isNight && styles.darkPercent]}>{Math.round(progress * 100)}%</Text>}
      <View style={[styles.track, isNight && styles.darkTrack]}>
        <View style={[styles.fill, isNight && styles.darkFill, { width: `${progress * 100}%` }]} />
      </View>
      {book.status === 'completed' ? (
        <Text selectable style={styles.completed}>Concluído · {book.totalPages} páginas</Text>
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
              <Text selectable style={[styles.pageTotal, isNight && styles.darkMutedText]}>de {book.totalPages}</Text>
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
          <PrimaryButton disabled={completionLocked || !canEdit} label={book.status === 'completing' ? 'Guardando…' : 'Concluir livro'} loading={book.status === 'completing'} onPress={onComplete} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  author: { color: colors.muted, fontSize: 14 },
  percent: { color: colors.terracottaDark, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  darkPercent: { color: '#FFAE70' },
  track: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.line },
  darkTrack: { backgroundColor: '#2C3044' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.terracotta },
  darkFill: { backgroundColor: '#FFAE70' },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { minWidth: 54, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.small, borderCurve: 'continuous', backgroundColor: colors.sageSoft },
  darkStepButton: { backgroundColor: '#25293A' },
  pressed: { opacity: 0.7 },
  stepLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  pageInputWrap: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radii.small, borderCurve: 'continuous', backgroundColor: colors.white },
  darkPageInputWrap: { backgroundColor: darkTheme.inputBg, borderColor: darkTheme.border },
  pageInput: { minWidth: 38, color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  pageTotal: { color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  completed: { color: colors.sage, fontSize: 15, fontWeight: '700' },
  darkText: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
});
