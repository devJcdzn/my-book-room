import { WALL_PALETTES, FLOOR_PALETTES, RUG_PALETTES, BOOKCASE_PALETTES, CAT_OPTIONS, WINDOW_STYLES, POSTER_FRAME_OPTIONS, PICTURE_FRAME_STYLES } from '../../src/types/room-customization';
import { createDefaultRoomLayout } from '../../src/types/room-layout';
import { READING_FOLDER_COLORS } from '../../src/utils/reading-note';
import { getCurrentLibrarySnapshot, normalizePersistedState } from '../../src/store/library-store';

export function fullLibraryFixture(userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
  const base = getCurrentLibrarySnapshot();
  return normalizePersistedState({
    ...base,
    profile: { name: 'Leitora', bio: 'Minha sala', bioAttribution: 'Eu', avatar: { source: 'custom', version: 'avatar-test', storagePath: `${userId}/avatar-test.jpg` } },
    books: [{ id: 'book-test', source: 'manual', title: 'Livro de teste', author: 'Autora', coverUrl: 'https://example.com/cover.jpg', coverColor: '#336699', totalPages: 321, currentPage: 89, status: 'reading', shelfId: 'reading-test', rating: 4, notes: 'Resenha pessoal', readingEntries: [{ id: 'note-test', title: 'Ideia', text: 'Nota favorita', createdAt: '2026-10-02T10:00:00.000Z', page: 42, isFavorite: true, folderId: 'folder-test' }] }],
    readingFolders: [{ id: 'folder-test', name: 'Ideias', colorId: READING_FOLDER_COLORS[0].id }],
    readingSessions: [{ id: 'session-test', bookId: 'book-test', bookTitle: 'Livro de teste', bookAuthor: 'Autora', coverColor: '#336699', totalPages: 321, name: 'Leitura', description: 'Pela manhã', startingPage: 70, endingPage: 89, pagesRead: 19, startedAt: '2026-10-02T10:00:00.000Z', endedAt: '2026-10-02T10:30:00.000Z', durationSeconds: 1800 }],
    readingDays: ['2026-10-02'], readingShelves: ['reading-test'], shelfNames: { 'reading-test': 'Favoritos' }, deskBookIds: ['book-test'], activeBookId: 'book-test',
    isLampOn: false, ambienceMode: 'night',
    wallPaletteId: WALL_PALETTES.at(-1)!.id, floorPaletteId: FLOOR_PALETTES.at(-1)!.id, rugPaletteId: RUG_PALETTES.at(-1)!.id, bookcasePaletteId: BOOKCASE_PALETTES.at(-1)!.id, catId: CAT_OPTIONS.at(-1)!.id, leftWallItem: 'poster', leftWallWindowStyle: WINDOW_STYLES.at(-1)!.id, leftWallFrameColor: POSTER_FRAME_OPTIONS.at(-1)!.id, pictureFrameSize: '1:1', pictureFrameStyleId: PICTURE_FRAME_STYLES.at(-1)!.id,
    wantToReadShelves: ['want-test'], completedShelves: ['completed-test'], libraryBackgroundId: 'sage',
    roomLayout: { ...base.roomLayout, pieces: createDefaultRoomLayout({ leftWallItem: 'poster', pictureFrameSize: '1:1' }).pieces.map(piece => piece.category === 'frame' ? { ...piece, bookId: undefined, photo: { source: 'custom', version: `photo-${piece.id}`, storagePath: `${userId}/photo-${piece.id}.jpg`, localUri: 'file:///device/photo.jpg', pending: true, previousPath: `${userId}/previous.jpg` }, photoUri: 'file:///device/photo.jpg' } : { ...piece, finish: 'walnut', ...(piece.category === 'cat' ? { position: [2.8, 0, 2.6], rotation: Math.PI / 2 } : {}) }) },
    activeReadingTimer: { id: 'timer-test', bookId: 'book-test', bookTitle: 'Livro de teste', bookAuthor: 'Autora', coverColor: '#336699', totalPages: 321, startingPage: 89, startedAt: '2026-10-02T11:00:00.000Z', phase: 'paused', elapsedMs: 125000 },
    onboardingStatus: 'completed', onboardingStep: 4,
  });
}
