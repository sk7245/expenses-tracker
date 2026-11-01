const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { isAiEnabled } = require("../ai/gemini");
const { suggestCategory } = require("../ai/categorize");
const { askQuestion } = require("../ai/ask");
const { scanReceipt } = require("../ai/receipt");

const router = express.Router();

router.use(requireAuth);

// lets the page know whether to show the AI features
router.get("/status", (req, res) => {
    res.json({ enabled: isAiEnabled() });
});

// POST /api/ai/categorize { description: "Swiggy biryani", type: "expense" }
router.post("/categorize", async (req, res) => {
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const type = req.body.type === "income" ? "income" : "expense";

    if (description.length < 2 || description.length > 60) {
        return res.status(400).json({ error: "Description must be 2 to 60 characters" });
    }

    res.json(await suggestCategory(description, type));
});

// POST /api/ai/ask { question: "How much did I spend on food last month?" }
router.post("/ask", async (req, res) => {
    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";

    if (question.length < 3) return res.status(400).json({ error: "Please type a question" });
    if (question.length > 300) return res.status(400).json({ error: "Question is too long (max 300 characters)" });

    res.json(await askQuestion(req.userId, question));
});

// POST /api/ai/scan-receipt { image: "data:image/jpeg;base64,..." }
router.post("/scan-receipt", async (req, res) => {
    res.json({ receipt: await scanReceipt(req.body.image) });
});

module.exports = router;
