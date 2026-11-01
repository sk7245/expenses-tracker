const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { requireAuth, setAuthCookie, clearAuthCookie } = require("../middleware/auth");
const { validateRegister } = require("../lib/validate");

const router = express.Router();

router.post("/register", async (req, res) => {
    const { value, error } = validateRegister(req.body);
    if (error) return res.status(400).json({ error });
    const { name, email, password } = value;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account with this email already exists" });

    // 10 salt rounds: slow enough to make guessing hard, fast enough for a login
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    setAuthCookie(res, user._id);
    res.status(201).json({ user });
});

router.post("/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const user = await User.findOne({ email });
    const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

    // same message for wrong email and wrong password, so nobody can check which emails have accounts
    if (!passwordOk) return res.status(401).json({ error: "Wrong email or password" });

    setAuthCookie(res, user._id);
    res.json({ user });
});

router.post("/logout", (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
        clearAuthCookie(res);
        return res.status(401).json({ error: "Please log in" });
    }
    res.json({ user });
});

module.exports = router;
