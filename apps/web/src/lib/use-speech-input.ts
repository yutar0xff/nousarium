"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAzureSpeechAdapter, probeAzureSpeechAvailable } from "./speech/azure-speech-adapter";
import {
  readSpeechProvider,
  subscribeSpeechProvider,
  type SpeechProvider,
} from "./speech/provider";
import type { SpeechInputController } from "./speech/types";
import { createWebSpeechAdapter, isWebSpeechSupported } from "./speech/web-speech-adapter";

function joinSpeech(base: string, spoken: string): string {
  const left = base.trimEnd();
  const right = spoken.trim();
  if (!left) return right;
  if (!right) return left;
  const needsSpace = !/\s$/.test(left) && !/^[、。，．,.!?？！]/.test(right);
  return `${left}${needsSpace ? " " : ""}${right}`;
}

function createAdapter(provider: SpeechProvider): SpeechInputController {
  return provider === "web" ? createWebSpeechAdapter() : createAzureSpeechAdapter();
}

async function probeSupported(provider: SpeechProvider): Promise<boolean> {
  if (provider === "web") return isWebSpeechSupported();
  return probeAzureSpeechAvailable();
}

export function useSpeechInput(options?: {
  onError?: (message: string) => void;
}) {
  const [provider, setProvider] = useState<SpeechProvider>("azure");
  const [supported, setSupported] = useState(false);
  const adapterRef = useRef<SpeechInputController | null>(null);
  const onErrorRef = useRef(options?.onError);
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const [baseText, setBaseText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const stopResolverRef = useRef<((value: string) => void) | null>(null);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const baseTextRef = useRef("");

  const snapshot = useCallback(
    () => joinSpeech(baseTextRef.current, `${finalTextRef.current}${interimTextRef.current}`),
    [],
  );

  const settleStop = useCallback(
    (value?: string) => {
      const resolve = stopResolverRef.current;
      stopResolverRef.current = null;
      resolve?.(value ?? snapshot());
    },
    [snapshot],
  );

  const setListeningSync = useCallback((value: boolean) => {
    listeningRef.current = value;
    setListening(value);
  }, []);

  useEffect(() => {
    onErrorRef.current = options?.onError;
  }, [options?.onError]);

  useEffect(() => {
    setProvider(readSpeechProvider());
    return subscribeSpeechProvider(() => {
      setProvider(readSpeechProvider());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previous = adapterRef.current;
    if (previous) {
      previous.stop();
      adapterRef.current = null;
    }
    if (listeningRef.current) {
      setListeningSync(false);
      settleStop(snapshot());
    }

    const adapter = createAdapter(provider);
    adapterRef.current = adapter;
    setSupported(false);

    void probeSupported(provider).then((ok) => {
      if (!cancelled && adapterRef.current === adapter) setSupported(ok);
    });

    return () => {
      cancelled = true;
      if (adapterRef.current === adapter) {
        adapter.stop();
        adapterRef.current = null;
      }
      if (listeningRef.current) {
        setListeningSync(false);
        settleStop(snapshot());
      }
    };
  }, [provider, settleStop, setListeningSync, snapshot]);

  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    interimTextRef.current = interimText;
  }, [interimText]);

  useEffect(() => {
    baseTextRef.current = baseText;
  }, [baseText]);

  const draft = useMemo(
    () => joinSpeech(baseText, `${finalText}${interimText}`),
    [baseText, finalText, interimText],
  );

  const start = useCallback(
    (currentInput: string) => {
      const adapter = adapterRef.current;
      if (!supported || !adapter || listeningRef.current) return;
      const base = currentInput;
      setBaseText(base);
      baseTextRef.current = base;
      setFinalText("");
      setInterimText("");
      finalTextRef.current = "";
      interimTextRef.current = "";
      setListeningSync(true);
      adapter.start({
        onResult: ({ transcript, interim }) => {
          if (!listeningRef.current) return;
          setFinalText(transcript);
          setInterimText(interim);
          finalTextRef.current = transcript;
          interimTextRef.current = interim;
        },
        onError: (message) => {
          setListeningSync(false);
          setInterimText("");
          interimTextRef.current = "";
          onErrorRef.current?.(message);
          settleStop(joinSpeech(baseTextRef.current, finalTextRef.current));
        },
        onEnd: () => {
          setListeningSync(false);
          const mergedSpoken = `${finalTextRef.current}${interimTextRef.current}`;
          setFinalText(mergedSpoken);
          setInterimText("");
          finalTextRef.current = mergedSpoken;
          interimTextRef.current = "";
          settleStop(joinSpeech(baseTextRef.current, mergedSpoken));
        },
      });
    },
    [settleStop, setListeningSync, supported],
  );

  const stop = useCallback((): Promise<string> => {
    if (!listeningRef.current) {
      return Promise.resolve(snapshot());
    }
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      adapterRef.current?.stop();
      window.setTimeout(() => {
        if (!stopResolverRef.current) return;
        setListeningSync(false);
        settleStop(snapshot());
      }, 800);
    });
  }, [settleStop, setListeningSync, snapshot]);

  return {
    provider,
    supported,
    listening,
    draft,
    baseText,
    start,
    stop,
  };
}
