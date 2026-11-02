# Expenses Tracker

A MERN web app (MongoDB, Express, React, Node.js) to track spending, income, loans and EMIs, built for me and my friends. Each person has their own account, and AI helps with the boring parts: picking categories, reading bills, and answering questions like *"how much did I spend on food last month?"*

**Live demo:** https://expenses-tracker-xaiw.onrender.com (free hosting, so the first load can take up to a minute)

## Features

**Tracking**
- Sign up / log in. Every user only ever sees their own data
- Add, edit and delete income and expenses: description, amount, date, category, payment mode (UPI, cash, card, net banking)
- Indian categories (Food & Dining, Rent, Bills & Recharge, EMI & Loans, ...) and amounts in Indian format (₹1,50,000)
- Monthly view: balance, income, spent, and a "where it went" bar chart by category
- Filter history by month and category
- Works on phones

**Debits & EMIs** (a separate tab, because paying an EMI isn't the same as spending)
- Track money you borrowed (loan apps, friends, bank loans, credit card) and money you lent
- Monthly EMIs: EMI amount and date, "next EMI due" / "this month's EMI paid", late EMIs in red
- Pay back in parts: each payment is saved, with a progress bar and how much is left
- Totals: what you owe, your EMIs every month, and what others owe you
- Typing an EMI or loan as an expense shows a hint to add it under Debits instead
- Undo a payment entered by mistake; paid-off loans are hidden until you ask for them

**AI** (Google Gemini)
- **Auto category**: type "Swiggy biryani" and Food & Dining is picked for you
- **Scan a bill**: take a photo of a bill or UPI payment screenshot and the form fills itself
- **Ask about your money**: ask questions in plain English and get answers from your own data

## Built with

| Part | Tech |
|---|---|
| Frontend | React 19 (function components + hooks), built with Vite |
| Backend | Node.js, Express 5 |
| Database | MongoDB (Atlas) with Mongoose |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing |
| AI | Gemini API (text + vision + embeddings) |
| Tests | Node's built-in test runner, Supertest, mongodb-memory-server |
| Hosting | Render |

## How it works

```
Browser (public/)  --fetch-->  Express API (src/)  -->  MongoDB
                                     |
                                     +--> Gemini API (only for AI features)
```

### Login
- Passwords are hashed with bcrypt; only the hash is stored.
- After login the server puts a signed JWT in an **httpOnly cookie**. Page JavaScript can't read it, so even an XSS bug couldn't steal it.
- Every transaction query includes the logged-in user's id, so one user can't read, edit or delete another user's data even by guessing an id.

### "Ask about your money" (RAG)

RAG = retrieval-augmented generation: instead of letting the AI guess, we first **retrieve** the user's real data and give it to the AI to **generate** an answer from.

1. **Plan:** Gemini turns the question into filters: dates, income/expense, categories, and optional search text (e.g. "Goa trip").
2. **Retrieve:** the server queries MongoDB with those filters. If there is search text, transactions are ranked by **embedding similarity** (meaning, not exact words), and Gemini picks the ones that really match.
3. **Calculate:** the server adds up the totals. LLMs make arithmetic mistakes, so the AI never does the math.
4. **Answer:** Gemini writes a 1–3 sentence reply using only those facts.

Everything the AI returns is checked like user input (valid dates, known categories only), and embeddings are saved after the first search so they are never paid for twice.

### Category suggestions
Simple keyword rules run first ("swiggy" → Food & Dining). They're instant and free. Gemini is only asked when the rules don't know.

## Run it locally

You need Node.js 20 or newer.

```bash
git clone https://github.com/sk7245/expenses-tracker.git
cd expenses-tracker
npm install
npm run build   # builds the React app into client/dist
npm run dev     # starts the server
```

Open http://localhost:3000.

While changing the React code, also run `npm run dev:client` and open http://localhost:5173 instead: the page reloads on every save, and `/api` calls are passed through to the server on port 3000.

- Without a `MONGODB_URI`, a local MongoDB starts automatically and keeps data in `.data/`.
- Without a `GEMINI_API_KEY`, the app works fully; auto category uses keyword rules only, and scan/ask are hidden.

To use real services, copy `.env.example` to `.env` and fill it in.

## Tests

```bash
npm test
```

32 tests cover login, validation, users not seeing each other's data, monthly totals, loan repayments, and the AI pipeline (with a fake Gemini, so no API key or internet is needed).

## Deploy (Render + MongoDB Atlas)

1. Create a free MongoDB Atlas cluster and copy its connection string.
2. Get a free Gemini API key from Google AI Studio.
3. On Render: **New → Blueprint**, pick this repo. `render.yaml` sets up the service.
4. Enter `MONGODB_URI` and `GEMINI_API_KEY` when Render asks. `JWT_SECRET` is generated automatically.

The free Render plan sleeps when unused, so the first visit after a while takes about 30–50 seconds.

## Project structure

```
client/            React frontend (Vite)
  index.html       the one page React draws into
  src/
    main.jsx       starts React
    App.jsx        checks the login, shows LoginPage or Dashboard
    components/    LoginPage, Dashboard, SpendingTab, TransactionForm, TransactionList,
                   MonthSummary, Breakdown, AskBox, DebitsTab, DebtForm, DebtRow
    api.js         one helper for every call to the backend
    debtUtils.js   EMI date maths
src/               Express backend
  app.js           express setup, security headers, rate limits
  server.js        starts the server
  routes/          auth, transactions, debts, ai
  models/          User, Transaction, Debt (mongoose)
  middleware/      login check
  ai/              gemini client, rules, categorize, receipt scan, ask (RAG), embeddings
  lib/             validation, dates, categories
tests/             api, loans and ai tests
```

## Ideas for later

- Monthly budgets with alerts
- Export to CSV / Excel
- Recurring expenses (rent, subscriptions)
