// AI tests use a fake Gemini, so they run without an API key or internet
process.env.GEMINI_API_KEY = "test-key";

const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, stopTestApp, signUp, sample, today } = require("./helpers");
const { categoryFromRules } = require("../src/ai/rules");
const { cleanPlan, summarize } = require("../src/ai/ask");
const { parseImage, cleanReceipt } = require("../src/ai/receipt");
const { monthRange, currentMonth } = require("../src/lib/dates");

// ---- fake Gemini ----

const realFetch = global.fetch;
let geminiCalls = [];
let fakeReplies = {};

function geminiReply(object) {
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(object) }] } }] };
}

// meaning vectors: anything about Goa points one way, everything else another way
function fakeEmbedding(text) {
    return /goa|beach|resort/i.test(text) ? [1, 0, 0] : [0, 1, 0];
}

function installFakeGemini() {
    global.fetch = async (url, options) => {
        if (!String(url).includes("generativelanguage.googleapis.com")) return realFetch(url, options);

        const body = JSON.parse(options.body);
        geminiCalls.push({ url: String(url), body });

        if (String(url).includes(":batchEmbedContents")) {
            const embeddings = body.requests.map((r) => ({ values: fakeEmbedding(r.content.parts[0].text) }));
            return new Response(JSON.stringify({ embeddings }), { status: 200 });
        }

        const prompt = body.contents[0].parts[0].text;
        let reply;
        if (prompt.includes("into search filters")) reply = fakeReplies.plan;
        else if (prompt.includes("Which of these transactions")) reply = fakeReplies.pick(prompt);
        else if (prompt.includes("Answer the user's question")) reply = { answer: "You spent " + fakeReplies.lastFacts(prompt) };
        else if (prompt.includes("sort personal")) reply = { category: "Shopping" };
        else if (prompt.includes("bill, receipt")) reply = fakeReplies.receipt;

        return new Response(JSON.stringify(geminiReply(reply)), { status: 200 });
    };
}

// ---- pure functions ----

describe("keyword rules", () => {
    test("common Indian expenses", () => {
        assert.equal(categoryFromRules("Swiggy biryani", "expense"), "Food & Dining");
        assert.equal(categoryFromRules("Jio recharge 299", "expense"), "Bills & Recharge");
        assert.equal(categoryFromRules("Electricity bill", "expense"), "Bills & Recharge");
        assert.equal(categoryFromRules("Uber to office", "expense"), "Transport");
        assert.equal(categoryFromRules("Petrol", "expense"), "Fuel");
        assert.equal(categoryFromRules("Salary credited", "income"), "Salary");
    });

    test("word boundaries: business is not a bus", () => {
        assert.equal(categoryFromRules("business lunch", "expense"), "Food & Dining");
        assert.equal(categoryFromRules("Business meeting", "expense"), null);
    });

    test("unknown text gives null", () => {
        assert.equal(categoryFromRules("random thing", "expense"), null);
    });
});

describe("checking what the AI returns", () => {
    test("bad plan values fall back to safe defaults", () => {
        const plan = cleanPlan({
            startDate: "yesterday",
            endDate: "2026-13-45",
            type: "everything",
            categories: ["Food & Dining", "Pizza Fund"],
            paymentModes: ["UPI", "Gold coins"],
            searchText: 42
        });
        const thisMonth = monthRange(currentMonth());
        assert.equal(plan.startDate, thisMonth.from);
        assert.equal(plan.endDate, thisMonth.to);
        assert.equal(plan.type, "all");
        assert.deepEqual(plan.categories, ["Food & Dining"]);
        assert.deepEqual(plan.paymentModes, ["UPI"]);
        assert.equal(plan.searchText, "");
    });

    test("swapped dates are fixed", () => {
        const plan = cleanPlan({ startDate: "2026-10-31", endDate: "2026-10-01", type: "expense", categories: [], paymentModes: [], searchText: "" });
        assert.equal(plan.startDate, "2026-10-01");
        assert.equal(plan.endDate, "2026-10-31");
    });

    test("totals are calculated by code, not the AI", () => {
        const facts = summarize([
            { type: "expense", amount: 100.1, category: "Food & Dining", description: "a", date: "2026-11-01" },
            { type: "expense", amount: 200.2, category: "Food & Dining", description: "b", date: "2026-11-02" },
            { type: "income", amount: 1000, category: "Salary", description: "c", date: "2026-11-01" }
        ]);
        assert.equal(facts.totalSpent, 300.3);
        assert.equal(facts.totalIncome, 1000);
        assert.equal(facts.net, 699.7);
        assert.equal(facts.largestExpense.description, "b");
    });

    test("receipt images are checked", () => {
        assert.throws(() => parseImage("hello"));
        assert.throws(() => parseImage("data:image/gif;base64,AAAA"));
        assert.deepEqual(parseImage("data:image/png;base64,AAAA"), { mimeType: "image/png", base64: "AAAA" });
    });

    test("receipt fields from the AI are cleaned", () => {
        const r = cleanReceipt({ description: "DMart", amount: -5, date: "2099-01-01", category: "Pizza", paymentMode: "Gold" });
        assert.equal(r.amount, null);
        assert.equal(r.date, "");
        assert.equal(r.category, "Groceries"); // fallback to keyword rules
        assert.equal(r.paymentMode, "");
    });
});

// ---- through the API with the fake Gemini ----

