/**
 * hooks.jsx — 여러 컴포넌트에서 재사용하는 커스텀 훅 모음.
 *
 * useUndo: 토스트 형태의 실행취소 스택(5초 후 자동 만료).
 * useSwipeCal: 캘린더 좌우 스와이프로 이전/다음 이동.
 * useDragSort: 목록 항목 드래그 앤 드롭 정렬.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { uid, vib } from './utils.js';

// useUndo — 실행취소 가능한 액션을 쌓아두고 5초 뒤 자동 제거. pushUndo(label, fn)로 등록.
const useUndo = () => {
  const [undoStack, setUndoStack] = useState([]);
  const pushUndo = useCallback((label, fn) => {
    const id = uid();
    setUndoStack(s => [...s, { id, label, fn }]);
    // 5초가 지나면 사용자가 되돌리지 않은 것으로 보고 스택에서 만료시킨다
    setTimeout(() => setUndoStack(s => s.filter(u => u.id !== id)), 5000);
  }, []);
  const execUndo = useCallback((id) => {
    const item = undoStack.find(u => u.id === id);
    if (item) { item.fn(); setUndoStack(s => s.filter(u => u.id !== id)); }
  }, [undoStack]);
  return { undoStack, pushUndo, execUndo };
};

// useSwipeCal — 반환된 ref를 붙인 엘리먼트에서 좌우 스와이프 시 onPrev/onNext 호출.
const useSwipeCal = (onPrev, onNext) => {
  const ref = useRef(null);
  const touch = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onEnd = (e) => {
      if (!touch.current) return;
      const dx = e.changedTouches[0].clientX - touch.current.x;
      const dy = Math.abs(e.changedTouches[0].clientY - touch.current.y);
      // 가로 이동 50px 이상 + 세로 흔들림 60px 미만일 때만 스와이프로 인정(세로 스크롤 오작동 방지)
      if (Math.abs(dx) > 50 && dy < 60) {
        if (dx < 0) onNext(); else onPrev();
        vib(20);
      }
      touch.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [onPrev, onNext]);
  return ref;
};

// useDragSort — 데스크톱(HTML5 DnD)과 모바일(터치) 모두 지원하는 드래그 정렬 핸들러.
// 각 항목에 spread하면 되며, 반드시 data-drag-idx 속성이 DOM에 기록된다.
const useDragSort = (items, onReorder) => {
  const dr = useRef({ from: null, to: null });
  const cleanupRef = useRef(null);
  const itemsRef = useRef(items);
  const reorderRef = useRef(onReorder);
  itemsRef.current = items;
  reorderRef.current = onReorder;

  const stopTouch = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const commit = useCallback(() => {
    stopTouch();
    const { from, to } = dr.current;
    dr.current = { from: null, to: null };
    if (from === null || to === null || from === to) return;
    const arr = [...itemsRef.current];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    reorderRef.current(arr);
    vib(15);
  }, [stopTouch]);

  return (idx) => ({
    draggable: true,
    'data-drag-idx': String(idx),
    // 데스크톱 DnD
    onDragStart: () => { dr.current = { from: idx, to: idx }; },
    onDragOver: (e) => { e.preventDefault(); dr.current.to = idx; },
    onDrop: (e) => { e.preventDefault(); commit(); },
    onDragEnd: () => { dr.current = { from: null, to: null }; },
    // 터치 (Android / iOS)
    onTouchStart: () => {
      dr.current = { from: idx, to: idx };
      const onMove = (e) => {
        if (dr.current.from === null) return;
        e.preventDefault(); // 드래그 중 스크롤 방지 (non-passive)
        const t = e.touches[0];
        let el = document.elementFromPoint(t.clientX, t.clientY);
        while (el && el.dataset?.dragIdx === undefined) el = el.parentElement;
        if (el?.dataset?.dragIdx !== undefined) {
          dr.current.to = parseInt(el.dataset.dragIdx);
        }
      };
      document.addEventListener('touchmove', onMove, { passive: false });
      cleanupRef.current = () => document.removeEventListener('touchmove', onMove);
    },
    onTouchEnd: commit,
    onTouchCancel: () => { stopTouch(); dr.current = { from: null, to: null }; },
  });
};

export { useUndo, useSwipeCal, useDragSort };
