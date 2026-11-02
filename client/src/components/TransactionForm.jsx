import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { todayString } from "../format.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, OLD_EXPENSE_CATEGORY, PAYMENT_MODES, categoryLabel } from "../categories.js";

const EMPTY = {
    type: "expense",
    description: "",
    amount: "",
    date: todayString(),
    category: EXPENSE_CATEGORIES[0],
    paymentMode: "UPI"
};

// phone photos are several MB; shrink to max 1600px wide JPEG before sending
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Couldn't open that image. Try a JPG or PNG photo."));
        };
        img.src = url;
    });
}

export default function TransactionForm({ editing, aiEnabled, onSaved, onCancel, onError }) {
    // one state object for all the fields; update(...) changes just the ones given
    const [fields, setFields] = useState({ ...EMPTY, date: todayString() });
    // once the user picks a category by hand, auto-suggest stops changing it
    const [categoryPicked, setCategoryPicked] = useState(false);
    const [hint, setHint] = useState("");
    const [error, setError] = useState("");
    const [scanStatus, setScanStatus] = useState("");
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const fileInput = useRef(null);
    const descriptionInput = useRef(null);

    function update(changes) {
        setFields((current) => ({ ...current, ...changes }));
    }

    function reset() {
        setFields({ ...EMPTY, date: todayString() });
        setCategoryPicked(false);
        setHint("");
        setError("");
        setScanStatus("");
    }

    // when the parent says "edit this one", fill the form with it
    useEffect(() => {
        if (!editing) {
            reset();
            return;
        }
        setFields({
            type: editing.type,
            description: editing.description,
            amount: editing.amount,
            date: editing.date,
            category: editing.category,
            paymentMode: editing.paymentMode
        });
        setCategoryPicked(true);
        setHint("");
        setError("");
        descriptionInput.current.scrollIntoView({ behavior: "smooth", block: "center" });
        descriptionInput.current.focus();
    }, [editing]);

    // AI category suggestion: waits until typing stops for half a second (debounce).
    // The cleanup cancels the timer when the user types again, and ignores answers that come back too late.
    useEffect(() => {
        const description = fields.description.trim();
        if (categoryPicked || description.length < 3) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const result = await api("/api/ai/categorize", { method: "POST", body: { description, type: fields.type } });
                if (cancelled) return;
                if (result.debit) {
                    setHint("Looks like an EMI or loan. Add it in the Debits & EMIs tab instead, so it isn't counted as spending.");
                } else if (result.category) {
                    update({ category: result.category });
                    setHint(`Picked "${categoryLabel(result.category)}" for you - change it if it's wrong.`);
                } else {
                    setHint("");
                }
            } catch {
                // suggestions are a nice extra; if they fail the user just picks a category
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [fields.description, fields.type, categoryPicked]);

    function changeType(type) {
        const first = type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
        update({ type, category: first });
        setCategoryPicked(false);
        setHint("");
    }

    async function save(event) {
        // stop the form from reloading the page
        event.preventDefault();

        const description = fields.description.trim();
        const amount = Number(fields.amount);

        // quick checks here for instant feedback; the server checks everything again
        if (description === "") return setError("Please enter a description.");
        if (!amount || amount <= 0) return setError("Please enter an amount greater than 0.");
        if (fields.date === "") return setError("Please pick a date.");
        if (fields.date > todayString()) return setError("The date can't be in the future.");

        setSaving(true);
        try {
            const body = { ...fields, description, amount };
            if (editing) {
                await api(`/api/transactions/${editing.id}`, { method: "PUT", body });
            } else {
                await api("/api/transactions", { method: "POST", body });
            }
            reset();
            onSaved(fields.date);
            descriptionInput.current.focus();
        } catch (err) {
            if (err.status === 401) return onError(err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function scanBill(event) {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file) return;

        setScanning(true);
        setScanStatus("Reading your bill...");
        try {
            const image = await compressImage(file);
            const { receipt } = await api("/api/ai/scan-receipt", { method: "POST", body: { image } });

            if (editing) onCancel();
            setFields({
                type: "expense",
                description: receipt.description,
                amount: receipt.amount || "",
                date: receipt.date || todayString(),
                category: receipt.category,
                paymentMode: receipt.paymentMode || "UPI"
            });
            setCategoryPicked(true);
            setHint("");
            setScanStatus("Filled in from your bill. Please check the details, then press Add.");
        } catch (err) {
            if (err.status === 401) return onError(err);
            setScanStatus(err.message);
        } finally {
            setScanning(false);
        }
    }

    const isExpense = fields.type === "expense";
    const categories = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    return (
        <section>
            <div className="section-header">
                <h3>{editing ? "Edit transaction" : "Add transaction"}</h3>
                {aiEnabled && (
                    <>
                        <button type="button" className="small-btn outline" disabled={scanning} onClick={() => fileInput.current.click()}>
                            Scan a bill
                        </button>
                        <input type="file" accept="image/*" hidden ref={fileInput} onChange={scanBill} />
                    </>
                )}
            </div>
            {scanStatus && <p className="hint">{scanStatus}</p>}

            <form onSubmit={save}>
                {/* expense or income toggle */}
                <div className="type-toggle">
                    <input type="radio" name="type" id="type-expense" checked={isExpense} onChange={() => changeType("expense")} />
                    <label htmlFor="type-expense">Expense</label>
                    <input type="radio" name="type" id="type-income" checked={!isExpense} onChange={() => changeType("income")} />
                    <label htmlFor="type-income">Income</label>
                </div>

                <label htmlFor="description">Description</label>
                <input
                    type="text"
                    id="description"
                    ref={descriptionInput}
                    placeholder="e.g. Swiggy order, Rent, Salary"
                    maxLength={60}
                    autoComplete="off"
                    value={fields.description}
                    onChange={(e) => update({ description: e.target.value })}
                />

                <div className="row">
                    <div>
                        <label htmlFor="amount">Amount (₹)</label>
                        <input type="number" id="amount" placeholder="0" min="0.01" step="0.01" value={fields.amount} onChange={(e) => update({ amount: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor="date">Date</label>
                        <input type="date" id="date" max={todayString()} value={fields.date} onChange={(e) => update({ date: e.target.value })} />
                    </div>
                </div>

                <div className="row">
                    <div>
                        <label htmlFor="category">Category</label>
                        <select
                            id="category"
                            value={fields.category}
                            onChange={(e) => {
                                update({ category: e.target.value });
                                setCategoryPicked(true);
                                setHint("");
                            }}
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {categoryLabel(c)}
                                </option>
                            ))}
                            {fields.category === OLD_EXPENSE_CATEGORY && <option value={OLD_EXPENSE_CATEGORY}>EMI & Loans (old)</option>}
                        </select>
                        {hint && <p className="hint">{hint}</p>}
                    </div>
                    <div>
                        <label htmlFor="payment-mode">{isExpense ? "Paid via" : "Received via"}</label>
                        <select id="payment-mode" value={fields.paymentMode} onChange={(e) => update({ paymentMode: e.target.value })}>
                            {PAYMENT_MODES.map((mode) => (
                                <option key={mode} value={mode}>
                                    {mode}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && <p className="form-error">{error}</p>}

                <div className="form-buttons">
                    <button type="submit" className="add-btn" disabled={saving}>
                        {editing ? "Save changes" : "Add Transaction"}
                    </button>
                    {editing && (
                        <button type="button" className="cancel-btn" onClick={onCancel}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}
