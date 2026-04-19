import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 4.x passes --localstorage-file to jsdom without a valid path, which
// produces a non-standard Storage implementation that is missing .clear().
// Replace it with a reliable in-memory mock.
const _store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => _store[key] ?? null,
  setItem: (key, value) => { _store[key] = String(value); },
  removeItem: (key) => { delete _store[key]; },
  clear: () => { Object.keys(_store).forEach((k) => delete _store[k]); },
  get length() { return Object.keys(_store).length; },
  key: (i) => Object.keys(_store)[i] ?? null,
};
Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true, configurable: true });

// requestAnimationFrame in jsdom fires ~16 ms after scheduling. In async
// userEvent interactions this races with focus management: the component's
// RAF that auto-focuses the search input can fire between userEvent's internal
// click (which focuses the target element) and the first keydown, sending the
// first characters to the wrong input. Make RAF a no-op so component focus
// side-effects don't interfere with pointer/keyboard event sequences.
vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(0));
vi.stubGlobal("cancelAnimationFrame", vi.fn());

afterEach(() => {
  cleanup();
  localStorageMock.clear();
});
