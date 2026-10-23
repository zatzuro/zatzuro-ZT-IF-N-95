import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class TestResizeObserver implements ResizeObserver {
  observe(target: Element) { this.callback([{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this); }
  unobserve() {}
  disconnect() {}
  constructor(private callback: ResizeObserverCallback) {}
}
globalThis.ResizeObserver = TestResizeObserver;
afterEach(cleanup);
