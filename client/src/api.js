// one place for all calls to our backend

export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function api(path, { method = "GET", body } = {}) {
    let response;
    try {
        response = await fetch(path, {
            method,
            headers: body ? { "Content-Type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined,
            credentials: "same-origin"
        });
    } catch {
        throw new ApiError(0, "Can't reach the server. Check your internet connection.");
    }

    let data = {};
    try {
        data = await response.json();
    } catch {
        // some errors (like a crashed proxy) don't send JSON
    }

    if (!response.ok) {
        throw new ApiError(response.status, data.error || "Something went wrong. Please try again.");
    }
    return data;
}
