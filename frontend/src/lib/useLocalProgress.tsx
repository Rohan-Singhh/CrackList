import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'cracklist_progress';

interface ProgressData {
  bookmarked: string[];
  solved: string[];
}

interface LocalProgressValue {
  bookmarkedIds: Set<string>;
  solvedIds: Set<string>;
  toggleBookmark: (id: string) => void;
  toggleSolved: (id: string) => void;
  isBookmarked: (id: string) => boolean;
  isSolved: (id: string) => boolean;
  bookmarkedCount: number;
  solvedCount: number;
}

const LocalProgressContext = createContext<LocalProgressValue | null>(null);

function loadFromStorage(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bookmarked: [], solved: [] };
    const parsed = JSON.parse(raw);
    return {
      bookmarked: Array.isArray(parsed.bookmarked) ? parsed.bookmarked : [],
      solved: Array.isArray(parsed.solved) ? parsed.solved : [],
    };
  } catch {
    return { bookmarked: [], solved: [] };
  }
}

function saveToStorage(bookmarked: Set<string>, solved: Set<string>) {
  const data: ProgressData = {
    bookmarked: [...bookmarked],
    solved: [...solved],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function LocalProgressProvider({ children }: { children: ReactNode }) {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const data = loadFromStorage();
    return new Set(data.bookmarked);
  });
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => {
    const data = loadFromStorage();
    return new Set(data.solved);
  });

  // Persist whenever sets change.
  useEffect(() => {
    saveToStorage(bookmarkedIds, solvedIds);
  }, [bookmarkedIds, solvedIds]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSolved = useCallback((id: string) => {
    setSolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((id: string) => bookmarkedIds.has(id), [bookmarkedIds]);
  const isSolved = useCallback((id: string) => solvedIds.has(id), [solvedIds]);

  const value: LocalProgressValue = {
    bookmarkedIds,
    solvedIds,
    toggleBookmark,
    toggleSolved,
    isBookmarked,
    isSolved,
    bookmarkedCount: bookmarkedIds.size,
    solvedCount: solvedIds.size,
  };

  return (
    <LocalProgressContext.Provider value={value}>
      {children}
    </LocalProgressContext.Provider>
  );
}

export function useLocalProgress() {
  const ctx = useContext(LocalProgressContext);
  if (!ctx) throw new Error('useLocalProgress must be used within LocalProgressProvider');
  return ctx;
}
