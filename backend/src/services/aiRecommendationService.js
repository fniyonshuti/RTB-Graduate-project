import { AppError } from "../utils/errors.js";

const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_RECOMMENDATION_MODEL ||
  "gemini-2.5-flash";

const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

function safeString(value, defaultValue = "") {
  return String(value ?? defaultValue).trim();
}

function normalizeList(values = []) {
  return Array.isArray(values)
    ? values.map((value) => safeString(value)).filter(Boolean)
    : [];
}

function buildGeminiUrl(apiKey) {
  const configuredUrl = safeString(process.env.GEMINI_RECOMMENDATION_API_URL);
  const url =
    configuredUrl ||
    `${GEMINI_API_BASE_URL}/${DEFAULT_GEMINI_MODEL}:generateContent`;
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

async function fetchGeminiJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const normalizedError = errorBody.toLowerCase();

    if (
      response.status === 429 ||
      normalizedError.includes("resource_exhausted") ||
      normalizedError.includes("quota")
    ) {
      throw new AppError(
        "Gemini recommendation quota is temporarily exhausted. Wait a few seconds, then click Generate Gemini recommendation again.",
        429,
      );
    }

    throw new AppError(
      `Gemini recommendation API returned ${response.status}. Check your Gemini API key, model, and request configuration.`,
      response.status,
    );
  }

  return response.json();
}

function extractResponseText(payload) {
  if (!payload) return "";

  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ||
    ""
  );
}

function buildPrompt(context) {
  return [
    "You are an assessment recommendation engine for an ICT skills gap analysis system.",
    "Return only valid JSON. Do not wrap the JSON in markdown fences.",
    "Return a single JSON object with exactly these keys: message, actionItems, resources, priority.",
    "The message must be a concise assessor-ready recommendation in plain language.",
    "actionItems must be an array of short improvement actions.",
    "resources must be an array of short resource suggestions or an empty array if none are needed.",
    "priority must be one of low, medium, or high.",
    "Use the supplied RTB benchmark, final score, skill gap, weak areas, repository summary, and assessor comment.",
    "Keep the recommendation aligned to the selected competency and the evidence reviewed.",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function cleanJsonText(rawText) {
  return safeString(rawText)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseDraftResponse(rawText, prompt) {
  const trimmed = safeString(rawText);

  if (!trimmed) {
    throw new AppError("Gemini returned an empty recommendation response", 502);
  }

  try {
    const parsed = JSON.parse(cleanJsonText(trimmed));
    const actionItems = normalizeList(parsed.actionItems);
    const resources = normalizeList(parsed.resources);
    const priority = ["low", "medium", "high"].includes(parsed.priority)
      ? parsed.priority
      : "low";
    const message = safeString(parsed.message);

    if (!message) {
      throw new Error("Gemini JSON is missing message");
    }

    return {
      message,
      actionItems,
      resources,
      priority,
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      prompt,
      rawResponse: trimmed,
    };
  } catch {
    throw new AppError(
      "Gemini recommendation response was not valid JSON",
      502,
    );
  }
}

export async function generateAiRecommendationDraft(context) {
  const apiKey = safeString(process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new AppError(
      "Gemini API key is required for recommendation generation",
      500,
    );
  }

  const prompt = buildPrompt(context);
  const payload = await fetchGeminiJson(buildGeminiUrl(apiKey), {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  const rawResponse = extractResponseText(payload);

  return parseDraftResponse(rawResponse, prompt);
}
