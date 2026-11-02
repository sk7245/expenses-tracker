const express = require("express");
const mongoose = require("mongoose");
const Debt = require("../models/Debt");
const { requireAuth } = require("../middleware/auth");
const { validateDebt, validatePayment } = require("../lib/validate");

const router = express.Router();

router.use(requireAuth);

// finds one of the logged-in user's debts, or null. Matching on user too, so ids from other people don't work.
async function findDebt(req) {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    return Debt.findOne({ _id: req.params.id, user: req.userId });
}

// GET /api/debts -> every loan, still-open ones first, plus the two totals
router.get("/", async (req, res) => {
    const debts = (await Debt.find({ user: req.userId }).sort({ date: -1, createdAt: -1 }).limit(500)).map((d) => d.toJSON());

    // open ones first; among those, the earliest due date first (no due date goes last)
    debts.sort((a, b) => {
        if (a.settled !== b.settled) return a.settled ? 1 : -1;
        if (!a.settled && a.dueDate !== b.dueDate) {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate < b.dueDate ? -1 : 1;
        }
        return 0;
    });

    let iOwe = 0;
    let owedToMe = 0;
    for (const d of debts) {
        if (d.direction === "borrowed") iOwe += d.remaining;
        else owedToMe += d.remaining;
    }

    res.json({ debts, totals: { iOwe: round(iOwe), owedToMe: round(owedToMe) } });
});

router.post("/", async (req, res) => {
    const { value, error } = validateDebt(req.body);
    if (error) return res.status(400).json({ error });

    const debt = await Debt.create({ ...value, user: req.userId });
    res.status(201).json({ debt });
});

router.put("/:id", async (req, res) => {
    const debt = await findDebt(req);
    if (!debt) return res.status(404).json({ error: "Loan not found" });

    const { value, error } = validateDebt(req.body);
    if (error) return res.status(400).json({ error });

    if (value.amount < debt.paidSoFar()) {
        return res.status(400).json({ error: `Amount can't be less than what's already paid back (₹${debt.paidSoFar()})` });
    }

    debt.set(value);
    await debt.save();
    res.json({ debt });
});

router.delete("/:id", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Loan not found" });

    const result = await Debt.deleteOne({ _id: req.params.id, user: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Loan not found" });

    res.json({ ok: true });
});

// POST /api/debts/:id/payments { amount, date } -> some (or all) of the money was paid back
router.post("/:id/payments", async (req, res) => {
    const debt = await findDebt(req);
    if (!debt) return res.status(404).json({ error: "Loan not found" });

    const { value, error } = validatePayment(req.body);
    if (error) return res.status(400).json({ error });

    const remaining = round(debt.amount - debt.paidSoFar());
    if (remaining <= 0) return res.status(400).json({ error: "This one is already fully paid" });
    if (value.amount > remaining) return res.status(400).json({ error: `Only ₹${remaining} is left to pay` });
    if (value.date < debt.date) return res.status(400).json({ error: "Payment date can't be before the loan date" });

    debt.payments.push(value);
    await debt.save();
    res.status(201).json({ debt });
});

// undo a payment entered by mistake
router.delete("/:id/payments/:paymentId", async (req, res) => {
    const debt = await findDebt(req);
    const payment = debt && mongoose.isValidObjectId(req.params.paymentId) ? debt.payments.id(req.params.paymentId) : null;
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.deleteOne();
    await debt.save();
    res.json({ debt });
});

function round(n) {
    return Math.round(n * 100) / 100;
}

module.exports = router;
