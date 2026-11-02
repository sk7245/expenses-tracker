import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { todayString } from "../format.js";
import { DEBT_SOURCES } from "../categories.js";

// add a new loan, or edit one (debt = the loan being edited)
export default function DebtForm({ debt, onSaved, onCancel, onError }) {
    const [fields, setFields] = useState({
        direction: debt?.direction ?? "borrowed",
        person: debt?.person ?? "",
        source: debt?.source ?? "Friend or family",
        amount: debt?.amount ?? "",
        date: debt?.date ?? todayString(),
        emi: debt?.emi ?? "",
        emiDay: debt?.emiDay ?? "",
        dueDate: debt?.dueDate ?? "",
        note: debt?.note ?? ""
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const formRef = useRef(null);
    const personInput = useRef(null);

    // bring the form into view when it opens
    useEffect(() => {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        personInput.current.focus();
    }, []);

    function update(changes) {
        setFields((current) => ({ ...current, ...changes }));
    }

    async function save(event) {
        event.preventDefault();

        const body = {
            ...fields,
            person: fields.person.trim(),
            amount: Number(fields.amount),
            emi: fields.emi ? Number(fields.emi) : null,
            emiDay: fields.emiDay ? Number(fields.emiDay) : null,
            note: fields.note.trim()
        };

        if (body.person === "") return setError("Please enter who it's with.");
        if (!body.amount || body.amount <= 0) return setError("Please enter an amount greater than 0.");
        if (body.date === "") return setError("Please pick the date.");
        if (body.emi !== null && body.emi > body.amount) return setError("The EMI can't be more than the total.");
        if (body.dueDate && body.dueDate < body.date) return setError("The due date can't be before the loan date.");

        setSaving(true);
        try {
            if (debt) {
                await api(`/api/debts/${debt.id}`, { method: "PUT", body });
            } else {
                await api("/api/debts", { method: "POST", body });
            }
            onSaved();
        } catch (err) {
            if (err.status === 401) return onError(err);
            setError(err.message);
            setSaving(false);
        }
    }

    const borrowed = fields.direction === "borrowed";

    return (
        <form className="debt-form" ref={formRef} onSubmit={save}>
            <div className="type-toggle">
                <input type="radio" name="direction" id="dir-borrowed" checked={borrowed} onChange={() => update({ direction: "borrowed" })} />
                <label htmlFor="dir-borrowed">I borrowed</label>
                <input type="radio" name="direction" id="dir-lent" checked={!borrowed} onChange={() => update({ direction: "lent" })} />
                <label htmlFor="dir-lent">I lent</label>
            </div>

            <div className="row">
                <div>
                    <label htmlFor="debt-person">{borrowed ? "From whom" : "To whom"}</label>
                    <input
                        type="text"
                        id="debt-person"
                        ref={personInput}
                        placeholder="e.g. Rahul, KreditBee, SBI"
                        maxLength={50}
                        autoComplete="off"
                        value={fields.person}
                        onChange={(e) => update({ person: e.target.value })}
                    />
                </div>
                <div>
                    <label htmlFor="debt-source">Type</label>
                    <select id="debt-source" value={fields.source} onChange={(e) => update({ source: e.target.value })}>
                        {DEBT_SOURCES.map((source) => (
                            <option key={source} value={source}>
                                {source}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="row">
                <div>
                    <label htmlFor="debt-amount">Total to pay back (₹)</label>
                    <input type="number" id="debt-amount" placeholder="0" min="0.01" step="0.01" value={fields.amount} onChange={(e) => update({ amount: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="debt-date">Taken on</label>
                    <input type="date" id="debt-date" max={todayString()} value={fields.date} onChange={(e) => update({ date: e.target.value })} />
                </div>
            </div>
            <p className="hint">Include interest if you know it. For a loan already running, enter what's still left.</p>

            <div className="row">
                <div>
                    <label htmlFor="debt-emi">Monthly EMI (₹)</label>
                    <input type="number" id="debt-emi" placeholder="If paid as EMIs" min="0.01" step="0.01" value={fields.emi} onChange={(e) => update({ emi: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="debt-emi-day">EMI date (day of month)</label>
                    <input type="number" id="debt-emi-day" placeholder="e.g. 5" min="1" max="31" step="1" value={fields.emiDay} onChange={(e) => update({ emiDay: e.target.value })} />
                </div>
            </div>

            <div className="row">
                <div>
                    <label htmlFor="debt-due">Pay back by (optional)</label>
                    <input type="date" id="debt-due" value={fields.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
                </div>
                <div>
                    <label htmlFor="debt-note">Note (optional)</label>
                    <input type="text" id="debt-note" placeholder="e.g. for exam fees" maxLength={100} autoComplete="off" value={fields.note} onChange={(e) => update({ note: e.target.value })} />
                </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="form-buttons">
                <button type="submit" className="add-btn" disabled={saving}>
                    {debt ? "Save changes" : "Save"}
                </button>
                <button type="button" className="cancel-btn" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
