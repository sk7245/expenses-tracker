import { useEffect, useState } from "react";
import { api } from "./api.js";
import LoginPage from "./components/LoginPage.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
    // undefined = still asking the server, null = not logged in, object = the logged-in user
    const [user, setUser] = useState(undefined);

    useEffect(() => {
        api("/api/auth/me")
            .then((result) => setUser(result.user))
            .catch(() => setUser(null));
    }, []);

    // show nothing for the split second while we check, so the dashboard never flashes for logged-out visitors
    if (user === undefined) return null;

    if (user === null) return <LoginPage onLogin={setUser} />;

    return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
