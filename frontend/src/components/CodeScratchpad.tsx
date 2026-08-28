import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

const STORAGE_PREFIX = 'cracklist_scratch:';

type Language = 'python' | 'cpp' | 'java' | 'javascript';
const LANGUAGES: Array<{ id: Language; label: string; starter: string }> = [
  { id: 'python', label: 'Python', starter: '# scratchpad\n\nclass Solution:\n    def solve(self):\n        pass\n' },
  { id: 'cpp', label: 'C++', starter: '// scratchpad\n\nclass Solution {\npublic:\n    void solve() {}\n};\n' },
  { id: 'java', label: 'Java', starter: '// scratchpad\n\nclass Solution {\n    void solve() {}\n}\n' },
  { id: 'javascript', label: 'JavaScript', starter: '// scratchpad\n\nfunction solve() {}\n' },
];

function keyFor(questionId: string, lang: Language) {
  return `${STORAGE_PREFIX}${questionId}:${lang}`;
}

function load(questionId: string, lang: Language): string {
  try {
    const stored = localStorage.getItem(keyFor(questionId, lang));
    if (stored !== null) return stored;
  } catch { /* private mode */ }
  return LANGUAGES.find((l) => l.id === lang)!.starter;
}

/**
 * In-browser code scratchpad. Draft persists in localStorage keyed by
 * questionId + language, so switching language keeps each attempt
 * separately and coming back later restores the last text. No judging,
 * no server round-trip — this is a notepad, not an execution surface.
 */
export function CodeScratchpad({ questionId }: { questionId: string }) {
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState<string>(() => load(questionId, 'python'));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Rehydrate whenever the (question, language) pair changes.
  useEffect(() => {
    setCode(load(questionId, language));
  }, [questionId, language]);

  // Persist changes with a lightweight debounce so we don't hammer
  // localStorage on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(keyFor(questionId, language), code);
        setSavedAt(Date.now());
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [code, questionId, language]);

  const reset = useCallback(() => {
    const starter = LANGUAGES.find((l) => l.id === language)!.starter;
    setCode(starter);
    try { localStorage.removeItem(keyFor(questionId, language)); } catch { /* ignore */ }
  }, [questionId, language]);

  const savedLabel = useMemo(() => {
    if (!savedAt) return '';
    const secs = Math.max(1, Math.round((Date.now() - savedAt) / 1000));
    return secs < 5 ? '· saved' : '';
  }, [savedAt]);

  const handleMount: OnMount = (editor) => { editorRef.current = editor; };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Scratchpad</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLanguage(l.id)}
              className="btn btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                borderColor: language === l.id ? 'var(--color-accent)' : undefined,
                color: language === l.id ? 'var(--color-accent)' : undefined,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
          <span>saved on this device {savedLabel}</span>
          <button
            type="button"
            onClick={reset}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            reset
          </button>
        </div>
      </div>
      <div style={{ border: '1px solid var(--color-divider)', height: 360 }}>
        <Editor
          height="360px"
          language={language}
          value={code}
          onChange={(v) => setCode(v ?? '')}
          onMount={handleMount}
          options={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
          }}
          loading={<div style={{ padding: 16, fontSize: 12, opacity: 0.6 }}>Loading editor…</div>}
        />
      </div>
    </div>
  );
}
