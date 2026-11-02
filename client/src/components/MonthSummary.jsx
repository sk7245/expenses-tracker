import { formatMoney } from "../format.js";

// "2026-11" -> "November 2026"
function formatMonth(monthString) {
    const [year, month] = monthString.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function MonthSummary({ summary, month }) {
    const income = summary?.income ?? 0;
    const expense = summary?.expense ?? 0;
    const balance = summary?.balance ?? 0;

    return (
        <>
            <section className="balance-card">
                <p>Balance · {formatMonth(month)}</p>
                <h2>{formatMoney(balance)}</h2>
            </section>

            <section className="summary">
                <div className="summary-box">
                    <p>Income</p>
                    <p className="money income-text">{formatMoney(income)}</p>
                </div>
                <div className="summary-box">
                    <p>Spent</p>
                    <p className="money expense-text">{formatMoney(expense)}</p>
                </div>
            </section>
        </>
    );
}
