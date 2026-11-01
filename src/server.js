const config = require("./config");
const { connectDatabase, disconnectDatabase } = require("./db");
const { createApp } = require("./app");

async function start() {
    await connectDatabase(config.mongoUri);
    console.log("Connected to MongoDB");

    const app = createApp();
    app.listen(config.port, () => {
        console.log(`Expenses Tracker running at http://localhost:${config.port}`);
        if (!config.geminiApiKey) {
            console.log("GEMINI_API_KEY not set - category suggestions use keyword rules only, other AI features are off");
        }
    });
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
