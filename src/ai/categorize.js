const { generateJson, isAiEnabled } = require("./gemini");
const { categoryFromRules, looksLikeDebit } = require("./rules");
const { categoriesFor } = require("../lib/categories");

// rules first (free, instant), AI only when the rules don't know
async function suggestCategory(description, type) {
    // an EMI typed as an expense: no category, the page points the user to the Debits tab instead
    if (type === "expense" && looksLikeDebit(description)) {
        return { category: null, source: "rules", debit: true };
    }

    const fromRules = categoryFromRules(description, type);
    if (fromRules) {
        return { category: fromRules, source: "rules" };
    }

    if (!isAiEnabled()) {
        return { category: null, source: "none" };
    }

    const allowed = categoriesFor(type);
    const prompt = [
        `You sort personal ${type} entries from India into categories.`,
        `Pick the single best category for this ${type} description.`,
        `Allowed categories: ${allowed.join(", ")}.`,
        `If nothing fits, use "${allowed[allowed.length - 1]}".`,
        "",
        `Description: ${JSON.stringify(description)}`
    ].join("\n");

    const result = await generateJson({
        prompt,
        schema: {
            type: "OBJECT",
            properties: { category: { type: "STRING", enum: allowed } },
            required: ["category"]
        }
    });

    // never trust the model blindly - only accept a category from our list
    if (!allowed.includes(result.category)) {
        return { category: null, source: "ai" };
    }
    return { category: result.category, source: "ai" };
}

module.exports = { suggestCategory };
