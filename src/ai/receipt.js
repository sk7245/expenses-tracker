// reads a photo of a bill / receipt / UPI payment screenshot and fills the form for the user

const { generateJson, AiError } = require("./gemini");
const { categoryFromRules } = require("./rules");
const { EXPENSE_CATEGORIES, PAYMENT_MODES } = require("../lib/categories");
const { isValidDate, today, addDays } = require("../lib/dates");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

// "data:image/jpeg;base64,/9j/4AAQ..." -> { mimeType, base64 }
function parseImage(dataUrl) {
    const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!match) throw new AiError("Please upload a JPG, PNG or WEBP image.", 400);

    const [, mimeType, base64] = match;
    if (!ALLOWED_TYPES.includes(mimeType)) throw new AiError("Please upload a JPG, PNG or WEBP image.", 400);
    if (base64.length * 0.75 > MAX_BYTES) throw new AiError("Image is too big (max 5 MB).", 413);

    return { mimeType, base64 };
}

async function scanReceipt(dataUrl) {
    const image = parseImage(dataUrl);

    const prompt = [
        "This image should be a bill, receipt, invoice or UPI payment screenshot (GPay, PhonePe, Paytm) from India.",
        "Read it and fill in the fields.",
        "- isReceipt: false if the image is not a bill, receipt or payment screenshot.",
        '- description: a short name for the expense, like "DMart groceries", "Swiggy order", "Apollo Pharmacy". Max 40 characters.',
        "- amount: the final total paid in rupees, including taxes. Just the number.",
        "- date: the bill or payment date as YYYY-MM-DD. Empty string if you can't see one.",
        `- category: the best match from: ${EXPENSE_CATEGORIES.join(", ")}.`,
        `- paymentMode: one of ${PAYMENT_MODES.join(", ")} if the image shows how it was paid, otherwise an empty string.`
    ].join("\n");

    const result = await generateJson({
        prompt,
        image,
        schema: {
            type: "OBJECT",
            properties: {
                isReceipt: { type: "BOOLEAN" },
                description: { type: "STRING" },
                amount: { type: "NUMBER" },
                date: { type: "STRING" },
                category: { type: "STRING", enum: EXPENSE_CATEGORIES },
                paymentMode: { type: "STRING" }
            },
            required: ["isReceipt", "description", "amount", "date", "category", "paymentMode"]
        }
    });

    if (result.isReceipt === false) {
        throw new AiError("That doesn't look like a bill or receipt. Try a clearer photo.", 422);
    }

    return cleanReceipt(result);
}

// check every field the AI gave back; anything doubtful is left empty for the user to fill
function cleanReceipt(result) {
    const description = typeof result.description === "string" ? result.description.trim().slice(0, 60) : "";

    const amount = Number(result.amount);
    const goodAmount = Number.isFinite(amount) && amount > 0 && amount < 100000000;

    const date = isValidDate(result.date) && result.date <= addDays(today(), 1) ? result.date : "";

    let category = EXPENSE_CATEGORIES.includes(result.category) ? result.category : null;
    if (!category) category = categoryFromRules(description, "expense") || "Other Expense";

    return {
        description,
        amount: goodAmount ? Math.round(amount * 100) / 100 : null,
        date,
        category,
        paymentMode: PAYMENT_MODES.includes(result.paymentMode) ? result.paymentMode : ""
    };
}

module.exports = { scanReceipt, parseImage, cleanReceipt };
