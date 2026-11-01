const mongoose = require("mongoose");
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES } = require("../lib/categories");

const transactionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        description: { type: String, required: true, trim: true, maxlength: 60 },
        amount: { type: Number, required: true, min: 0.01, max: 100000000 },
        type: { type: String, required: true, enum: ["expense", "income"] },
        category: {
            type: String,
            required: true,
            enum: [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
        },
        paymentMode: { type: String, required: true, enum: PAYMENT_MODES },
        // kept as "YYYY-MM-DD" text, same as the date input gives us.
        // avoids timezone problems and "2026-11" month filters become simple text ranges.
        date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
        // meaning vector for AI search (see src/ai/embeddings.js). select: false = not loaded unless asked for
        embedding: { type: [Number], select: false, default: undefined }
    },
    { timestamps: true }
);

// most queries are "this user's transactions, newest first"
transactionSchema.index({ user: 1, date: -1 });

transactionSchema.set("toJSON", {
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        delete ret.embedding;
        return ret;
    }
});

module.exports = mongoose.model("Transaction", transactionSchema);
