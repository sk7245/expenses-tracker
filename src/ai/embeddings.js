// embeddings turn text into a list of numbers (a vector) that captures its meaning.
// "Goa trip hotel" and "beach resort stay" end up close together even with no shared words.

const config = require("../config");
const { callGemini, AiError } = require("./gemini");
const Transaction = require("../models/Transaction");

const DIMENSIONS = 768;
const BATCH_SIZE = 100; // Gemini's limit per batch request

// taskType is RETRIEVAL_DOCUMENT for stored text and RETRIEVAL_QUERY for the search text
async function embedTexts(texts, taskType) {
    const model = config.embeddingModel;
    const vectors = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const data = await callGemini(`models/${encodeURIComponent(model)}:batchEmbedContents`, {
            requests: batch.map((text) => ({
                model: `models/${model}`,
                content: { parts: [{ text }] },
                taskType,
                outputDimensionality: DIMENSIONS
            }))
        });

        if (!Array.isArray(data.embeddings) || data.embeddings.length !== batch.length) {
            throw new AiError("The AI returned an unexpected embedding result.");
        }
        vectors.push(...data.embeddings.map((e) => e.values));
    }

    return vectors;
}

// 1 = same meaning, 0 = unrelated
function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function textForEmbedding(transaction) {
    return `${transaction.description} (${transaction.type}, ${transaction.category}, paid via ${transaction.paymentMode})`;
}

// embeddings are made the first time a transaction is searched, then saved so we never pay twice.
// (transactions must be loaded with .select("+embedding"))
async function ensureEmbeddings(transactions) {
    const missing = transactions.filter((t) => !t.embedding || t.embedding.length === 0);
    if (missing.length === 0) return;

    const vectors = await embedTexts(missing.map(textForEmbedding), "RETRIEVAL_DOCUMENT");

    missing.forEach((t, i) => {
        t.embedding = vectors[i];
    });

    await Transaction.bulkWrite(
        missing.map((t, i) => ({
            updateOne: { filter: { _id: t._id }, update: { $set: { embedding: vectors[i] } } }
        }))
    );
}

module.exports = { embedTexts, cosineSimilarity, ensureEmbeddings, textForEmbedding };
