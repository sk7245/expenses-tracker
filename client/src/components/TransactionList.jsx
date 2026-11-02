import { formatMoney, formatDate } from "../format.js";
import { categoryLabel } from "../categories.js";

export default function TransactionList({ transactions, onEdit, onDelete }) {
    if (transactions.length === 0) {
        return <p className="empty-message">Nothing here yet. Add your first transaction above.</p>;
    }

    return (
        <ul id="transaction-list">
            {/* key tells React which row is which, so it only redraws rows that changed */}
            {transactions.map((t) => (
                <li key={t.id} className={"transaction " + t.type}>
                    <div className="info">
                        {/* React escapes text in {}, so whatever the user typed can't run as HTML */}
                        <span className="name">{t.description}</span>
                        <span className="meta">
                            {categoryLabel(t.category)} · {t.paymentMode} · {formatDate(t.date)}
                        </span>
                    </div>
                    <span className="amount">
                        {t.type === "income" ? "+" : "-"}
                        {formatMoney(t.amount)}
                    </span>
                    <button type="button" className="row-btn edit-btn" title="Edit" onClick={() => onEdit(t)}>
                        ✎
                    </button>
                    <button type="button" className="row-btn delete-btn" title="Delete" onClick={() => onDelete(t)}>
                        ✕
                    </button>
                </li>
            ))}
        </ul>
    );
}
