// small wrapper around the Gemini REST API (no SDK needed, just fetch).
// for text we always ask for JSON that follows a schema, so replies are easy and safe to use in code.

const config = require("../config");
const HttpError = require("../lib/httpError");

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// 502 = "a service we depend on failed", which is what most AI errors are
class AiError extends HttpError {
    constructor(message, status = 502) {
        super(status, message);
    }
}

function isAiEnabled() {
    return Boolean(config.geminiApiKey);
}

async function callGemini(path, body) {
    if (!isAiEnabled()) {
        throw new AiError("AI isn't set up on this server yet.", 503);
    }

    let response;
    try {
        response = await fetch(`${BASE_URL}/${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": config.geminiApiKey
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(25000)
        });
    } catch (error) {
        console.error("Gemini request failed:", error.message);
        throw new AiError("Couldn't reach the AI service. Please try again.");
    }

    if (response.status === 429) {
        throw new AiError("The AI is busy right now (free limit reached). Try again in a minute.", 429);
    }
    if (!response.ok) {
        console.error("Gemini error:", response.status, (await response.text()).slice(0, 500));
        throw new AiError("The AI service returned an error. Please try again.");
    }

    return response.json();
}

async function generateJson({ prompt, schema, image }) {
    const parts = [{ text: prompt }];
    if (image) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }

    const model = encodeURIComponent(config.geminiModel);
    const data = await callGemini(`models/${model}:generateContent`, {
        contents: [{ role: "user", parts }],
        generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");

    try {
        return JSON.parse(text);
    } catch {
        console.error("Gemini sent something that isn't JSON:", text.slice(0, 200));
        throw new AiError("The AI gave an answer we couldn't read. Please try again.");
    }
}

module.exports = { callGemini, generateJson, isAiEnabled, AiError };
