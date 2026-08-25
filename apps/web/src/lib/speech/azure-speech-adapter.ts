import { api } from "../api";
import type { SpeechInputController, SpeechInputHandlers } from "./types";

type SpeechTokenPayload = {
  token: string;
  region: string;
  language: string;
};

type SpeechSdk = typeof import("microsoft-cognitiveservices-speech-sdk");

export async function probeAzureSpeechAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/backend/health");
    if (!response.ok) return false;
    const body = (await response.json()) as { azureSpeech?: boolean };
    return Boolean(body.azureSpeech);
  } catch {
    return false;
  }
}

export function createAzureSpeechAdapter(): SpeechInputController {
  let recognizer: InstanceType<SpeechSdk["SpeechRecognizer"]> | null = null;
  let handlers: SpeechInputHandlers | null = null;
  let finals = "";
  let ended = true;
  let startGeneration = 0;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  function clearStopTimer() {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
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
    const current = recognizer;
    recognizer = null;
    if (current) {
      try {
        current.close();
      } catch {
        // ignore
      }
    }
    const onEnd = handlers?.onEnd;
    clearHandlers();
    onEnd?.();
  }

  function fail(message: string) {
    ended = true;
    clearStopTimer();
    const current = recognizer;
    recognizer = null;
    if (current) {
      try {
        current.close();
      } catch {
        // ignore
      }
    }
    const onError = handlers?.onError;
    clearHandlers();
    onError?.(message);
  }

  return {
    supported: true,
    start(nextHandlers) {
      const generation = ++startGeneration;
      clearStopTimer();
      handlers = nextHandlers;
      finals = "";
      ended = false;
      recognizer = null;

      void (async () => {
        try {
          const payload = await api<SpeechTokenPayload>("/speech/token");
          if (generation !== startGeneration) return;

          const {
            AudioConfig,
            CancellationReason,
            ResultReason,
            SpeechConfig,
            SpeechRecognizer,
          } = await import("microsoft-cognitiveservices-speech-sdk");

          if (generation !== startGeneration) return;

          const speechConfig = SpeechConfig.fromAuthorizationToken(payload.token, payload.region);
          speechConfig.speechRecognitionLanguage = payload.language;
          const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
          const next = new SpeechRecognizer(speechConfig, audioConfig);
          recognizer = next;

          next.recognizing = (_sender, event) => {
            if (ended || generation !== startGeneration) return;
            if (event.result.reason !== ResultReason.RecognizingSpeech) return;
            handlers?.onResult({ transcript: finals, interim: event.result.text ?? "" });
          };

          next.recognized = (_sender, event) => {
            if (ended || generation !== startGeneration) return;
            if (event.result.reason !== ResultReason.RecognizedSpeech) return;
            const text = event.result.text?.trim() ?? "";
            if (!text) return;
            finals = `${finals}${text}`;
            handlers?.onResult({ transcript: finals, interim: "" });
          };

          next.canceled = (_sender, event) => {
            if (generation !== startGeneration) return;
            if (event.reason === CancellationReason.Error) {
              fail(event.errorDetails?.trim() || "音声入力に失敗しました");
              return;
            }
            finish();
          };

          next.sessionStopped = () => {
            if (generation !== startGeneration) return;
            finish();
          };

          next.startContinuousRecognitionAsync(
            () => {
              // started
            },
            (error) => {
              if (generation !== startGeneration) return;
              fail(typeof error === "string" && error.trim() ? error : "音声入力を開始できませんでした");
            },
          );
        } catch {
          if (generation !== startGeneration) return;
          fail("Azure 音声認識を開始できませんでした。設定と接続を確認してください");
        }
      })();
    },
    stop() {
      startGeneration += 1;
      if (ended || !recognizer) {
        clearStopTimer();
        if (handlers) {
          const onEnd = handlers.onEnd;
          clearHandlers();
          ended = true;
          onEnd();
        }
        return;
      }
      const current = recognizer;
      current.stopContinuousRecognitionAsync(
        () => {
          finish();
        },
        () => {
          finish();
        },
      );
      clearStopTimer();
      stopTimer = setTimeout(() => {
        if (!ended) finish();
      }, 800);
    },
  };
}
