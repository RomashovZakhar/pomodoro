import {
  BaseDirectory,
  exists,
  readTextFile,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { initialState } from "../domain/timer";
import type { TimerState } from "../domain/types";

const STORAGE_VERSION = 1;
const POMODORO_FILE = "pomodoro.json";
const POMODORO_TEMP_FILE = "pomodoro.json.tmp";

interface PersistedFile {
  version: number;
  state: TimerState;
}

export interface Store {
  load(): Promise<TimerState>;
  save(state: TimerState): Promise<void>;
}

export function serialize(state: TimerState): string {
  const payload: PersistedFile = { version: STORAGE_VERSION, state };
  return JSON.stringify(payload);
}

export function deserialize(raw: string): TimerState {
  if (raw === "") {
    throw new Error("storage file is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("storage file is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("storage file has invalid shape");
  }

  const file = parsed as Partial<PersistedFile>;
  if (file.version !== STORAGE_VERSION) {
    throw new Error(`unsupported storage version ${String(file.version)}`);
  }

  if (!file.state || typeof file.state !== "object") {
    throw new Error("storage file is missing state");
  }

  return file.state as TimerState;
}

export function createMemoryStore(seed?: TimerState): Store {
  let current: TimerState | undefined = seed;

  return {
    async load() {
      return structuredClone(current ?? initialState());
    },
    async save(state: TimerState) {
      current = structuredClone(state);
    },
  };
}

export function createTauriStore(): Store {
  return {
    async load() {
      const present = await exists(POMODORO_FILE, {
        baseDir: BaseDirectory.AppData,
      });
      if (!present) {
        return initialState();
      }

      const raw = await readTextFile(POMODORO_FILE, {
        baseDir: BaseDirectory.AppData,
      });
      return deserialize(raw);
    },
    async save(state: TimerState) {
      const raw = serialize(state);
      await writeTextFile(POMODORO_TEMP_FILE, raw, {
        baseDir: BaseDirectory.AppData,
      });
      await rename(POMODORO_TEMP_FILE, POMODORO_FILE, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      });
    },
  };
}