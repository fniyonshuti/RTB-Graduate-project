import { AppError } from "../utils/errors.js";

const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_RECOMMENDATION_MODEL ||
  "gemini-2.5-flash";

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
  const geminiApiBaseUrl = safeString(process.env.GEMINI_API_BASE_URL).replace(
    /\/+$/,
    "",
  );

  if (!configuredUrl && !geminiApiBaseUrl) {
    throw new AppError(
      "GEMINI_API_BASE_URL or GEMINI_RECOMMENDATION_API_URL is required for Gemini recommendation generation",
      500,
    );
  }

  const url =
    configuredUrl ||
    `${geminiApiBaseUrl}/${DEFAULT_GEMINI_MODEL}:generateContent`;
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
    "You are an evidence-based recommendation engine for an ICT TVET skills gap analysis system.",
    "Return only valid JSON. Do not wrap the JSON in markdown fences.",
    "Return a single JSON object with exactly these keys: message, actionItems, resources, priority.",
    "The message must be a concise learner-ready recommendation in plain language and must mention the gap level, final score, benchmark, and strongest improvement priority.",
    "actionItems must be an array of 3 to 6 short, measurable improvement actions.",
    "Each action item must be directly connected to the weakest score area, failed repository checks, hidden expected-output test result, theory score, assessor comment, or benchmark gap.",
    "resources must be an array of 1 to 4 short resource suggestions or an empty array only when the learner has No Gap.",
    "priority must be one of low, medium, or high.",
    "Use the supplied RTB benchmark, final score, skill gap, gap meaning, weak areas, improvement priorities, repository evidence, repository summary, and automatic review note.",
    "Keep the recommendation aligned to the selected competency and the evidence reviewed.",
    "If the hidden expected-output test failed or was not configured, include a practical action that improves objective proof before resubmission.",
    "If GitHub/practical score is lower than theory score, focus first on implementation, tests, and repository evidence.",
    "If theory score is lower than practical score, focus first on concepts and applying those concepts in the code.",
    "If there is No Gap, recommend advanced practice, portfolio strengthening, and maintaining evidence quality instead of remediation.",
    "Do not invent facts, tools, scores, failures, or technologies that are not present in the context.",
    "Do not provide generic advice; every action must be observable and assessable.",
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

    if (actionItems.length < 2) {
      throw new Error("Gemini JSON must include evidence-based action items");
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
