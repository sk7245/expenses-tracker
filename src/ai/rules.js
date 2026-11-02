// quick keyword matching before we ask the AI.
// most descriptions ("Swiggy order", "Jio recharge") are obvious, and this is instant and free.

const KEYWORDS = {
    expense: {
        "Food & Dining": ["swiggy", "zomato", "restaurant", "cafe", "coffee", "tea", "chai", "lunch", "dinner",
            "breakfast", "biryani", "pizza", "burger", "dominos", "mcdonald", "kfc", "snacks", "canteen", "mess", "food"],
        "Groceries": ["grocery", "groceries", "bigbasket", "blinkit", "zepto", "instamart", "dmart", "vegetables",
            "veggies", "milk", "kirana", "fruits", "ration"],
        "Transport": ["uber", "ola", "rapido", "auto", "bus", "metro", "train", "irctc", "cab", "taxi", "flight",
            "indigo", "redbus", "parking", "toll", "fastag"],
        "Fuel": ["petrol", "diesel", "fuel", "cng"],
        "Rent": ["rent", "pg", "hostel", "maintenance"],
        "Bills & Recharge": ["recharge", "jio", "airtel", "electricity", "current bill", "water bill", "gas",
            "cylinder", "wifi", "broadband", "internet", "dth", "tata play", "bill"],
        "Shopping": ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "clothes", "shirt", "jeans",
            "shoes", "shopping", "mall"],
        "Entertainment": ["movie", "netflix", "prime video", "hotstar", "spotify", "pvr", "inox", "bookmyshow",
            "concert", "game", "youtube premium"],
        "Health": ["medicine", "medical", "pharmacy", "apollo", "medplus", "pharmeasy", "1mg", "doctor",
            "hospital", "clinic", "gym", "lab test"],
        "Education": ["course", "book", "books", "fees", "fee", "tuition", "udemy", "coursera", "exam",
            "college", "stationery"]
    },
    income: {
        "Salary": ["salary", "stipend", "payroll"],
        "Freelance": ["freelance", "client", "fiverr", "upwork", "project payment"],
        "Business": ["business", "sales", "shop"],
        "Interest & Returns": ["interest", "dividend", "mutual fund", "returns", "fd", "refund", "cashback"],
        "Gift": ["gift", "birthday", "pocket money", "from mom", "from dad"]
    }
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// EMIs and loan repayments aren't spending - they belong in the Debits tab
const DEBIT_WORDS = ["emi", "emis", "loan", "credit card bill", "kreditbee", "moneyview", "kissht", "lazypay"];

function hasWord(text, word) {
    // \b = word boundary, so "bus" matches "bus ticket" but not "business"
    return new RegExp(`\\b${escapeRegex(word)}\\b`).test(text);
}

function looksLikeDebit(description) {
    const text = String(description || "").toLowerCase();
    return DEBIT_WORDS.some((word) => hasWord(text, word));
}

// returns a category name, or null if nothing matched
function categoryFromRules(description, type) {
    const text = String(description || "").toLowerCase();
    const groups = KEYWORDS[type] || KEYWORDS.expense;

    for (const [category, words] of Object.entries(groups)) {
        for (const word of words) {
            if (hasWord(text, word)) {
                return category;
            }
        }
    }
    return null;
}

module.exports = { categoryFromRules, looksLikeDebit, escapeRegex };
