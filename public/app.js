import { api } from "./api.js";

// data the old (browser-only) version saved
const OLD_STORAGE_KEY = "expenses-tracker-transactions";

// elements from the page
const form = document.getElementById("transaction-form");
const formTitle = document.getElementById("form-title");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const categorySelect = document.getElementById("category");
const categoryHint = document.getElementById("category-hint");
const paymentSelect = document.getElementById("payment-mode");
const paymentLabel = document.getElementById("payment-label");
const expenseGroup = document.getElementById("expense-categories");
const incomeGroup = document.getElementById("income-categories");
const formError = document.getElementById("form-error");
const addButton = document.getElementById("add-btn");
const cancelEditButton = document.getElementById("cancel-edit");
const typeRadios = document.querySelectorAll('input[name="type"]');

const balanceText = document.getElementById("balance");
const incomeText = document.getElementById("total-income");
const expenseText = document.getElementById("total-expense");
const monthText = document.getElementById("current-month");

const monthFilter = document.getElementById("filter-month");
const categoryFilter = document.getElementById("filter-category");
const list = document.getElementById("transaction-list");
const emptyMessage = document.getElementById("empty-message");

const breakdownSection = document.getElementById("breakdown-section");
const breakdown = document.getElementById("breakdown");

const askSection = document.getElementById("ask-section");
const askForm = document.getElementById("ask-form");
const askInput = document.getElementById("ask-input");
const askButton = document.getElementById("ask-btn");
const askResult = document.getElementById("ask-result");
const askAnswer = document.getElementById("ask-answer");
const askMeta = document.getElementById("ask-meta");
const askList = document.getElementById("ask-list");

const scanButton = document.getElementById("scan-btn");
const scanInput = document.getElementById("scan-input");
const scanStatus = document.getElementById("scan-status");

// what's on screen right now
let transactions = [];
let editingId = null;
let aiEnabled = false;
// once the user picks a category by hand, auto-suggest stops changing it
let categoryPickedByUser = false;
let suggestTimer = null;


// ---- small helpers ----

function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

// 150000 -> "₹1,50,000"
function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "₹" + Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// "2026-11-05" -> "05 Nov"
function formatDate(dateString, withYear = false) {
    const [year, month, day] = dateString.split("-").map(Number);
    const options = withYear ? { day: "2-digit", month: "short", year: "numeric" } : { day: "2-digit", month: "short" };
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", options);
}

