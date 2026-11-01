// Dates are stored as "YYYY-MM-DD" strings. A plain string has no timezone,
// so "05 Nov" stays "05 Nov" whether the server runs in India or in the US.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function pad(n) {
    return String(n).padStart(2, "0");
}

function toDateString(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDate(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

// checks the format AND that the day exists (so 2026-02-30 is rejected)
function isValidDate(dateString) {
    if (typeof dateString !== "string" || !DATE_PATTERN.test(dateString)) return false;
    return toDateString(parseDate(dateString)) === dateString;
}

function isValidMonth(monthString) {
    return typeof monthString === "string" && MONTH_PATTERN.test(monthString) && isValidDate(monthString + "-01");
}

function today() {
    return toDateString(new Date());
}

function addDays(dateString, days) {
    const date = parseDate(dateString);
    date.setUTCDate(date.getUTCDate() + days);
    return toDateString(date);
}

// "2026-11" -> { from: "2026-11-01", to: "2026-11-30" }
function monthRange(monthString) {
    const [y, m] = monthString.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    return { from: toDateString(first), to: toDateString(last) };
}

function currentMonth() {
    return today().slice(0, 7);
}

function previousMonth(monthString) {
    const [y, m] = monthString.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 2, 1));
    return toDateString(date).slice(0, 7);
}

// "2026-11-05" -> "05 Nov 2026"
function formatDate(dateString) {
    return parseDate(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

module.exports = {
    isValidDate,
    isValidMonth,
    today,
    addDays,
    monthRange,
    currentMonth,
    previousMonth,
    formatDate
};
