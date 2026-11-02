import { useEffect, useState } from "react";
import { api } from "../api.js";
import { todayString } from "../format.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryLabel } from "../categories.js";
import MonthSummary from "./MonthSummary.jsx";
import AskBox from "./AskBox.jsx";
import Breakdown from "./Breakdown.jsx";
import TransactionForm from "./TransactionForm.jsx";
import TransactionList from "./TransactionList.jsx";

export default function SpendingTab({ aiEnabled, onError }) {
    const [month, setMonth] = useState(todayString().slice(0, 7));
    const [category, setCategory] = useState("All");
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [editing, setEditing] = useState(null);
    // bumped after every save / delete so the effect below loads fresh data
    const [version, setVersion] = useState(0);

    // runs on first show and again whenever the month, the filter or the data changes
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            api(`/api/transactions?month=${month}&category=${encodeURIComponent(category)}`),
            api(`/api/transactions/summary?month=${month}`)
        ])
            .then(([listResult, summaryResult]) => {
                // a slower, older request must not overwrite a newer one
                if (cancelled) return;
                setTransactions(listResult.transactions);
                setSummary(summaryResult);
            })
            .catch(onError);
        return () => {
            cancelled = true;
        };
        // onError is left out on purpose: it's a new function on every render and would reload every time
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, category, version]);

    function handleSaved(date) {
        // jump to the month of the saved entry so it's visible
        setMonth(date.slice(0, 7));
        setEditing(null);
        setVersion((v) => v + 1);
    }

    async function handleDelete(transaction) {
        if (!confirm(`Delete "${transaction.description}"?`)) return;
        try {
            await api(`/api/transactions/${transaction.id}`, { method: "DELETE" });
            if (editing?.id === transaction.id) setEditing(null);
            setVersion((v) => v + 1);
        } catch (error) {
            onError(error);
        }
    }

    return (
        <>
            <MonthSummary summary={summary} month={month} />

            {aiEnabled && <AskBox onError={onError} />}

            <Breakdown summary={summary} />

            <TransactionForm
                editing={editing}
                aiEnabled={aiEnabled}
                onSaved={handleSaved}
                onCancel={() => setEditing(null)}
                onError={onError}
            />

            <section>
                <div className="section-header">
                    <h3>History</h3>
                    <div className="filters">
                        <input type="month" className="filter" value={month} onChange={(e) => setMonth(e.target.value || todayString().slice(0, 7))} />
                        <select className="filter" value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="All">All categories</option>
                            <optgroup label="Expense">
                                {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {categoryLabel(c)}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Income">
                                {INCOME_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {categoryLabel(c)}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                </div>

                <TransactionList transactions={transactions} onEdit={setEditing} onDelete={handleDelete} />
            </section>
        </>
    );
}
