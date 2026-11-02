// small helpers used by more than one page script

export function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

// 150000 -> "₹1,50,000"
export function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "₹" + Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// "2026-11-05" -> "05 Nov"
export function formatDate(dateString, withYear = false) {
    const [year, month, day] = dateString.split("-").map(Number);
    const options = withYear ? { day: "2-digit", month: "short", year: "numeric" } : { day: "2-digit", month: "short" };
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", options);
}
