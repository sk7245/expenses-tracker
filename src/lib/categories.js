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
    "EMI & Loans",
    "Other Expense"
];

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
    return categoriesFor(type).includes(category);
}

module.exports = {
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    PAYMENT_MODES,
    TYPES,
    DEBT_DIRECTIONS,
    DEBT_SOURCES,
    categoriesFor,
    isValidCategory
};
