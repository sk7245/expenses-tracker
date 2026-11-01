const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { requireAuth } = require("../middleware/auth");
const { validateTransaction } = require("../lib/validate");
const { isValidMonth, monthRange } = require("../lib/dates");

const router = express.Router();

// every route below needs a logged-in user
router.use(requireAuth);

// "2026-11" -> a filter for every date in November (dates are stored as text, so this is a text range)
function monthFilter(month) {
    const { from, to } = monthRange(month);
    return { $gte: from, $lte: to };
}

// GET /api/transactions?month=2026-11&category=Rent
router.get("/", async (req, res) => {
    const filter = { user: req.userId };

    if (req.query.month) {
        if (!isValidMonth(req.query.month)) return res.status(400).json({ error: "Month must look like 2026-11" });
        filter.date = monthFilter(req.query.month);
    }
    if (req.query.category && req.query.category !== "All") {
        filter.category = String(req.query.category);
    }

    const transactions = await Transaction.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000);
    res.json({ transactions });
});

// GET /api/transactions/summary?month=2026-11
router.get("/summary", async (req, res) => {
    const month = req.query.month;
    if (!isValidMonth(month)) return res.status(400).json({ error: "Month must look like 2026-11" });

    const rows = await Transaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(req.userId), date: monthFilter(month) } },
        { $group: { _id: { type: "$type", category: "$category" }, total: { $sum: "$amount" } } }
    ]);

    let income = 0;
    let expense = 0;
    const spendingByCategory = [];

    for (const row of rows) {
        if (row._id.type === "income") {
            income += row.total;
        } else {
            expense += row.total;
            spendingByCategory.push({ category: row._id.category, total: round(row.total) });
        }
    }

    spendingByCategory.sort((a, b) => b.total - a.total);

    res.json({
        month,
        income: round(income),
        expense: round(expense),
        balance: round(income - expense),
        spendingByCategory
    });
});

router.post("/", async (req, res) => {
    const { value, error } = validateTransaction(req.body);
    if (error) return res.status(400).json({ error });

    const transaction = await Transaction.create({ ...value, user: req.userId });
    res.status(201).json({ transaction });
});

// used once to bring over data saved in the browser by the old version
router.post("/import", async (req, res) => {
    const items = Array.isArray(req.body.transactions) ? req.body.transactions : [];
    if (items.length === 0) return res.status(400).json({ error: "Nothing to import" });
    if (items.length > 500) return res.status(400).json({ error: "Too many transactions (max 500)" });

    const valid = [];
    let skipped = 0;
    for (const item of items) {
        const { value } = validateTransaction(item);
        if (value) valid.push({ ...value, user: req.userId });
        else skipped++;
    }

    if (valid.length > 0) await Transaction.insertMany(valid);
    res.status(201).json({ imported: valid.length, skipped });
});

router.put("/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Transaction not found" });

    const { value, error } = validateTransaction(req.body);
    if (error) return res.status(400).json({ error });

    // matching on user too, so nobody can edit someone else's transaction by guessing its id.
    // the old embedding no longer matches the new text, so drop it (it's rebuilt on the next AI search)
    const transaction = await Transaction.findOneAndUpdate(
        { _id: req.params.id, user: req.userId },
        { $set: value, $unset: { embedding: 1 } },
        { returnDocument: "after", runValidators: true }
    );
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    res.json({ transaction });
});

router.delete("/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Transaction not found" });

    const result = await Transaction.deleteOne({ _id: req.params.id, user: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Transaction not found" });

    res.json({ ok: true });
});

function round(n) {
    return Math.round(n * 100) / 100;
}

module.exports = router;
module.exports.monthFilter = monthFilter;
