const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, stopTestApp, signUp, sample, today, request } = require("./helpers");

let app;

before(async () => {
    app = await startTestApp();
});

after(stopTestApp);

describe("auth", () => {
    test("sign up, check who I am, log out", async () => {
        const agent = request.agent(app);
        const signup = await agent
            .post("/api/auth/register")
            .send({ name: "Krishna", email: "Krishna@Test.com", password: "password123" });

        assert.equal(signup.status, 201);
        assert.equal(signup.body.user.email, "krishna@test.com");
        assert.equal(signup.body.user.passwordHash, undefined, "hash must never be sent");

        const cookie = signup.headers["set-cookie"][0];
        assert.match(cookie, /HttpOnly/i);

        const me = await agent.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.body.user.name, "Krishna");

        await agent.post("/api/auth/logout");
        const afterLogout = await agent.get("/api/auth/me");
        assert.equal(afterLogout.status, 401);
    });

    test("log in with the right password, reject the wrong one", async () => {
        await request(app).post("/api/auth/register").send({ name: "Ravi", email: "ravi@test.com", password: "secret-pass" });

        const ok = await request(app).post("/api/auth/login").send({ email: "ravi@test.com", password: "secret-pass" });
        assert.equal(ok.status, 200);

        const wrong = await request(app).post("/api/auth/login").send({ email: "ravi@test.com", password: "nope-nope" });
        assert.equal(wrong.status, 401);

        const noUser = await request(app).post("/api/auth/login").send({ email: "ghost@test.com", password: "whatever1" });
        assert.equal(noUser.status, 401);
        assert.equal(noUser.body.error, wrong.body.error, "same message so emails can't be guessed");
    });

    test("sign up checks", async () => {
        const short = await request(app).post("/api/auth/register").send({ name: "A", email: "a@test.com", password: "123" });
        assert.equal(short.status, 400);

        const badEmail = await request(app).post("/api/auth/register").send({ name: "A", email: "not-an-email", password: "password123" });
        assert.equal(badEmail.status, 400);

        await request(app).post("/api/auth/register").send({ name: "A", email: "dup@test.com", password: "password123" });
        const dup = await request(app).post("/api/auth/register").send({ name: "B", email: "dup@test.com", password: "password123" });
        assert.equal(dup.status, 409);
    });

    test("transactions need a login", async () => {
        const res = await request(app).get("/api/transactions");
        assert.equal(res.status, 401);
    });
});

describe("transactions", () => {
    test("add, list, edit and delete", async () => {
        const agent = await signUp(app);

        const created = await agent.post("/api/transactions").send(sample());
        assert.equal(created.status, 201);
        const id = created.body.transaction.id;
        assert.ok(id);

        const month = today().slice(0, 7);
        const list = await agent.get(`/api/transactions?month=${month}`);
        assert.equal(list.body.transactions.length, 1);
        assert.equal(list.body.transactions[0].user, undefined);

        const edited = await agent.put(`/api/transactions/${id}`).send(sample({ description: "Zomato dinner", amount: 450 }));
        assert.equal(edited.status, 200);
        assert.equal(edited.body.transaction.amount, 450);

        const removed = await agent.delete(`/api/transactions/${id}`);
        assert.equal(removed.status, 200);

        const empty = await agent.get(`/api/transactions?month=${month}`);
        assert.equal(empty.body.transactions.length, 0);
    });

    test("bad data is rejected", async () => {
        const agent = await signUp(app);

        const cases = [
            sample({ description: "  " }),
            sample({ amount: -5 }),
            sample({ amount: "abc" }),
            sample({ type: "transfer" }),
            sample({ category: "Salary" }), // income category on an expense
            sample({ paymentMode: "Bitcoin" }),
            sample({ date: "2026-02-30" }),
            sample({ date: "2099-01-01" })
        ];

        for (const body of cases) {
            const res = await agent.post("/api/transactions").send(body);
            assert.equal(res.status, 400, `should reject ${JSON.stringify(body)}`);
        }
    });

    test("users can't see or change each other's data", async () => {
        const alice = await signUp(app, "Alice");
        const bob = await signUp(app, "Bob");

        const created = await alice.post("/api/transactions").send(sample({ description: "Alice rent", category: "Rent", amount: 9000 }));
        const id = created.body.transaction.id;

        const bobList = await bob.get("/api/transactions");
        assert.equal(bobList.body.transactions.length, 0);

        assert.equal((await bob.put(`/api/transactions/${id}`).send(sample())).status, 404);
        assert.equal((await bob.delete(`/api/transactions/${id}`)).status, 404);

        const aliceList = await alice.get("/api/transactions");
        assert.equal(aliceList.body.transactions[0].description, "Alice rent");
    });

    test("monthly summary adds up correctly", async () => {
        const agent = await signUp(app);
        const month = today().slice(0, 7);

        await agent.post("/api/transactions").send(sample({ description: "Salary", type: "income", category: "Salary", amount: 35000 }));
        await agent.post("/api/transactions").send(sample({ description: "Rent", category: "Rent", amount: 9000 }));
        await agent.post("/api/transactions").send(sample({ description: "Swiggy", amount: 320.5 }));
        await agent.post("/api/transactions").send(sample({ description: "Zomato", amount: 179.5 }));
        // last year, must not count
        await agent.post("/api/transactions").send(sample({ description: "Old", amount: 999, date: "2025-01-15" }));

        const res = await agent.get(`/api/transactions/summary?month=${month}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.income, 35000);
        assert.equal(res.body.expense, 9500);
        assert.equal(res.body.balance, 25500);
        assert.deepEqual(res.body.spendingByCategory, [
            { category: "Rent", total: 9000 },
            { category: "Food & Dining", total: 500 }
        ]);
    });

    test("filter by category", async () => {
        const agent = await signUp(app);
        await agent.post("/api/transactions").send(sample());
        await agent.post("/api/transactions").send(sample({ description: "Uber", category: "Transport" }));

        const res = await agent.get("/api/transactions?category=Transport");
        assert.equal(res.body.transactions.length, 1);
        assert.equal(res.body.transactions[0].description, "Uber");
    });

    test("import from the old browser version skips bad rows", async () => {
        const agent = await signUp(app);
        const res = await agent.post("/api/transactions/import").send({
            transactions: [sample(), sample({ description: "Bus", category: "Transport" }), { description: "broken" }]
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.imported, 2);
        assert.equal(res.body.skipped, 1);
    });
});
