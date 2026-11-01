const config = require("./config");
const { connectDatabase, disconnectDatabase } = require("./db");
const { createApp } = require("./app");

async function start() {
    await connectDatabase(config.mongoUri);
    console.log("Connected to MongoDB");

    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`Expenses Tracker running at http://localhost:${config.port}`);
        if (!config.geminiApiKey) {
            console.log("GEMINI_API_KEY not set - category suggestions use keyword rules only, other AI features are off");
        }
    });

    // Render's load balancer keeps idle connections open longer than Node's default 5 seconds.
    // If Node closes first, the balancer can send a request into a dead connection -> random 502 errors.
    server.keepAliveTimeout = 120 * 1000;
    server.headersTimeout = 121 * 1000;
}

async function shutdown() {
    await disconnectDatabase();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
    console.error("Could not start the server:", error);
    process.exit(1);
});
