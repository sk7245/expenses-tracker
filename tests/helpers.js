// shared setup: a throwaway in-memory MongoDB + the express app
process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

async function startTestApp() {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("expenses-test"));
    const { createApp } = require("../src/app");
    return createApp();
}

async function stopTestApp() {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
}

// a logged-in "browser": supertest agents keep cookies between requests
async function signUp(app, name = "Krishna", email = `user${Date.now()}${Math.random()}@test.com`) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({ name, email, password: "password123" });
    if (res.status !== 201) throw new Error("sign up failed: " + JSON.stringify(res.body));
    return agent;
}

function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function sample(overrides = {}) {
    return {
        description: "Swiggy order",
        amount: 320,
        type: "expense",
        category: "Food & Dining",
        paymentMode: "UPI",
        date: today(),
        ...overrides
    };
}

module.exports = { startTestApp, stopTestApp, signUp, sample, today, request };
