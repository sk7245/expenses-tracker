const EXPENSE_CATEGORIES = [
    "Food & Dining",
    "Groceries",
    "Transport",
    "Fuel",
    "Rent",
    "Bills & Recharge",
    "Shopping",
    "Entertainment",
    "Health",
    "Education",
    "Other Expense"
];

// EMIs and loan repayments now live in the Debits tab, not in spending.
// Still accepted so entries saved before that change can be shown and edited.
const OLD_EXPENSE_CATEGORIES = ["EMI & Loans"];

const INCOME_CATEGORIES = [
    "Salary",
    "Freelance",
    "Business",
    "Interest & Returns",
    "Gift",
    "Other Income"
];

const PAYMENT_MODES = ["UPI", "Cash", "Debit Card", "Credit Card", "Net Banking"];

const TYPES = ["expense", "income"];

// loans and money between friends
const DEBT_DIRECTIONS = ["borrowed", "lent"];
const DEBT_SOURCES = ["Friend or family", "Loan app", "Bank loan", "Credit card", "Other"];

function categoriesFor(type) {
    return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function isValidCategory(type, category) {
    if (type === "expense" && OLD_EXPENSE_CATEGORIES.includes(category)) return true;
    return categoriesFor(type).includes(category);
}

module.exports = {
    EXPENSE_CATEGORIES,
    OLD_EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    PAYMENT_MODES,
    TYPES,
    DEBT_DIRECTIONS,
    DEBT_SOURCES,
    categoriesFor,
    isValidCategory
};
