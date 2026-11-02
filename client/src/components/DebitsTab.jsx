import { useEffect, useState } from "react";
import { api } from "../api.js";
import { formatMoney } from "../format.js";
import { sortByUrgency } from "../debtUtils.js";
import DebtForm from "./DebtForm.jsx";
import DebtRow from "./DebtRow.jsx";

// "Debits & EMIs": loans, EMIs, loan apps, money borrowed from friends, and money lent
export default function DebitsTab({ onError }) {
    const [debts, setDebts] = useState([]);
    const [totals, setTotals] = useState({ iOwe: 0, owedToMe: 0, emiPerMonth: 0 });
    const [showSettled, setShowSettled] = useState(false);
    // null = form closed, "new" = adding, or the loan being edited
    const [formFor, setFormFor] = useState(null);

    async function load() {
        try {
            const result = await api("/api/debts");
            setDebts(result.debts);
            setTotals(result.totals);
        } catch (error) {
            onError(error);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleDelete(debt) {
        if (!confirm(`Delete the loan with ${debt.person}? Its payments will be deleted too.`)) return;
        try {
            await api(`/api/debts/${debt.id}`, { method: "DELETE" });
            if (formFor?.id === debt.id) setFormFor(null);
            await load();
        } catch (error) {
            onError(error);
        }
    }

    const settledCount = debts.filter((d) => d.settled).length;
    const visible = sortByUrgency(showSettled ? debts : debts.filter((d) => !d.settled));

    return (
        <>
            <section className="debit-card">
                <p>Total you owe</p>
                <h2>{formatMoney(totals.iOwe)}</h2>
            </section>

            <div className="summary">
                <div className="summary-box">
                    <p>EMIs every month</p>
                    <p className="money expense-text">{formatMoney(totals.emiPerMonth)}</p>
                </div>
                <div className="summary-box">
                    <p>Others owe you</p>
                    <p className="money income-text">{formatMoney(totals.owedToMe)}</p>
                </div>
            </div>

            <section>
                <div className="section-header">
                    <h3>Loans & EMIs</h3>
                    {!formFor && (
                        <button type="button" className="small-btn outline" onClick={() => setFormFor("new")}>
                            + Add
                        </button>
                    )}
                </div>

                {formFor && (
                    // key: a different loan gives a fresh form, so its fields start from that loan
                    <DebtForm
                        key={formFor === "new" ? "new" : formFor.id}
                        debt={formFor === "new" ? null : formFor}
                        onSaved={() => {
                            setFormFor(null);
                            load();
                        }}
                        onCancel={() => setFormFor(null)}
                        onError={onError}
                    />
                )}

                {visible.length > 0 ? (
                    <ul id="debt-list">
                        {visible.map((debt) => (
                            <DebtRow key={debt.id} debt={debt} onChanged={load} onEdit={setFormFor} onDelete={handleDelete} onError={onError} />
                        ))}
                    </ul>
                ) : (
                    <p className="empty-message">No loans or EMIs. Add one if you took a loan, have an EMI, or borrowed or lent money.</p>
                )}

                {settledCount > 0 && (
                    <label className="check-label">
                        <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} /> Show paid off ({settledCount})
                    </label>
                )}
            </section>
        </>
    );
}
