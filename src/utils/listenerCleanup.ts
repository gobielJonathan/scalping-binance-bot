export function createCleanup() {
  const listeners: (() => any)[] = [];

  return {
    registerCleanup(listener: () => any) {
      listeners.push(listener);
    },
    cleanupAll() {
      listeners.forEach((listener) => listener());
      listeners.length = 0;
    },
  };
}

export const listenerCleanup = createCleanup();
