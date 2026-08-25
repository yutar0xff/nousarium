import type { SpeechInputController, SpeechInputHandlers } from "./types";

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function isWebSpeechSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/** Brave exposes SpeechRecognition but does not connect to Google's speech service. */
export function isBraveBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
  return Boolean(nav.brave);
}

const BRAVE_SPEECH_MESSAGE =
  "Brave ではブラウザ内蔵の音声認識を使えません。Google Chrome で開くか、設定で Azure Speech を選んでください";

function messageForError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの使用が許可されていません。ブラウザのサイト設定でマイクを許可してください";
    case "audio-capture":
      return "マイクを利用できません。接続と OS の設定を確認してください";
    case "network":
      if (isBraveBrowser()) return BRAVE_SPEECH_MESSAGE;
      return "音声認識サービスに接続できませんでした。Google Chrome で開き直すか、ネットワークを確認してください";
    case "language-not-supported":
      return "この言語の音声認識には対応していません";
    default:
      return "音声入力に失敗しました";
  }
}

async function ensureMicrophoneAccess(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function createWebSpeechAdapter(language = "ja-JP"): SpeechInputController {
  let recognition: BrowserSpeechRecognition | null = null;
  let handlers: SpeechInputHandlers | null = null;
  let shouldRestart = false;
  let finals = "";
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let ended = true;
  let startGeneration = 0;

  function clearStopTimer() {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
  }

  function clearRestartTimer() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function clearHandlers() {
    handlers = null;
  }

  function finish() {
    if (ended) {
      clearHandlers();
      return;
    }
    ended = true;
    clearStopTimer();
    clearRestartTimer();
    shouldRestart = false;
    recognition = null;
    const onEnd = handlers?.onEnd;
    clearHandlers();
    onEnd?.();
  }

  function fail(message: string) {
    ended = true;
    clearStopTimer();
    clearRestartTimer();
    shouldRestart = false;
    recognition = null;
    const onError = handlers?.onError;
    clearHandlers();
    onError?.(message);
  }

  function bind(instance: BrowserSpeechRecognition, generation: number) {
    instance.lang = language;
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onresult = (event) => {
      if (ended || generation !== startGeneration) return;
      let interim = "";
      let newlyFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) newlyFinal += text;
        else interim += text;
      }
      if (newlyFinal) {
        finals = `${finals}${newlyFinal}`;
      }
      handlers?.onResult({ transcript: finals, interim });
    };

    instance.onerror = (event) => {
      if (generation !== startGeneration) return;
      const code = event.error ?? "unknown";
      if (code === "aborted" || code === "no-speech") return;
      fail(messageForError(code));
    };

    instance.onend = () => {
      if (generation !== startGeneration) return;
      if (!shouldRestart || ended) {
        finish();
        return;
      }
      clearRestartTimer();
      restartTimer = setTimeout(() => {
        restartTimer = null;
        if (!shouldRestart || ended || !recognition || generation !== startGeneration) {
          finish();
          return;
        }
        try {
          recognition.start();
        } catch {
          fail("音声入力を再開できませんでした");
        }
      }, 250);
    };
  }

  function beginRecognition(generation: number) {
    if (generation !== startGeneration) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      fail("このブラウザでは音声入力に対応していません");
      return;
    }

    finals = "";
    shouldRestart = true;
    ended = false;
    clearStopTimer();
    clearRestartTimer();

    recognition = new Ctor();
    bind(recognition, generation);
    try {
      recognition.start();
    } catch {
      fail("音声入力を開始できませんでした");
    }
  }

  return {
    get supported() {
      return Boolean(getSpeechRecognitionCtor());
    },
    start(nextHandlers) {
      if (isBraveBrowser()) {
        nextHandlers.onError(BRAVE_SPEECH_MESSAGE);
        return;
      }

      const generation = ++startGeneration;
      clearStopTimer();
      clearRestartTimer();
      shouldRestart = false;
      handlers = nextHandlers;
      finals = "";
      ended = false;

      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
        recognition = null;
      }

      void (async () => {
        try {
          await ensureMicrophoneAccess();
        } catch (error) {
          if (generation !== startGeneration) return;
          const name =
            error && typeof error === "object" && "name" in error
              ? String((error as { name?: string }).name)
              : "";
          if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            fail("マイクが見つかりません");
            return;
          }
          if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            fail(messageForError("not-allowed"));
            return;
          }
          fail(messageForError("audio-capture"));
          return;
        }
        beginRecognition(generation);
      })();
    },
    stop() {
      startGeneration += 1;
      shouldRestart = false;
      clearRestartTimer();
      if (ended || !recognition) {
        clearStopTimer();
        if (handlers) {
          const onEnd = handlers.onEnd;
          clearHandlers();
          ended = true;
          onEnd();
        }
        return;
      }
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          finish();
          return;
        }
      }
      clearStopTimer();
      stopTimer = setTimeout(() => {
        finish();
      }, 500);
    },
  };
}
