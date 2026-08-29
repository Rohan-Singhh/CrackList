import { useEffect } from 'react';

// Prerendered pages ship a correct <title>/description in their static
// HTML, but that only covers the very first load — clicking to another
// question is a client-side route change and React never touches
// document.title on its own, so the tab would keep showing whatever page
// you loaded first. This keeps both in sync on every route change.
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    let meta: HTMLMetaElement | null = null;
    let prevDescription: string | null = null;
    if (description) {
      meta = document.querySelector('meta[name="description"]');
      if (meta) {
        prevDescription = meta.getAttribute('content');
        meta.setAttribute('content', description);
      }
    }
    return () => {
      document.title = prevTitle;
      if (meta && prevDescription !== null) meta.setAttribute('content', prevDescription);
    };
  }, [title, description]);
}
