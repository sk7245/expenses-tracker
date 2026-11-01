const { PAYMENT_MODES, TYPES, isValidCategory } = require("./categories");
const { isValidDate, today, addDays } = require("./dates");

const MAX_AMOUNT = 100000000; // ₹10 crore - anything above is almost surely a typo

// Checks a transaction sent by the browser. Returns { value } or { error }.
// The server never trusts the browser: the same checks exist in the frontend,
// but anyone can call the API directly with Postman or curl.
function validateTransaction(body) {
    if (!body || typeof body !== "object") {
        return { error: "Invalid data" };
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length === 0) return { error: "Description is required" };
    if (description.length > 60) return { error: "Description must be 60 characters or less" };

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be greater than 0" };
    if (amount > MAX_AMOUNT) return { error: "Amount is too large" };

    if (!TYPES.includes(body.type)) return { error: "Type must be expense or income" };

    if (!isValidCategory(body.type, body.category)) {
        return { error: `"${body.category}" is not a valid ${body.type} category` };
    }

    if (!PAYMENT_MODES.includes(body.paymentMode)) return { error: "Invalid payment mode" };

    if (!isValidDate(body.date)) return { error: "Date must be a valid date (YYYY-MM-DD)" };
    // +1 day because the user may be ahead of the server's timezone (India is UTC+5:30)
    if (body.date > addDays(today(), 1)) return { error: "Date can't be in the future" };

    return {
        value: {
            description,
            amount: Math.round(amount * 100) / 100,
            type: body.type,
            category: body.category,
            paymentMode: body.paymentMode,
            date: body.date
        }
    };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(body) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length === 0 || name.length > 50) return { error: "Please enter your name (max 50 characters)" };
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return { error: "Please enter a valid email" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    // bcrypt only uses the first 72 bytes of a password
    if (Buffer.byteLength(password) > 72) return { error: "Password is too long" };

    return { value: { name, email, password } };
}

module.exports = { validateTransaction, validateRegister };
