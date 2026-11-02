const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, stopTestApp, signUp, today, request } = require("./helpers");

let app;

before(async () => {
    app = await startTestApp();
});

after(stopTestApp);

function loan(overrides = {}) {
    return {
        direction: "borrowed",
        person: "KreditBee",
        source: "Loan app",
        amount: 5000,
        date: today(),
        dueDate: "2099-01-01",
        note: "for exam fees",
        ...overrides
    };
}

describe("debts", () => {
    test("need a login", async () => {
        const res = await request(app).get("/api/debts");
        assert.equal(res.status, 401);
    });

    test("borrow, pay back in parts, and it gets settled", async () => {
        const agent = await signUp(app);

        const created = await agent.post("/api/debts").send(loan());
        assert.equal(created.status, 201);
        const id = created.body.debt.id;
        assert.equal(created.body.debt.remaining, 5000);
        assert.equal(created.body.debt.settled, false);

        const first = await agent.post(`/api/debts/${id}/payments`).send({ amount: 2000, date: today() });
        assert.equal(first.status, 201);
        assert.equal(first.body.debt.paid, 2000);
        assert.equal(first.body.debt.remaining, 3000);

        const tooMuch = await agent.post(`/api/debts/${id}/payments`).send({ amount: 3500, date: today() });
        assert.equal(tooMuch.status, 400, "can't pay back more than what's left");

        const last = await agent.post(`/api/debts/${id}/payments`).send({ amount: 3000, date: today() });
        assert.equal(last.body.debt.remaining, 0);
        assert.equal(last.body.debt.settled, true);

        const extra = await agent.post(`/api/debts/${id}/payments`).send({ amount: 1, date: today() });
        assert.equal(extra.status, 400);

        // undo the last payment -> open again
        const paymentId = last.body.debt.payments[1].id;
        const undone = await agent.delete(`/api/debts/${id}/payments/${paymentId}`);
        assert.equal(undone.status, 200);
        assert.equal(undone.body.debt.remaining, 3000);
        assert.equal(undone.body.debt.settled, false);
    });

    test("totals split what I owe and what others owe me", async () => {
        const agent = await signUp(app);

        await agent.post("/api/debts").send(loan({ amount: 5000 }));
        await agent.post("/api/debts").send(loan({ person: "Rahul", source: "Friend or family", amount: 800, dueDate: "" }));
        const lent = await agent.post("/api/debts").send(loan({ direction: "lent", person: "Kiran", source: "Friend or family", amount: 1500 }));
        await agent.post(`/api/debts/${lent.body.debt.id}/payments`).send({ amount: 500, date: today() });

        const res = await agent.get("/api/debts");
        assert.equal(res.status, 200);
        assert.equal(res.body.debts.length, 3);
        assert.deepEqual(res.body.totals, { iOwe: 5800, owedToMe: 1000, emiPerMonth: 0 });
        assert.equal(res.body.debts[0].user, undefined);
    });

    test("monthly EMIs add up, and the last EMI only counts what's left", async () => {
        const agent = await signUp(app);

        const bike = await agent.post("/api/debts").send(loan({ person: "Bajaj Finance", source: "Bank loan", amount: 36000, emi: 3000, emiDay: 5 }));
        assert.equal(bike.status, 201);
        assert.equal(bike.body.debt.emi, 3000);
        assert.equal(bike.body.debt.emiDay, 5);

        // no EMI day given -> the day the loan was taken
        const phone = await agent.post("/api/debts").send(loan({ amount: 2000, emi: 1500, date: "2026-10-18" }));
        assert.equal(phone.body.debt.emiDay, 18);
        await agent.post(`/api/debts/${phone.body.debt.id}/payments`).send({ amount: 1500, date: today() });

        const res = await agent.get("/api/debts");
        assert.equal(res.body.totals.emiPerMonth, 3500, "3000 + the last 500 of the phone loan");

        const tooBig = await agent.post("/api/debts").send(loan({ amount: 1000, emi: 2000 }));
        assert.equal(tooBig.status, 400);
        const badDay = await agent.post("/api/debts").send(loan({ emi: 500, emiDay: 40 }));
        assert.equal(badDay.status, 400);
    });

    test("bad data is rejected", async () => {
        const agent = await signUp(app);

        const noName = await agent.post("/api/debts").send(loan({ person: "  " }));
        assert.equal(noName.status, 400);

        const badDirection = await agent.post("/api/debts").send(loan({ direction: "stolen" }));
        assert.equal(badDirection.status, 400);

        const dueBeforeLoan = await agent.post("/api/debts").send(loan({ date: "2026-05-10", dueDate: "2026-05-01" }));
        assert.equal(dueBeforeLoan.status, 400);

        const created = await agent.post("/api/debts").send(loan({ date: "2026-05-10" }));
        const earlyPayment = await agent.post(`/api/debts/${created.body.debt.id}/payments`).send({ amount: 100, date: "2026-05-01" });
        assert.equal(earlyPayment.status, 400, "can't repay before borrowing");
    });

    test("edit can't drop the amount below what's already paid", async () => {
        const agent = await signUp(app);
        const created = await agent.post("/api/debts").send(loan());
        const id = created.body.debt.id;
        await agent.post(`/api/debts/${id}/payments`).send({ amount: 3000, date: today() });

        const tooLow = await agent.put(`/api/debts/${id}`).send(loan({ amount: 2000 }));
        assert.equal(tooLow.status, 400);

        const ok = await agent.put(`/api/debts/${id}`).send(loan({ amount: 5500, person: "KreditBee app" }));
        assert.equal(ok.status, 200);
        assert.equal(ok.body.debt.person, "KreditBee app");
        assert.equal(ok.body.debt.remaining, 2500);
    });

    test("users can't see or change each other's loans", async () => {
        const owner = await signUp(app);
        const other = await signUp(app);
        const created = await owner.post("/api/debts").send(loan());
        const id = created.body.debt.id;

        const list = await other.get("/api/debts");
        assert.equal(list.body.debts.length, 0);

        assert.equal((await other.post(`/api/debts/${id}/payments`).send({ amount: 10, date: today() })).status, 404);
        assert.equal((await other.put(`/api/debts/${id}`).send(loan())).status, 404);
        assert.equal((await other.delete(`/api/debts/${id}`)).status, 404);

        assert.equal((await owner.delete(`/api/debts/${id}`)).status, 200);
    });
});