// "2026-11" -> "November 2026"
function formatMonth(monthString) {
    const [year, month] = monthString.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// "Other Expense" / "Other Income" are just "Other" on screen
function categoryLabel(category) {
    return category.replace(/^Other (Expense|Income)$/, "Other");
}

function getSelectedType() {
    return document.querySelector('input[name="type"]:checked').value;
}

function setType(type) {
    document.getElementById(type === "income" ? "type-income" : "type-expense").checked = true;
    updateCategoryOptions(false);
}

function showError(message) {
    formError.textContent = message;
    formError.hidden = message === "";
}

function showHint(element, message) {
    element.textContent = message;
    element.hidden = message === "";
}

function selectedMonth() {
    return monthFilter.value || todayString().slice(0, 7);
}


// ---- loading data from the server ----

async function loadMonth() {
    const month = selectedMonth();
    const category = categoryFilter.value;

    try {
        const [listResult, summary] = await Promise.all([
            api(`/api/transactions?month=${month}&category=${encodeURIComponent(category)}`),
            api(`/api/transactions/summary?month=${month}`)
        ]);
        transactions = listResult.transactions;
        renderSummary(summary);
        renderList();
    } catch (error) {
        handleError(error);
    }
}

// 401 means the login expired: go back to the login page
function handleError(error) {
    if (error.status === 401) {
        window.location.href = "/login.html";
        return;
    }
    alert(error.message);
}


// ---- showing data on the page ----

function renderSummary(summary) {
    monthText.textContent = formatMonth(summary.month);
    balanceText.textContent = formatMoney(summary.balance);
    incomeText.textContent = formatMoney(summary.income);
    expenseText.textContent = formatMoney(summary.expense);

    // simple bar for each category, longest = most spent
    breakdown.innerHTML = "";
    breakdownSection.hidden = summary.spendingByCategory.length === 0;
    const biggest = summary.spendingByCategory[0]?.total || 1;

    for (const item of summary.spendingByCategory) {
        const row = document.createElement("div");
        row.className = "bar-row";

        const name = document.createElement("span");
        name.className = "bar-name";
        name.textContent = categoryLabel(item.category);

        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${Math.max(3, (item.total / biggest) * 100)}%`;
        track.appendChild(fill);

        const amount = document.createElement("span");
        amount.className = "bar-amount";
        const percent = summary.expense > 0 ? Math.round((item.total / summary.expense) * 100) : 0;
        amount.textContent = `${formatMoney(item.total)} · ${percent}%`;

        row.append(name, track, amount);
        breakdown.appendChild(row);
    }
}

function createRow(transaction) {
    const li = document.createElement("li");
    li.className = "transaction " + transaction.type;

    const info = document.createElement("div");
    info.className = "info";

    // textContent (not innerHTML) so whatever the user typed is shown as plain text
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = transaction.description;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${categoryLabel(transaction.category)} · ${transaction.paymentMode} · ${formatDate(transaction.date)}`;

    info.append(name, meta);

    const amount = document.createElement("span");
    amount.className = "amount";
    amount.textContent = (transaction.type === "income" ? "+" : "-") + formatMoney(transaction.amount);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "row-btn edit-btn";
    editButton.title = "Edit";
    editButton.textContent = "✎";
    editButton.dataset.id = transaction.id;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "row-btn delete-btn";
    deleteButton.title = "Delete";
    deleteButton.textContent = "✕";
    deleteButton.dataset.id = transaction.id;

    li.append(info, amount, editButton, deleteButton);
    return li;
}

function renderList() {
    list.innerHTML = "";
    for (const t of transactions) {
        list.appendChild(createRow(t));
    }
    emptyMessage.hidden = transactions.length > 0;
}


// ---- form ----

// only show categories that match expense / income
function updateCategoryOptions(resetCategory = true) {
    const isExpense = getSelectedType() === "expense";
    const showGroup = isExpense ? expenseGroup : incomeGroup;
    const hideGroup = isExpense ? incomeGroup : expenseGroup;

    showGroup.hidden = false;
    showGroup.disabled = false;
    hideGroup.hidden = true;
    hideGroup.disabled = true;

    if (resetCategory) {
        categorySelect.value = showGroup.querySelector("option").value;
        categoryPickedByUser = false;
        showHint(categoryHint, "");
        suggestCategory();
    }
    paymentLabel.textContent = isExpense ? "Paid via" : "Received via";
}

function resetForm() {
    editingId = null;
    formTitle.textContent = "Add transaction";
    addButton.textContent = "Add Transaction";
    cancelEditButton.hidden = true;

    descriptionInput.value = "";
    amountInput.value = "";
    dateInput.value = todayString();
    setType("expense");
    updateCategoryOptions(true);
    paymentSelect.value = "UPI";
    showError("");
    showHint(scanStatus, "");
}

async function saveTransaction(event) {
    // stop the form from reloading the page
    event.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const date = dateInput.value;

    // quick checks here for instant feedback; the server checks everything again
    if (description === "") return showError("Please enter a description.");
    if (!amount || amount <= 0) return showError("Please enter an amount greater than 0.");
    if (date === "") return showError("Please pick a date.");
    if (date > todayString()) return showError("The date can't be in the future.");

    const body = {
        description,
        amount,
        date,
        type: getSelectedType(),
        category: categorySelect.value,
        paymentMode: paymentSelect.value
    };

    addButton.disabled = true;
    try {
        if (editingId) {
            await api(`/api/transactions/${editingId}`, { method: "PUT", body });
        } else {
            await api("/api/transactions", { method: "POST", body });
        }

        // jump to the month of the saved entry so it's visible
        monthFilter.value = date.slice(0, 7);
        resetForm();
        descriptionInput.focus();
        await loadMonth();
    } catch (error) {
        if (error.status === 401) return handleError(error);
        showError(error.message);
    } finally {
        addButton.disabled = false;
    }
}

function startEdit(id) {
    const t = transactions.find((item) => item.id === id);
    if (!t) return;

    editingId = id;
    formTitle.textContent = "Edit transaction";
    addButton.textContent = "Save changes";
    cancelEditButton.hidden = false;

    setType(t.type);
    descriptionInput.value = t.description;
    amountInput.value = t.amount;
    dateInput.value = t.date;
    categorySelect.value = t.category;
    categoryPickedByUser = true;
    paymentSelect.value = t.paymentMode;
    showError("");
    showHint(categoryHint, "");

    form.scrollIntoView({ behavior: "smooth", block: "center" });
    descriptionInput.focus();
}

async function deleteTransaction(id) {
    const t = transactions.find((item) => item.id === id);
    if (!t) return;
    if (!confirm(`Delete "${t.description}"?`)) return;

    try {
        await api(`/api/transactions/${id}`, { method: "DELETE" });
        if (editingId === id) resetForm();
        await loadMonth();
    } catch (error) {
        handleError(error);
    }
}


// ---- AI: category suggestion ----

// waits until the user stops typing for half a second, so we don't call the server on every key
function scheduleSuggestion() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(suggestCategory, 500);
}

async function suggestCategory() {
    const description = descriptionInput.value.trim();
    if (categoryPickedByUser || description.length < 3) return;

    const type = getSelectedType();
    try {
        const result = await api("/api/ai/categorize", { method: "POST", body: { description, type } });

        // the user may have typed more or switched type while we waited
        if (descriptionInput.value.trim() !== description || getSelectedType() !== type || categoryPickedByUser) return;

        if (result.category) {
            categorySelect.value = result.category;
            showHint(categoryHint, `Picked "${categoryLabel(result.category)}" for you - change it if it's wrong.`);
        }
    } catch {
        // suggestions are a nice extra; if they fail the user just picks a category
    }
}


// ---- AI: scan a bill ----

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

async function scanBill() {
    const file = scanInput.files[0];
    scanInput.value = "";
    if (!file) return;

    scanButton.disabled = true;
    showHint(scanStatus, "Reading your bill...");

    try {
        const image = await compressImage(file);
        const { receipt } = await api("/api/ai/scan-receipt", { method: "POST", body: { image } });

        if (editingId) resetForm();
        setType("expense");
        descriptionInput.value = receipt.description;
        if (receipt.amount) amountInput.value = receipt.amount;
        if (receipt.date) dateInput.value = receipt.date;
        categorySelect.value = receipt.category;
        categoryPickedByUser = true;
        if (receipt.paymentMode) paymentSelect.value = receipt.paymentMode;
        showHint(categoryHint, "");

        showHint(scanStatus, "Filled in from your bill. Please check the details, then press Add.");
    } catch (error) {
        if (error.status === 401) return handleError(error);
        showHint(scanStatus, error.message);
    } finally {
        scanButton.disabled = false;
    }
}


// ---- AI: ask a question ----

async function ask(question) {
    question = question.trim();
    if (question.length < 3) return;

    askButton.disabled = true;
    askResult.hidden = false;
    askAnswer.textContent = "Looking through your transactions...";
    askMeta.textContent = "";
    askList.innerHTML = "";

    try {
        const result = await api("/api/ai/ask", { method: "POST", body: { question } });
        askAnswer.textContent = result.answer;

        if (result.facts) {
            const plan = result.plan;
            const parts = [`${formatDate(plan.startDate, true)} - ${formatDate(plan.endDate, true)}`];
            if (plan.categories.length > 0) parts.push(plan.categories.map(categoryLabel).join(", "));
            if (plan.searchText) parts.push(`"${plan.searchText}"`);
            parts.push(`${result.facts.count} matching`);
            askMeta.textContent = "Searched: " + parts.join(" · ");
        }

        for (const t of result.transactions.slice(0, 5)) {
            const li = document.createElement("li");
            li.textContent = `${formatDate(t.date)} · ${t.description} · ${t.type === "income" ? "+" : "-"}${formatMoney(t.amount)}`;
            askList.appendChild(li);
        }
    } catch (error) {
        if (error.status === 401) return handleError(error);
        askAnswer.textContent = error.message;
    } finally {
        askButton.disabled = false;
    }
}


// ---- bring over data from the old version ----

function readOldData() {
    try {
        const saved = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function checkForOldData() {
    const old = readOldData();
    if (old.length === 0) return;

    document.getElementById("import-text").textContent =
        `Found ${old.length} transaction${old.length === 1 ? "" : "s"} saved in this browser by the old version. Add them to your account?`;
    document.getElementById("import-banner").hidden = false;
}

async function importOldData() {
    const old = readOldData();
    try {
        const result = await api("/api/transactions/import", { method: "POST", body: { transactions: old } });
        localStorage.removeItem(OLD_STORAGE_KEY);
        document.getElementById("import-banner").hidden = true;
        alert(`Imported ${result.imported} transaction(s).` + (result.skipped ? ` ${result.skipped} couldn't be read and were skipped.` : ""));
        await loadMonth();
    } catch (error) {
        handleError(error);
    }
}


// ---- events ----

form.addEventListener("submit", saveTransaction);
cancelEditButton.addEventListener("click", resetForm);

typeRadios.forEach((radio) => radio.addEventListener("change", () => updateCategoryOptions(true)));
descriptionInput.addEventListener("input", scheduleSuggestion);
categorySelect.addEventListener("change", () => {
    categoryPickedByUser = true;
    showHint(categoryHint, "");
});

monthFilter.addEventListener("change", loadMonth);
categoryFilter.addEventListener("change", loadMonth);

// one listener on the list handles every edit / delete button, even rows added later
list.addEventListener("click", (event) => {
    const button = event.target.closest(".row-btn");
    if (!button) return;
    if (button.classList.contains("edit-btn")) startEdit(button.dataset.id);
    else deleteTransaction(button.dataset.id);
});

askForm.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(askInput.value);
});
document.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
        askInput.value = chip.textContent;
        ask(chip.textContent);
    })
);

scanButton.addEventListener("click", () => scanInput.click());
scanInput.addEventListener("change", scanBill);

document.getElementById("import-btn").addEventListener("click", importOldData);
document.getElementById("import-dismiss").addEventListener("click", () => {
    document.getElementById("import-banner").hidden = true;
});

document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
        await api("/api/auth/logout", { method: "POST" });
    } finally {
        window.location.href = "/login.html";
    }
});


// ---- start ----

async function start() {
    let user;
    try {
        ({ user } = await api("/api/auth/me"));
    } catch {
        window.location.href = "/login.html";
        return;
    }

    document.getElementById("user-name").textContent = `Hi, ${user.name.split(" ")[0]}`;

    try {
        aiEnabled = (await api("/api/ai/status")).enabled;
    } catch {
        aiEnabled = false;
    }
    askSection.hidden = !aiEnabled;
    scanButton.hidden = !aiEnabled;

    dateInput.max = todayString();
    monthFilter.value = todayString().slice(0, 7);
    resetForm();
    checkForOldData();
    await loadMonth();
}

start();
