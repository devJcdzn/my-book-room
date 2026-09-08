import { useCallback, useEffect, useRef, useState } from 'react';

import { mergeUniqueResults, openLibraryClient } from '@/src/services/open-library';
import type { BookSearchResult } from '@/src/types/book';

export type BookSearchStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'loadingMore'
  | 'empty'
  | 'error';

const messageForError = (error: unknown) => {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'A Open Library demorou para responder. Tente novamente.';
  }
  return 'Não foi possível carregar o catálogo agora.';
};

export const useBookSearch = (query: string) => {
  const normalizedQuery = query.trim();
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [status, setStatus] = useState<BookSearchStatus>('idle');
  const [error, setError] = useState<string>();
  const [loadMoreError, setLoadMoreError] = useState<string>();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const activeController = useRef<AbortController | undefined>(undefined);

  const isSingleChar = normalizedQuery.length === 1;

  useEffect(() => {
    activeController.current?.abort();

    if (normalizedQuery.length === 1) {
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    const run = async () => {
      setLoadMoreError(undefined);
      setStatus('loading');
      setError(undefined);
      setResults([]);
      try {
        const response = normalizedQuery.length >= 2
          ? await openLibraryClient.searchBooks(normalizedQuery, 1, controller.signal)
          : await openLibraryClient.trendingBooks(1, controller.signal);
        if (controller.signal.aborted) return;
        setResults(response.results);
        setPage(1);
        setHasMore(response.hasMore);
        setStatus(response.results.length ? 'success' : 'empty');
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(messageForError(requestError));
        setStatus('error');
      }
    };

    const timer = setTimeout(run, normalizedQuery.length >= 2 ? 600 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, retryToken]);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  const loadMore = useCallback(async () => {
    if (!hasMore || status === 'loadingMore') return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setStatus('loadingMore');
    setLoadMoreError(undefined);
    try {
      const nextPage = page + 1;
      const response = normalizedQuery.length >= 2
        ? await openLibraryClient.searchBooks(normalizedQuery, nextPage, controller.signal)
        : await openLibraryClient.trendingBooks(nextPage, controller.signal);
      if (controller.signal.aborted) return;
      setResults((current) => mergeUniqueResults(current, response.results));
      setPage(nextPage);
      setHasMore(response.hasMore);
      setStatus('success');
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setLoadMoreError(messageForError(requestError));
      setStatus('success');
    }
  }, [hasMore, normalizedQuery, page, status]);

  return {
    error: isSingleChar ? undefined : error,
    hasMore: isSingleChar ? false : hasMore,
    loadMore,
    loadMoreError,
    results: isSingleChar ? [] : results,
    retry,
    status: isSingleChar ? 'idle' : status,
  };
};
