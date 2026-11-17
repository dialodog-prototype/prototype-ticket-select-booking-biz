export function readJsonStorage(storageKey, fallbackValue) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      return storedValue ? JSON.parse(storedValue) : fallbackValue;
    } catch (error) {
      if (attempt === 0) reportStorageFailure("read", storageKey);
      else throw new StorageOperationError(error);
    }
  }
}

export function writeJsonStorage(storageKey, value) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    reportStorageFailure("write", storageKey);
    throw new StorageOperationError(error);
  }
}

class StorageOperationError extends Error {
  constructor(cause) {
    super("Prototype storage operation failed", { cause });
    this.name = "StorageOperationError";
    this.isPrototypeOperationError = true;
  }
}

function reportStorageFailure(operation, storageKey) {
  window.dispatchEvent?.(new CustomEvent("prototype:operation-failed", { detail: { operation, storageKey } }));
}
