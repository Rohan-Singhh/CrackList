import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  // One read + parse of localStorage, not one per piece of state — two lazy
  // initialisers each calling loadFromStorage() parsed the same JSON twice on
  // every mount.
  const [initial] = useState(loadFromStorage);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set(initial.bookmarked));
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set(initial.solved));

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

  // Memoised: an unmemoised object is a new context value on *every* render of
  // the provider, which re-renders every consumer — including the 40-row
  // company table — even when no bookmark or solved flag actually changed.
  const value = useMemo<LocalProgressValue>(
    () => ({
      bookmarkedIds,
      solvedIds,
      toggleBookmark,
      toggleSolved,
      isBookmarked,
      isSolved,
      bookmarkedCount: bookmarkedIds.size,
      solvedCount: solvedIds.size,
    }),
    [bookmarkedIds, solvedIds, toggleBookmark, toggleSolved, isBookmarked, isSolved],
  );

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
