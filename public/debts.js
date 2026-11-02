// "Loans & dues": money borrowed (loan apps, friends, bank) and money lent to others
import { api } from "./api.js";
import { todayString, formatMoney, formatDate } from "./format.js";

const addButton = document.getElementById("debt-add-btn");
const form = document.getElementById("debt-form");
const personInput = document.getElementById("debt-person");
const personLabel = document.getElementById("debt-person-label");
const sourceSelect = document.getElementById("debt-source");
const amountInput = document.getElementById("debt-amount");
const dateInput = document.getElementById("debt-date");
const dueInput = document.getElementById("debt-due");
const emiInput = document.getElementById("debt-emi");
const emiDayInput = document.getElementById("debt-emi-day");
const emiTotalText = document.getElementById("debt-emi-total");
const noteInput = document.getElementById("debt-note");
const formError = document.getElementById("debt-error");
const saveButton = document.getElementById("debt-save");
const list = document.getElementById("debt-list");
const emptyMessage = document.getElementById("debt-empty");
const oweText = document.getElementById("debt-owe");
const owedText = document.getElementById("debt-owed");
const showSettledLabel = document.getElementById("show-settled-label");
const showSettledBox = document.getElementById("show-settled");
const settledCount = document.getElementById("settled-count");

let debts = [];
let editingId = null;
let onError = (error) => alert(error.message);

function getDirection() {
    return document.querySelector('input[name="direction"]:checked').value;
}

function showError(message) {
    formError.textContent = message;
    formError.hidden = message === "";
}

function updatePersonLabel() {
    personLabel.textContent = getDirection() === "borrowed" ? "From whom" : "To whom";
}


// ---- loading and showing ----

async function loadDebts() {
    try {
        const result = await api("/api/debts");
        debts = result.debts;
        oweText.textContent = formatMoney(result.totals.iOwe);
        owedText.textContent = formatMoney(result.totals.owedToMe);
        emiTotalText.textContent = formatMoney(result.totals.emiPerMonth);
        renderList();
    } catch (error) {
        onError(error);
    }
}

// the next date something has to be paid: this month's (or next month's) EMI, or the pay back date
function nextDate(debt) {
    if (debt.settled) return null;
    if (debt.emi) {
        const emi = emiStatus(debt);
        // EMI already paid this month -> the next one is about a month away, so sort it after others
        return emi.paid ? "9999-" + emi.dueDate : emi.dueDate;
    }
    return debt.dueDate;
}

function renderList() {
    const settled = debts.filter((d) => d.settled);
    let visible = showSettledBox.checked ? debts : debts.filter((d) => !d.settled);

    // open ones first, the most urgent on top; no date at all goes last. sort() keeps the server's order for ties
    visible = [...visible].sort((a, b) => {
        if (a.settled !== b.settled) return a.settled ? 1 : -1;
        const dateA = nextDate(a);
        const dateB = nextDate(b);
        if (dateA === dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA < dateB ? -1 : 1;
    });

    list.innerHTML = "";
    for (const debt of visible) {
        list.appendChild(createRow(debt));
    }

    emptyMessage.hidden = visible.length > 0;
    showSettledLabel.hidden = settled.length === 0;
    settledCount.textContent = settled.length;
}

function makeButton(text, className, action, id) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
}

function makeSpan(className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
}

// 5 -> "5th", 22 -> "22nd"
function ordinal(day) {
    if (day >= 11 && day <= 13) return day + "th";
    return day + ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");
}

