import { useState } from "react";
import { api } from "../api.js";
import { formatMoney, formatDate } from "../format.js";
import { categoryLabel } from "../categories.js";

const EXAMPLES = [
    "How much did I spend this month?",
    "What was my biggest expense last month?",
    "How much have I spent on Swiggy and Zomato?"
];

// "Ask about your money" - the RAG feature (src/ai/ask.js on the server)
export default function AskBox({ onError }) {
    const [question, setQuestion] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [message, setMessage] = useState("");

    async function ask(text) {
        text = text.trim();
        if (text.length < 3) return;

        setLoading(true);
        setResult(null);
        setMessage("Looking through your transactions...");
        try {
            const answer = await api("/api/ai/ask", { method: "POST", body: { question: text } });
            setResult(answer);
            setMessage("");
        } catch (error) {
            if (error.status === 401) return onError(error);
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }

    // what the AI searched for, shown under the answer so the user can check it
    function searchedFor(answer) {
        const plan = answer.plan;
        const parts = [`${formatDate(plan.startDate, true)} - ${formatDate(plan.endDate, true)}`];
        if (plan.categories.length > 0) parts.push(plan.categories.map(categoryLabel).join(", "));
        if (plan.searchText) parts.push(`"${plan.searchText}"`);
        parts.push(`${answer.facts.count} matching`);
        return "Searched: " + parts.join(" · ");
    }

    return (
        <section className="ask-card">
            <h3>Ask about your money</h3>
            <form
                className="ask-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    ask(question);
                }}
            >
                <input
                    type="text"
                    placeholder="e.g. How much did I spend on food last month?"
                    maxLength={300}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <button type="submit" className="small-btn" disabled={loading}>
                    Ask
                </button>
            </form>

            <div className="chips">
                {EXAMPLES.map((example) => (
                    <button
                        key={example}
                        type="button"
                        className="chip"
                        onClick={() => {
                            setQuestion(example);
                            ask(example);
                        }}
                    >
                        {example}
                    </button>
                ))}
            </div>

            {(message || result) && (
                <div className="ask-result">
                    <p>{message || result.answer}</p>
                    {result?.facts && <p className="meta">{searchedFor(result)}</p>}
                    {result && result.transactions.length > 0 && (
                        <ul className="ask-list">
                            {result.transactions.slice(0, 5).map((t) => (
                                <li key={t.id}>
                                    {formatDate(t.date)} · {t.description} · {t.type === "income" ? "+" : "-"}
                                    {formatMoney(t.amount)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    );
}
