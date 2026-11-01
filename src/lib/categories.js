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
    categoriesFor,
    isValidCategory
};
