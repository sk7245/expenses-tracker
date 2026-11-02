import { useEffect, useState } from "react";
import { api } from "../api.js";
import SpendingTab from "./SpendingTab.jsx";
import DebitsTab from "./DebitsTab.jsx";

// the tab is kept in the address (#debits), so a refresh stays on the same tab
function tabFromHash() {
    return window.location.hash === "#debits" ? "debits" : "spending";
}

export default function Dashboard({ user, onLogout }) {
    const [tab, setTab] = useState(tabFromHash);
    const [aiEnabled, setAiEnabled] = useState(false);

    useEffect(() => {
        const onHashChange = () => setTab(tabFromHash());
        window.addEventListener("hashchange", onHashChange);
        // cleanup: React calls this when the component goes away
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        api("/api/ai/status")
            .then((result) => setAiEnabled(result.enabled))
            .catch(() => setAiEnabled(false));
    }, []);

    // 401 means the login expired: back to the login page. Anything else: tell the user
    function handleError(error) {
        if (error.status === 401) onLogout();
        else alert(error.message);
    }

    async function logout() {
        try {
            await api("/api/auth/logout", { method: "POST" });
        } finally {
            onLogout();
        }
    }

    return (
        <div className="container">
            <header className="topbar">
                <div>
                    <h1>Expenses Tracker</h1>
                    <p className="tagline">Know where every rupee goes</p>
                </div>
                <div className="user-box">
                    <span>Hi, {user.name.split(" ")[0]}</span>
                    <button type="button" className="link-btn" onClick={logout}>
                        Log out
                    </button>
                </div>
            </header>

            {/* spending and debits are kept apart: paying an EMI isn't the same as spending */}
            <nav className="tabs">
                <a href="#spending" className={tab === "spending" ? "tab active" : "tab"}>
                    Spending
                </a>
                <a href="#debits" className={tab === "debits" ? "tab active" : "tab"}>
                    Debits & EMIs
                </a>
            </nav>

            {/* both tabs stay mounted (just hidden), so switching keeps what you typed */}
            <div hidden={tab !== "spending"}>
                <SpendingTab aiEnabled={aiEnabled} onError={handleError} />
            </div>
            <div hidden={tab !== "debits"}>
                <DebitsTab onError={handleError} />
            </div>
        </div>
    );
}
