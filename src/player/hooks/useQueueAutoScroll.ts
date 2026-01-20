import { useEffect, useRef } from 'react';

export function useQueueAutoScroll(open: boolean, activeIndex: number, totalCount: number) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const activeEl = itemRefs.current[activeIndex];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
      return;
    }
    const listEl = listRef.current;
    if (listEl) listEl.scrollTop = 0;
  }, [open, activeIndex, totalCount]);

  return { listRef, itemRefs };
}
