// same lists as the server (src/lib/categories.js); the server checks them again

export const EXPENSE_CATEGORIES = [
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

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Interest & Returns", "Gift", "Other Income"];

// EMIs moved to the Debits tab; only shown when editing an entry saved before that
export const OLD_EXPENSE_CATEGORY = "EMI & Loans";

export const PAYMENT_MODES = ["UPI", "Cash", "Debit Card", "Credit Card", "Net Banking"];

export const DEBT_SOURCES = ["Friend or family", "Loan app", "Bank loan", "Credit card", "Other"];

// "Other Expense" / "Other Income" are just "Other" on screen
export function categoryLabel(category) {
    return category.replace(/^Other (Expense|Income)$/, "Other");
}
