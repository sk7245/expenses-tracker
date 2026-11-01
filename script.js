// name under which transactions are saved in the browser
const STORAGE_KEY = "expenses-tracker-transactions";

// elements from the page
const form = document.getElementById("transaction-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const categorySelect = document.getElementById("category");
const paymentSelect = document.getElementById("payment-mode");
const paymentLabel = document.getElementById("payment-label");
const expenseGroup = document.getElementById("expense-categories");
const incomeGroup = document.getElementById("income-categories");
const formError = document.getElementById("form-error");
const typeRadios = document.querySelectorAll('input[name="type"]');

const balanceText = document.getElementById("balance");
const incomeText = document.getElementById("total-income");
const expenseText = document.getElementById("total-expense");
const monthText = document.getElementById("current-month");

const monthFilter = document.getElementById("filter-month");
const categoryFilter = document.getElementById("filter-category");
const list = document.getElementById("transaction-list");
const emptyMessage = document.getElementById("empty-message");

// all transactions live in this array
let transactions = loadTransactions();


// ---- saving and loading (localStorage) ----

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Could not load saved transactions:", error);
        return [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
        console.error("Could not save transactions:", error);
    }
}


// ---- small helpers ----

// today's date as "2026-11-01" (the format date inputs use)
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

// 23731 -> "₹23,731" (Indian style commas, so 150000 -> "₹1,50,000")
function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "₹" + Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// "2026-11-05" -> "05 Nov"
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// "2026-11" -> "November 2026"
function formatMonth(monthString) {
    const [year, month] = monthString.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function getSelectedType() {
    return document.querySelector('input[name="type"]:checked').value;
}

function showError(message) {
    formError.textContent = message;
    formError.hidden = message === "";
}


// ---- form ----

// only show categories that match expense / income
function updateCategoryOptions() {
    const isExpense = getSelectedType() === "expense";
    const showGroup = isExpense ? expenseGroup : incomeGroup;
    const hideGroup = isExpense ? incomeGroup : expenseGroup;

    showGroup.hidden = false;
    showGroup.disabled = false;
    hideGroup.hidden = true;
    hideGroup.disabled = true;

    categorySelect.value = showGroup.querySelector("option").value;
    paymentLabel.textContent = isExpense ? "Paid via" : "Received via";
}

function addTransaction(event) {
    // stop the form from reloading the page
    event.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const date = dateInput.value;

    if (description === "") {
        showError("Please enter a description.");
        return;
    }
    if (!amount || amount <= 0) {
        showError("Please enter an amount greater than 0.");
        return;
    }
    if (date === "") {
        showError("Please pick a date.");
        return;
    }
    if (date > todayString()) {
        showError("The date can't be in the future.");
        return;
    }

    const transaction = {
        id: Date.now().toString(),
        description: description,
        amount: Math.round(amount * 100) / 100,
        type: getSelectedType(),
        category: categorySelect.value,
        paymentMode: paymentSelect.value,
        date: date
    };

    transactions.push(transaction);
    saveTransactions();

    // jump to the month of the new entry so it's visible
    monthFilter.value = date.slice(0, 7);

    showError("");
    descriptionInput.value = "";
    amountInput.value = "";
    descriptionInput.focus();

    render();
}

function deleteTransaction(id) {
    const transaction = transactions.find((t) => t.id === id);
    if (!transaction) return;

    if (!confirm(`Delete "${transaction.description}"?`)) return;

    transactions = transactions.filter((t) => t.id !== id);
    saveTransactions();
    render();
}


// ---- showing data on the page ----

function createRow(transaction) {
    const li = document.createElement("li");
    li.className = "transaction " + transaction.type;

    const info = document.createElement("div");
    info.className = "info";

    // textContent (not innerHTML) so whatever the user types is shown as plain text
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = transaction.description;

    const category = transaction.category.replace(/^Other (Expense|Income)$/, "Other");
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${category} · ${transaction.paymentMode} · ${formatDate(transaction.date)}`;

    info.append(name, meta);

    const amount = document.createElement("span");
    amount.className = "amount";
    amount.textContent = (transaction.type === "income" ? "+" : "-") + formatMoney(transaction.amount);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.title = "Delete";
    deleteButton.textContent = "✕";
    deleteButton.dataset.id = transaction.id;

    li.append(info, amount, deleteButton);
    return li;
}

function render() {
    const month = monthFilter.value || todayString().slice(0, 7);
    const category = categoryFilter.value;

    const monthTransactions = transactions.filter((t) => t.date.startsWith(month));

    // totals for the whole month (category filter doesn't change them)
    let income = 0;
    let expense = 0;
    for (const t of monthTransactions) {
        if (t.type === "income") {
            income += t.amount;
        } else {
            expense += t.amount;
        }
    }

    monthText.textContent = formatMonth(month);
    balanceText.textContent = formatMoney(income - expense);
    incomeText.textContent = formatMoney(income);
    expenseText.textContent = formatMoney(expense);

    // newest first; reverse() first so same-day entries show latest on top
    const visible = monthTransactions
        .filter((t) => category === "All" || t.category === category)
        .reverse()
        .sort((a, b) => b.date.localeCompare(a.date));

    list.innerHTML = "";
    for (const t of visible) {
        list.appendChild(createRow(t));
    }

    emptyMessage.hidden = visible.length > 0;
}


// ---- events ----

form.addEventListener("submit", addTransaction);

typeRadios.forEach((radio) => radio.addEventListener("change", updateCategoryOptions));

monthFilter.addEventListener("change", render);
categoryFilter.addEventListener("change", render);

// one listener on the list handles every delete button, even rows added later
list.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-btn");
    if (button) {
        deleteTransaction(button.dataset.id);
    }
});


// ---- start ----

dateInput.value = todayString();
dateInput.max = todayString();
monthFilter.value = todayString().slice(0, 7);
updateCategoryOptions();
render();
