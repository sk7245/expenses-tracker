// EMI date maths for the Debits tab (plain functions, no React, so they're easy to test and reuse)
import { todayString } from "./format.js";

// 5 -> "5th", 22 -> "22nd"
export function ordinal(day) {
    if (day >= 11 && day <= 13) return day + "th";
    return day + ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");
}

// the EMI date in a given month. An EMI on the 31st is paid on the 30th in a 30-day month (28th in February)
function emiDateIn(year, monthNumber, emiDay) {
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(Math.min(emiDay, lastDay)).padStart(2, "0")}`;
}

// this month's EMI: when it's due and whether it's been paid
export function emiStatus(debt) {
    const today = todayString();
    const month = today.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);

    // a loan taken this month usually starts its EMIs next month
    if (debt.date.startsWith(month)) {
        const next = monthNumber === 12 ? emiDateIn(year + 1, 1, debt.emiDay) : emiDateIn(year, monthNumber + 1, debt.emiDay);
        return { dueDate: next, paid: false, late: false };
    }
    const dueDate = emiDateIn(year, monthNumber, debt.emiDay);

    const paidThisMonth = debt.payments.filter((p) => p.date.startsWith(month)).reduce((sum, p) => sum + p.amount, 0);
    // what this month's EMI was, before anything was paid this month (the last one can be smaller)
    const due = Math.min(debt.emi, debt.remaining + paidThisMonth);
    const paid = paidThisMonth >= due;

    return { dueDate, paid, late: !paid && dueDate < today };
}

// the next date something has to be paid: this month's (or next month's) EMI, or the pay back date
function nextDate(debt) {
    if (debt.settled) return null;
    if (debt.emi) {
        const emi = emiStatus(debt);
        // EMI already paid this month -> the next one is about a month away, so sort it after others
        return emi.paid ? "9999-" + emi.dueDate : emi.dueDate;
    }
    return debt.dueDate;
}

// open ones first, the most urgent on top; no date at all goes last
export function sortByUrgency(debts) {
    return [...debts].sort((a, b) => {
        if (a.settled !== b.settled) return a.settled ? 1 : -1;
        const dateA = nextDate(a);
        const dateB = nextDate(b);
        if (dateA === dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA < dateB ? -1 : 1;
    });
}
