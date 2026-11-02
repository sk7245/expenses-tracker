const mongoose = require("mongoose");
const { DEBT_DIRECTIONS, DEBT_SOURCES } = require("../lib/categories");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// each time some of the money is paid back
const paymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true, match: DATE }
});

// money the user borrowed (loan app, friend, bank) or lent to someone
const debtSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        // borrowed = I have to pay it back, lent = someone has to pay me
        direction: { type: String, required: true, enum: DEBT_DIRECTIONS },
        person: { type: String, required: true, trim: true, maxlength: 50 },
        source: { type: String, required: true, enum: DEBT_SOURCES },
        // the total that has to be paid back (with interest, if the user knows it)
        amount: { type: Number, required: true, min: 0.01, max: 100000000 },
        date: { type: String, required: true, match: DATE },
        dueDate: { type: String, default: null, match: DATE },
        note: { type: String, default: "", trim: true, maxlength: 100 },
        // monthly instalment, for loans paid as EMIs (null = paid back whenever)
        emi: { type: Number, default: null, min: 0.01 },
        // day of the month the EMI is due (1-31)
        emiDay: { type: Number, default: null, min: 1, max: 31 },
        payments: { type: [paymentSchema], default: [] }
    },
    { timestamps: true }
);

debtSchema.index({ user: 1, date: -1 });

function round(n) {
    return Math.round(n * 100) / 100;
}

// how much has come back so far. Kept as a calculation (not a saved field) so it can never get out of sync.
debtSchema.methods.paidSoFar = function () {
    return round(this.payments.reduce((sum, p) => sum + p.amount, 0));
};

debtSchema.set("toJSON", {
    transform: (doc, ret) => {
        const paid = doc.paidSoFar();
        ret.id = ret._id.toString();
        ret.paid = paid;
        ret.remaining = round(Math.max(0, ret.amount - paid));
        ret.settled = ret.remaining === 0;
        ret.payments = ret.payments.map((p) => ({ id: p._id.toString(), amount: p.amount, date: p.date }));
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
    }
});

module.exports = mongoose.model("Debt", debtSchema);
