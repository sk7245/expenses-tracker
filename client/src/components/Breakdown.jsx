import { formatMoney } from "../format.js";
import { categoryLabel } from "../categories.js";

// "Where it went": one bar per category, the longest = most spent
export default function Breakdown({ summary }) {
    const items = summary?.spendingByCategory ?? [];
    if (items.length === 0) return null;

    const biggest = items[0].total;

    return (
        <section>
            <h3>Where it went</h3>
            <div className="bars">
                {items.map((item) => {
                    const percent = summary.expense > 0 ? Math.round((item.total / summary.expense) * 100) : 0;
                    return (
                        <div className="bar-row" key={item.category}>
                            <span className="bar-name">{categoryLabel(item.category)}</span>
                            <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${Math.max(3, (item.total / biggest) * 100)}%` }} />
                            </div>
                            <span className="bar-amount">
                                {formatMoney(item.total)} · {percent}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
