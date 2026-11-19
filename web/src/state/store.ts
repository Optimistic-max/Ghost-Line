// One small store: a state object, a pure reducer and subscribers (design 4).
import { type Action, reduce } from './actions';
import type { AppState } from './model';

export type Store = {
  get(): AppState;
  dispatch(action: Action): void;
  /** Called after every change. Returns the unsubscribe function. */
  subscribe(listener: (state: AppState, previous: AppState) => void): () => void;
};

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<(state: AppState, previous: AppState) => void>();
  return {
    get: () => state,
    dispatch(action) {
      const previous = state;
      state = reduce(state, action);
      if (state !== previous) for (const listener of [...listeners]) listener(state, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