describe("AI endpoints", () => {
    let app;
    let agent;

    before(async () => {
        installFakeGemini();
        app = await startTestApp();
        agent = await signUp(app);

        const t = today();
        await agent.post("/api/transactions").send(sample({ description: "Swiggy order", amount: 320, date: t }));
        await agent.post("/api/transactions").send(sample({ description: "Zomato dinner", amount: 480, date: t }));
        await agent.post("/api/transactions").send(sample({ description: "Goa beach resort", category: "Entertainment", amount: 6500, date: t }));
        await agent.post("/api/transactions").send(sample({ description: "Goa flight", category: "Transport", amount: 4200, date: t }));
        await agent.post("/api/transactions").send(sample({ description: "Room rent", category: "Rent", amount: 9000, date: t }));
    });

    after(async () => {
        global.fetch = realFetch;
        await stopTestApp();
    });

    beforeEach(() => {
        geminiCalls = [];
    });

    test("status says AI is on", async () => {
        const res = await agent.get("/api/ai/status");
        assert.deepEqual(res.body, { enabled: true });
    });

    test("categorize uses rules first and only calls Gemini when needed", async () => {
        const easy = await agent.post("/api/ai/categorize").send({ description: "Swiggy biryani", type: "expense" });
        assert.deepEqual(easy.body, { category: "Food & Dining", source: "rules" });
        assert.equal(geminiCalls.length, 0);

        const hard = await agent.post("/api/ai/categorize").send({ description: "Decathlon cycle", type: "expense" });
        assert.deepEqual(hard.body, { category: "Shopping", source: "ai" });
        assert.equal(geminiCalls.length, 1);

        // EMIs aren't spending: no category, and the page points to the Debits tab
        const emi = await agent.post("/api/ai/categorize").send({ description: "Bike loan EMI", type: "expense" });
        assert.deepEqual(emi.body, { category: null, source: "rules", debit: true });
        assert.equal(geminiCalls.length, 1);
    });

    test("ask: category question uses filters and code-calculated totals", async () => {
        const month = monthRange(currentMonth());
        fakeReplies.plan = {
            isAboutFinances: true, startDate: month.from, endDate: month.to,
            type: "expense", categories: ["Food & Dining"], paymentModes: [], searchText: ""
        };
        fakeReplies.lastFacts = (prompt) => JSON.parse(prompt.match(/Facts calculated by the app: (.*)/)[1]).totalSpent;

        const res = await agent.post("/api/ai/ask").send({ question: "How much did I spend on food this month?" });
        assert.equal(res.status, 200);
        assert.equal(res.body.facts.totalSpent, 800);
        assert.equal(res.body.facts.count, 2);
        assert.equal(res.body.answer, "You spent 800");
        assert.equal(geminiCalls.length, 2, "plan + answer, no embeddings needed");
    });

    test("ask: search text uses embeddings (RAG) and the AI picks the matches", async () => {
        const month = monthRange(currentMonth());
        fakeReplies.plan = {
            isAboutFinances: true, startDate: month.from, endDate: month.to,
            type: "expense", categories: [], paymentModes: [], searchText: "Goa trip"
        };
        // pick every line that mentions Goa
        fakeReplies.pick = (prompt) => ({
            labels: prompt.split("\n").filter((l) => /^t\d+ .*Goa/.test(l)).map((l) => l.split(" ")[0])
        });

        const res = await agent.post("/api/ai/ask").send({ question: "How much did my Goa trip cost?" });
        assert.equal(res.status, 200);
        assert.equal(res.body.facts.totalSpent, 10700);
        assert.equal(res.body.transactions.length, 2);
        assert.ok(geminiCalls.some((c) => c.url.includes(":batchEmbedContents")));

        // embeddings are saved, so the second question only embeds the query
        geminiCalls = [];
        await agent.post("/api/ai/ask").send({ question: "How much did my Goa trip cost?" });
        const embedCalls = geminiCalls.filter((c) => c.url.includes(":batchEmbedContents"));
        assert.equal(embedCalls.length, 1);
        assert.equal(embedCalls[0].body.requests.length, 1);
    });

    test("ask: off-topic questions are politely refused", async () => {
        fakeReplies.plan = {
            isAboutFinances: false, startDate: "", endDate: "", type: "all", categories: [], paymentModes: [], searchText: ""
        };
        const res = await agent.post("/api/ai/ask").send({ question: "Write me a poem about cats" });
        assert.equal(res.status, 200);
        assert.match(res.body.answer, /only answer questions/);
        assert.equal(res.body.transactions.length, 0);
    });

    test("scan receipt", async () => {
        fakeReplies.receipt = {
            isReceipt: true, description: "DMart groceries", amount: 1245.5, date: today(), category: "Groceries", paymentMode: "UPI"
        };
        const res = await agent.post("/api/ai/scan-receipt").send({ image: "data:image/jpeg;base64,/9j/AAAA" });
        assert.equal(res.status, 200);
        assert.equal(res.body.receipt.amount, 1245.5);
        assert.equal(res.body.receipt.category, "Groceries");

        fakeReplies.receipt = { isReceipt: false, description: "", amount: 0, date: "", category: "Other Expense", paymentMode: "" };
        const notBill = await agent.post("/api/ai/scan-receipt").send({ image: "data:image/jpeg;base64,/9j/AAAA" });
        assert.equal(notBill.status, 422);
    });

    test("AI routes need a login", async () => {
        const { request } = require("./helpers");
        const res = await request(app).post("/api/ai/ask").send({ question: "hello there" });
        assert.equal(res.status, 401);
    });
});
