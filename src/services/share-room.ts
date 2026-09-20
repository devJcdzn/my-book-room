import type { Book } from '@/src/types/book';

export type ReadingStats = {
  readerName: string;
  totalPagesRead: number;
  completedCount: number;
  readingCount: number;
  totalBooks: number;
  activeBook: Book | null;
  activeBookProgress: number;
  readingBooks: Book[];
};

export const computeReadingStats = (
  books: Book[],
  readerName = 'Leitor(a)',
  activeBookId?: string,
): ReadingStats => {
  const completedBooks = books.filter((b) => b.status === 'completed');
  const readingBooks = books.filter((b) => b.status === 'reading');

  const totalPagesRead = books.reduce((acc, b) => {
    if (b.status === 'completed') {
      return acc + (b.totalPages || 0);
    }
    return acc + Math.min(b.currentPage || 0, b.totalPages || 0);
  }, 0);

  const activeBook =
    books.find((b) => b.id === activeBookId && b.status === 'reading') ??
    readingBooks[readingBooks.length - 1] ??
    books[0] ??
    null;

  let activeBookProgress = 0;
  if (activeBook && activeBook.totalPages > 0) {
    if (activeBook.status === 'completed') {
      activeBookProgress = 100;
    } else {
      activeBookProgress = Math.min(
        100,
        Math.max(0, Math.round((activeBook.currentPage / activeBook.totalPages) * 100)),
      );
    }
  }

  return {
    readerName: readerName.trim() || 'Leitor(a)',
    totalPagesRead,
    completedCount: completedBooks.length,
    readingCount: readingBooks.length,
    totalBooks: books.length,
    activeBook,
    activeBookProgress,
    readingBooks,
  };
};

export const formatReadingStatsSummary = (stats: ReadingStats): string => {
  const lines = [
    `📚 Meu Refúgio de Leitura no Bookroom`,
    ``,
    `👤 Leitor(a): ${stats.readerName}`,
    `📄 ${stats.totalPagesRead.toLocaleString('pt-BR')} páginas lidas`,
    `✨ ${stats.completedCount} ${stats.completedCount === 1 ? 'livro concluído' : 'livros concluídos'}`,
  ];

  if (stats.activeBook) {
    lines.push(
      `⏳ Lendo agora: "${stats.activeBook.title}" (${stats.activeBookProgress}% concluído)`,
    );
  }

  lines.push(``, `Construa seu hábito de leitura no Bookroom ☕✨`);

  return lines.join('\n');
};

export const shareToInstagramOrSystem = async ({
  imageUri,
  message,
}: {
  imageUri?: string | null;
  message?: string;
}): Promise<boolean> => {
  try {
    const { Share, Platform } = await import('react-native');
    const title = 'Meu Refúgio de Leitura • Bookroom';

    const payload = imageUri
      ? Platform.OS === 'ios'
        ? { url: imageUri, title }
        : { message: message ? `${message}\n\n${imageUri}` : imageUri, title }
      : { message: message ?? '', title };

    const result = await Share.share(payload, {
      dialogTitle: 'Compartilhar Refúgio de Leitura',
      subject: title,
    });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.warn('Erro ao compartilhar:', error);
    return false;
  }
};

export const canOpenInstagram = async (): Promise<boolean> => {
  try {
    const Linking = await import('expo-linking');
    const supported = await Linking.canOpenURL('instagram://app');
    return supported;
  } catch {
    return false;
  }
};