// the EMI date in a given month. An EMI on the 31st is paid on the 30th in a 30-day month (28th in February)
function emiDateIn(year, monthNumber, emiDay) {
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(Math.min(emiDay, lastDay)).padStart(2, "0")}`;
}

// this month's EMI: when it's due and whether it's been paid
function emiStatus(debt) {
    const today = todayString();
    const month = today.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);

    // a loan taken this month usually starts its EMIs next month
    if (debt.date.startsWith(month)) {
        const next = monthNumber === 12 ? emiDateIn(year + 1, 1, debt.emiDay) : emiDateIn(year, monthNumber + 1, debt.emiDay);
        return { dueDate: next, paid: false, late: false };
    }
    const dueDate = emiDateIn(year, monthNumber, debt.emiDay);

    const paidThisMonth = debt.payments.filter((p) => p.date.startsWith(month)).reduce((sum, p) => sum + p.amount, 0);
    // what this month's EMI was, before anything was paid this month (the last one can be smaller)
    const due = Math.min(debt.emi, debt.remaining + paidThisMonth);
    const paid = paidThisMonth >= due;

    return { dueDate, paid, late: !paid && dueDate < today };
}

function createRow(debt) {
    const borrowed = debt.direction === "borrowed";
    const emi = debt.emi && !debt.settled ? emiStatus(debt) : null;
    const overdue = !debt.settled && ((debt.dueDate && debt.dueDate < todayString()) || emi?.late);

    const li = document.createElement("li");
    li.className = "debt " + debt.direction + (debt.settled ? " settled" : "") + (overdue ? " overdue" : "");

    // top line: who + details on the left, amount left on the right
    const top = document.createElement("div");
    top.className = "debt-top";

    const info = document.createElement("div");
    info.className = "info";
    const details = [borrowed ? "You borrowed" : "You lent", debt.source, formatDate(debt.date, true)];
    if (debt.emi) details.push(`EMI ${formatMoney(debt.emi)} on the ${ordinal(debt.emiDay)}`);
    if (debt.dueDate && !debt.settled) details.push("pay back by " + formatDate(debt.dueDate, true));
    info.append(makeSpan("name", debt.person), makeSpan("meta", details.join(" · ")));

    if (emi) {
        let status = `This month's EMI paid ✓`;
        if (!emi.paid) status = (emi.late ? "EMI was due " : "Next EMI due ") + formatDate(emi.dueDate, true);
        info.appendChild(makeSpan("meta status" + (emi.late ? " late" : emi.paid ? " done" : ""), status));
    } else if (debt.dueDate && !debt.settled && debt.dueDate < todayString()) {
        info.appendChild(makeSpan("meta status late", "Past the pay back date"));
    }
    if (debt.note) info.appendChild(makeSpan("meta note", debt.note));

    const money = document.createElement("div");
    money.className = "debt-money";
    if (debt.settled) {
        money.append(makeSpan("amount", "Paid off"), makeSpan("meta", formatMoney(debt.amount)));
    } else {
        money.append(makeSpan("amount", formatMoney(debt.remaining)), makeSpan("meta", "left of " + formatMoney(debt.amount)));
    }
    top.append(info, money);

    // how much is paid back
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.round((debt.paid / debt.amount) * 100)}%`;
    track.appendChild(fill);

    const actions = document.createElement("div");
    actions.className = "debt-actions";
    if (!debt.settled) {
        let label = borrowed ? "I paid back" : "Got money back";
        if (borrowed && debt.emi) label = "Pay EMI";
        actions.appendChild(makeButton(label, "small-btn outline", "pay", debt.id));
    }
    if (debt.payments.length > 0) {
        actions.appendChild(makeButton(`Payments (${debt.payments.length})`, "link-btn", "history", debt.id));
    }
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    actions.append(spacer, makeButton("Edit", "link-btn", "edit", debt.id), makeButton("Delete", "link-btn danger", "delete", debt.id));

    li.append(top, track, actions, createPayForm(debt), createPaymentList(debt));
    return li;
}

// small form inside the row, opened by "I paid back"
function createPayForm(debt) {
    const payForm = document.createElement("form");
    payForm.className = "pay-form";
    payForm.dataset.id = debt.id;
    payForm.hidden = true;

    const amount = document.createElement("input");
    amount.type = "number";
    amount.name = "amount";
    amount.min = "0.01";
    amount.step = "0.01";
    amount.max = debt.remaining;
    // an EMI loan is usually paid one EMI at a time; anything else in one go
    amount.value = debt.emi ? Math.min(debt.emi, debt.remaining) : debt.remaining;
    amount.setAttribute("aria-label", "Amount paid");

    const date = document.createElement("input");
    date.type = "date";
    date.name = "date";
    date.value = todayString();
    date.min = debt.date;
    date.max = todayString();
    date.setAttribute("aria-label", "Date paid");

    const save = document.createElement("button");
    save.type = "submit";
    save.className = "small-btn";
    save.textContent = "Save";

    const error = document.createElement("p");
    error.className = "form-error";
    error.hidden = true;

    const fields = document.createElement("div");
    fields.className = "pay-fields";
    fields.append(amount, date, save);
    payForm.append(fields, error);
    return payForm;
}

function createPaymentList(debt) {
    const ul = document.createElement("ul");
    ul.className = "payment-list";
    ul.hidden = true;
    for (const payment of debt.payments) {
        const li = document.createElement("li");
        li.append(
            makeSpan("", `${formatDate(payment.date, true)} · ${formatMoney(payment.amount)}`),
            makeButton("Undo", "link-btn", "undo-payment", debt.id)
        );
        li.lastChild.dataset.paymentId = payment.id;
        ul.appendChild(li);
    }
    return ul;
}


// ---- add / edit form ----

function openForm(debt = null) {
    editingId = debt ? debt.id : null;
    document.getElementById(debt?.direction === "lent" ? "dir-lent" : "dir-borrowed").checked = true;
    personInput.value = debt ? debt.person : "";
    sourceSelect.value = debt ? debt.source : "Friend or family";
    amountInput.value = debt ? debt.amount : "";
    dateInput.value = debt ? debt.date : todayString();
    dueInput.value = debt?.dueDate || "";
    emiInput.value = debt?.emi || "";
    emiDayInput.value = debt?.emiDay || "";
    noteInput.value = debt ? debt.note : "";
    saveButton.textContent = debt ? "Save changes" : "Save";
    updatePersonLabel();
    showError("");

    form.hidden = false;
    addButton.hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    personInput.focus();
}

function closeForm() {
    editingId = null;
    form.hidden = true;
    addButton.hidden = false;
}

async function saveDebt(event) {
    event.preventDefault();

    const body = {
        direction: getDirection(),
        person: personInput.value.trim(),
        source: sourceSelect.value,
        amount: Number(amountInput.value),
        date: dateInput.value,
        dueDate: dueInput.value,
        emi: emiInput.value ? Number(emiInput.value) : null,
        emiDay: emiDayInput.value ? Number(emiDayInput.value) : null,
        note: noteInput.value.trim()
    };

    if (body.person === "") return showError("Please enter who it's with.");
    if (!body.amount || body.amount <= 0) return showError("Please enter an amount greater than 0.");
    if (body.date === "") return showError("Please pick the date.");
    if (body.emi !== null && body.emi > body.amount) return showError("The EMI can't be more than the total.");
    if (body.dueDate && body.dueDate < body.date) return showError("The due date can't be before the loan date.");

    saveButton.disabled = true;
    try {
        if (editingId) {
            await api(`/api/debts/${editingId}`, { method: "PUT", body });
        } else {
            await api("/api/debts", { method: "POST", body });
        }
        closeForm();
        await loadDebts();
    } catch (error) {
        if (error.status === 401) return onError(error);
        showError(error.message);
    } finally {
        saveButton.disabled = false;
    }
}


// ---- actions on a row ----

async function savePayment(payForm) {
    const error = payForm.querySelector(".form-error");
    const amount = Number(payForm.elements.amount.value);
    const date = payForm.elements.date.value;

    if (!amount || amount <= 0) {
        error.textContent = "Enter an amount greater than 0.";
        error.hidden = false;
        return;
    }

    try {
        await api(`/api/debts/${payForm.dataset.id}/payments`, { method: "POST", body: { amount, date } });
        await loadDebts();
    } catch (err) {
        if (err.status === 401) return onError(err);
        error.textContent = err.message;
        error.hidden = false;
    }
}

async function handleRowClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const debt = debts.find((d) => d.id === button.dataset.id);
    if (!debt) return;
    const row = button.closest(".debt");

    try {
        switch (button.dataset.action) {
            case "pay": {
                const payForm = row.querySelector(".pay-form");
                payForm.hidden = !payForm.hidden;
                if (!payForm.hidden) payForm.elements.amount.select();
                break;
            }
            case "history": {
                const payments = row.querySelector(".payment-list");
                payments.hidden = !payments.hidden;
                break;
            }
            case "edit":
                openForm(debt);
                break;
            case "delete":
                if (!confirm(`Delete the loan with ${debt.person}? Its payments will be deleted too.`)) return;
                await api(`/api/debts/${debt.id}`, { method: "DELETE" });
                if (editingId === debt.id) closeForm();
                await loadDebts();
                break;
            case "undo-payment":
                if (!confirm("Remove this payment?")) return;
                await api(`/api/debts/${debt.id}/payments/${button.dataset.paymentId}`, { method: "DELETE" });
                await loadDebts();
                break;
        }
    } catch (error) {
        onError(error);
    }
}


// ---- start ----

export function startDebts(handleError) {
    onError = handleError;

    addButton.addEventListener("click", () => openForm());
    document.getElementById("debt-cancel").addEventListener("click", closeForm);
    form.addEventListener("submit", saveDebt);
    document.querySelectorAll('input[name="direction"]').forEach((radio) => radio.addEventListener("change", updatePersonLabel));
    showSettledBox.addEventListener("change", renderList);

    list.addEventListener("click", handleRowClick);
    list.addEventListener("submit", (event) => {
        event.preventDefault();
        savePayment(event.target);
    });

    dateInput.max = todayString();
    loadDebts();
}
