const jwt = require("jsonwebtoken");
const config = require("../config");

const COOKIE_NAME = "token";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, userId) {
    const token = jwt.sign({ userId: userId.toString() }, config.jwtSecret, { expiresIn: "7d" });

    // httpOnly: page JavaScript can't read the token, so an XSS bug can't steal it
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: SEVEN_DAYS
    });
}

function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: config.isProduction });
}

// put this in front of any route that needs a logged-in user
function requireAuth(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        return res.status(401).json({ error: "Please log in" });
    }

    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: "Session expired, please log in again" });
    }
}

module.exports = { requireAuth, setAuthCookie, clearAuthCookie };
