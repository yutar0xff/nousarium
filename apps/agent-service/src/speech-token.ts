import type { AppConfig } from "./config.js";

export type SpeechTokenResponse = {
  token: string;
  region: string;
  language: string;
};

export function speechConfigReady(config: AppConfig): boolean {
  return Boolean(config.azureSpeechKey && config.azureSpeechRegion);
}

export async function issueAzureSpeechToken(config: AppConfig): Promise<SpeechTokenResponse> {
  const key = config.azureSpeechKey;
  const region = config.azureSpeechRegion;
  if (!key || !region) {
    throw new Error("azure speech is not configured");
  }

  const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Length": "0",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`azure speech token failed (${response.status}): ${detail.slice(0, 500)}`);
    throw new Error(`azure speech token failed (${response.status})`);
  }

  const token = await response.text();
  if (!token.trim()) {
    throw new Error("azure speech token was empty");
  }

  return {
    token,
    region,
    language: config.azureSpeechLanguage,
  };
}
