# Expenses Tracker

A simple web app to keep track of my monthly income and spending. I built it because I wanted one place to see where my money actually goes each month — rent, food orders, recharges, travel — instead of guessing at the end of the month.

**Live demo:** _coming soon_

## Features

- Add income and expenses with description, amount, date, category and payment mode (UPI, cash, card, net banking)
- Categories change based on the type — expense categories like Food & Dining, Rent, Bills & Recharge, and income categories like Salary, Freelance
- Monthly view: balance, total income and total spent for the selected month
- Filter history by month and category
- Delete a transaction (with a confirmation)
- Amounts shown in Indian format (₹1,50,000)
- Data is saved in the browser, so it stays after a refresh
- Works on mobile screens

## Built with

- HTML
- CSS (Flexbox, CSS variables, media queries)
- JavaScript (DOM, events, localStorage)

No frameworks or libraries.

## Run it locally

1. Clone the repo
   ```
   git clone https://github.com/<your-username>/expenses-tracker.git
   ```
2. Open the folder in VS Code
3. Right-click `index.html` → **Open with Live Server** (or just open `index.html` in a browser)

## How it works

- All transactions are kept in one JavaScript array. Every add or delete updates the array, saves it to `localStorage`, and then calls `render()` to redraw the page from that array.
- `render()` filters transactions for the selected month and category, calculates the totals, and builds the list.
- User input is added to the page with `textContent` instead of `innerHTML`, so text like `<script>` is shown as plain text and never runs.
- The delete buttons use event delegation — one click listener on the list instead of one per row.

## What's next

- [ ] Backend with Node.js, Express and MongoDB so data is stored online
- [ ] Login, so friends can use it with their own accounts
- [ ] AI features: auto-pick the category from the description, and ask questions like "how much did I spend on food this month?"
- [ ] Deploy the full version
