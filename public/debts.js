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
        renderList();
    } catch (error) {
        onError(error);
    }
}

function renderList() {
    const settled = debts.filter((d) => d.settled);
    const visible = showSettledBox.checked ? debts : debts.filter((d) => !d.settled);

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

function createRow(debt) {
    const borrowed = debt.direction === "borrowed";
    const overdue = !debt.settled && debt.dueDate && debt.dueDate < todayString();

    const li = document.createElement("li");
    li.className = "debt " + debt.direction + (debt.settled ? " settled" : "") + (overdue ? " overdue" : "");

    // top line: who + details on the left, amount left on the right
    const top = document.createElement("div");
    top.className = "debt-top";

    const info = document.createElement("div");
    info.className = "info";
    const details = [borrowed ? "You borrowed" : "You lent", debt.source, formatDate(debt.date, true)];
    if (debt.dueDate && !debt.settled) details.push((overdue ? "was due " : "due ") + formatDate(debt.dueDate, true));
    info.append(makeSpan("name", debt.person), makeSpan("meta details", details.join(" · ")));
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
        actions.appendChild(makeButton(borrowed ? "I paid back" : "Got money back", "small-btn outline", "pay", debt.id));
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
    amount.value = debt.remaining;
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
        note: noteInput.value.trim()
    };

    if (body.person === "") return showError("Please enter who it's with.");
    if (!body.amount || body.amount <= 0) return showError("Please enter an amount greater than 0.");
    if (body.date === "") return showError("Please pick the date.");
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
