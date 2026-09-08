import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { colors, radii } from '@/src/theme';
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
            <Text selectable numberOfLines={1} style={styles.title}>{book.title}</Text>
            <Text selectable numberOfLines={1} style={styles.author}>{book.author}</Text>
          </View>
          <Text selectable style={styles.percent}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : <Text selectable style={styles.percent}>{Math.round(progress * 100)}%</Text>}
      <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
      {book.status === 'completed' ? (
        <Text selectable style={styles.completed}>Concluído · {book.totalPages} páginas</Text>
      ) : (
        <>
          <View style={styles.pageRow}>
            <Pressable accessibilityLabel="Diminuir dez páginas" accessibilityRole="button" disabled={!canEdit} onPress={() => step(-10)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
              <Text style={styles.stepLabel}>−10</Text>
            </Pressable>
            <View style={styles.pageInputWrap}>
              <TextInput accessibilityLabel={`Página atual de ${book.title}`} editable={canEdit} keyboardType="number-pad" maxLength={5} onBlur={() => commitPage()} onChangeText={setDraftPage} onSubmitEditing={() => commitPage()} selectTextOnFocus style={styles.pageInput} value={pageText} />
              <Text selectable style={styles.pageTotal}>de {book.totalPages}</Text>
            </View>
            <Pressable accessibilityLabel="Avançar dez páginas" accessibilityRole="button" disabled={!canEdit} onPress={() => step(10)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
              <Text style={styles.stepLabel}>+10</Text>
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
  track: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.line },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.terracotta },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { minWidth: 54, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.small, borderCurve: 'continuous', backgroundColor: colors.sageSoft },
  pressed: { opacity: 0.7 },
  stepLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  pageInputWrap: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radii.small, borderCurve: 'continuous', backgroundColor: colors.white },
  pageInput: { minWidth: 38, color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  pageTotal: { color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  completed: { color: colors.sage, fontSize: 15, fontWeight: '700' },
});
