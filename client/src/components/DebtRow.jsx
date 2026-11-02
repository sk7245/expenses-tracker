import { useState } from "react";
import { api } from "../api.js";
import { todayString, formatMoney, formatDate } from "../format.js";
import { emiStatus, ordinal } from "../debtUtils.js";

// one loan in the list, with its own small "pay back" form and payment history
export default function DebtRow({ debt, onChanged, onEdit, onDelete, onError }) {
    const [payOpen, setPayOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payDate, setPayDate] = useState(todayString());
    const [payError, setPayError] = useState("");

    function togglePayForm() {
        if (!payOpen) {
            // an EMI loan is usually paid one EMI at a time; anything else in one go
            setPayAmount(debt.emi ? Math.min(debt.emi, debt.remaining) : debt.remaining);
            setPayDate(todayString());
            setPayError("");
        }
        setPayOpen(!payOpen);
    }

    const borrowed = debt.direction === "borrowed";
    const emi = debt.emi && !debt.settled ? emiStatus(debt) : null;
    const pastDue = !debt.settled && debt.dueDate && debt.dueDate < todayString();

    const details = [borrowed ? "You borrowed" : "You lent", debt.source, formatDate(debt.date, true)];
    if (debt.emi) details.push(`EMI ${formatMoney(debt.emi)} on the ${ordinal(debt.emiDay)}`);
    if (debt.dueDate && !debt.settled) details.push("pay back by " + formatDate(debt.dueDate, true));

    let payLabel = borrowed ? "I paid back" : "Got money back";
    if (borrowed && debt.emi) payLabel = "Pay EMI";

    async function savePayment(event) {
        event.preventDefault();
        const amount = Number(payAmount);
        if (!amount || amount <= 0) return setPayError("Enter an amount greater than 0.");

        try {
            await api(`/api/debts/${debt.id}/payments`, { method: "POST", body: { amount, date: payDate } });
            setPayOpen(false);
            onChanged();
        } catch (err) {
            if (err.status === 401) return onError(err);
            setPayError(err.message);
        }
    }

    async function undoPayment(payment) {
        if (!confirm("Remove this payment?")) return;
        try {
            await api(`/api/debts/${debt.id}/payments/${payment.id}`, { method: "DELETE" });
            onChanged();
        } catch (err) {
            onError(err);
        }
    }

    return (
        <li className={`debt ${debt.direction}${debt.settled ? " settled" : ""}`}>
            <div className="debt-top">
                <div className="info">
                    <span className="name">{debt.person}</span>
                    <span className="meta">{details.join(" · ")}</span>
                    {emi && (
                        <span className={"meta status" + (emi.late ? " late" : emi.paid ? " done" : "")}>
                            {emi.paid
                                ? "This month's EMI paid ✓"
                                : (emi.late ? "EMI was due " : "Next EMI due ") + formatDate(emi.dueDate, true)}
                        </span>
                    )}
                    {!emi && pastDue && <span className="meta status late">Past the pay back date</span>}
                    {debt.note && <span className="meta note">{debt.note}</span>}
                </div>
                <div className="debt-money">
                    <span className="amount">{debt.settled ? "Paid off" : formatMoney(debt.remaining)}</span>
                    <span className="meta">{debt.settled ? formatMoney(debt.amount) : "left of " + formatMoney(debt.amount)}</span>
                </div>
            </div>

            {/* how much is paid back */}
            <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round((debt.paid / debt.amount) * 100)}%` }} />
            </div>

            <div className="debt-actions">
                {!debt.settled && (
                    <button type="button" className="small-btn outline" onClick={togglePayForm}>
                        {payLabel}
                    </button>
                )}
                {debt.payments.length > 0 && (
                    <button type="button" className="link-btn" onClick={() => setHistoryOpen(!historyOpen)}>
                        Payments ({debt.payments.length})
                    </button>
                )}
                <span className="spacer" />
                <button type="button" className="link-btn" onClick={() => onEdit(debt)}>
                    Edit
                </button>
                <button type="button" className="link-btn danger" onClick={() => onDelete(debt)}>
                    Delete
                </button>
            </div>

            {payOpen && (
                <form className="pay-form" onSubmit={savePayment}>
                    <div className="pay-fields">
                        <input type="number" aria-label="Amount paid" min="0.01" step="0.01" max={debt.remaining} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                        <input type="date" aria-label="Date paid" min={debt.date} max={todayString()} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                        <button type="submit" className="small-btn">
                            Save
                        </button>
                    </div>
                    {payError && <p className="form-error">{payError}</p>}
                </form>
            )}

            {historyOpen && (
                <ul className="payment-list">
                    {debt.payments.map((payment) => (
                        <li key={payment.id}>
                            <span>
                                {formatDate(payment.date, true)} · {formatMoney(payment.amount)}
                            </span>
                            <button type="button" className="link-btn" onClick={() => undoPayment(payment)}>
                                Undo
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}
