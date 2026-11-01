const fs = require("fs");
const path = require("path");

// load .env (Node 20.12+ can read it without the dotenv package)
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
}

const isProduction = process.env.NODE_ENV === "production";

const config = {
    isProduction,
    port: Number(process.env.PORT) || 3000,
    mongoUri: process.env.MONGODB_URI || "",
    jwtSecret: process.env.JWT_SECRET || (isProduction ? "" : "local-dev-secret-not-for-production"),
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"
};

if (isProduction && !config.jwtSecret) {
    throw new Error("JWT_SECRET must be set in production");
}
if (isProduction && !config.mongoUri) {
    throw new Error("MONGODB_URI must be set in production");
}

module.exports = config;
