export type SpeechInputResult = {
  transcript: string;
  interim: string;
};

export type SpeechInputHandlers = {
  onResult: (result: SpeechInputResult) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

export type SpeechInputController = {
  supported: boolean;
  start: (handlers: SpeechInputHandlers) => void;
  stop: () => void;
};
