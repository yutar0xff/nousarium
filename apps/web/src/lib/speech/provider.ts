import { readStorage, writeStorage } from "../browser-storage";

export const SPEECH_PROVIDER_STORAGE_KEY = "nousarium-speech-provider";
export const SPEECH_PROVIDER_CHANGE_EVENT = "nousarium-speech-provider-change";

export type SpeechProvider = "azure" | "web";

export function readSpeechProvider(): SpeechProvider {
  const value = readStorage(SPEECH_PROVIDER_STORAGE_KEY);
  if (value === "web") return "web";
  return "azure";
}

export function applySpeechProvider(provider: SpeechProvider) {
  writeStorage(SPEECH_PROVIDER_STORAGE_KEY, provider);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SPEECH_PROVIDER_CHANGE_EVENT));
  }
}

export function subscribeSpeechProvider(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SPEECH_PROVIDER_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(SPEECH_PROVIDER_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SPEECH_PROVIDER_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
