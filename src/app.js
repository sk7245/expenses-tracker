const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const HttpError = require("./lib/httpError");

const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const aiRoutes = require("./routes/ai");

function createApp() {
    const app = express();

    // Render (and most hosts) sit behind a proxy; needed for correct IPs and secure cookies
    app.set("trust proxy", 1);

    // security headers. blob: is allowed for images so the receipt preview works
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: { "img-src": ["'self'", "data:", "blob:"] }
            }
        })
    );

    app.use(cookieParser());

    // receipt photos are big, everything else is small
    app.use("/api/ai/scan-receipt", express.json({ limit: "6mb" }));
    app.use(express.json({ limit: "100kb" }));

    const skipInTests = () => process.env.NODE_ENV === "test";

    // slow down password guessing
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        skip: skipInTests,
        message: { error: "Too many attempts, please try again in a few minutes" }
    });

    // AI calls cost money / free-tier quota
    const aiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 40,
        skip: skipInTests,
        message: { error: "Too many AI requests, please wait a few minutes" }
    });

    app.use("/api/auth/login", authLimiter);
    app.use("/api/auth/register", authLimiter);
    app.use("/api/ai", aiLimiter);

    app.use("/api/auth", authRoutes);
    app.use("/api/transactions", transactionRoutes);
    app.use("/api/ai", aiRoutes);

    app.get("/api/health", (req, res) => res.json({ ok: true }));

    app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

    // the frontend (html, css, js)
    app.use(express.static(path.join(__dirname, "..", "public")));

    app.use(errorHandler);

    return app;
}

// express 5 sends errors from async routes here automatically
function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ error: "That file is too big" });
    }
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON" });
    }
    if (err.name === "ValidationError") {
        return res.status(400).json({ error: err.message });
    }
    if (err.code === 11000) {
        return res.status(409).json({ error: "That already exists" });
    }

    console.error(err);
    res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}

module.exports = { createApp };
