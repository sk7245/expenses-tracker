import { useState } from "react";
import { api } from "../api.js";

export default function LoginPage({ onLogin }) {
    const [signUp, setSignUp] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    function switchMode(toSignUp) {
        setSignUp(toSignUp);
        setError("");
    }

    async function submit(event) {
        event.preventDefault();
        setError("");

        if (signUp && name.trim() === "") return setError("Please enter your name.");

        setBusy(true);
        try {
            const { user } = await api(signUp ? "/api/auth/register" : "/api/auth/login", {
                method: "POST",
                body: { name, email, password }
            });
            onLogin(user);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    let buttonText = signUp ? "Create account" : "Log in";
    if (busy) buttonText = signUp ? "Creating account..." : "Logging in...";

    return (
        <div className="container auth-card">
            <header>
                <h1>Expenses Tracker</h1>
                <p className="tagline">Know where every rupee goes</p>
            </header>

            {/* log in / sign up switch */}
            <div className="type-toggle">
                <input type="radio" name="mode" id="mode-login" checked={!signUp} onChange={() => switchMode(false)} />
                <label htmlFor="mode-login">Log in</label>
                <input type="radio" name="mode" id="mode-register" checked={signUp} onChange={() => switchMode(true)} />
                <label htmlFor="mode-register">Sign up</label>
            </div>

            <form onSubmit={submit}>
                {signUp && (
                    <div>
                        <label htmlFor="name">Your name</label>
                        <input type="text" id="name" autoComplete="name" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                )}

                <label htmlFor="email">Email</label>
                <input type="email" id="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

                <label htmlFor="password">Password</label>
                <input
                    type="password"
                    id="password"
                    autoComplete={signUp ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                {signUp && <p className="hint">At least 8 characters.</p>}

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="add-btn" disabled={busy}>
                    {buttonText}
                </button>
            </form>
        </div>
    );
}
