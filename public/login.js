import { api } from "./api.js";

const form = document.getElementById("auth-form");
const nameField = document.getElementById("name-field");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordHelp = document.getElementById("password-help");
const errorText = document.getElementById("auth-error");
const button = document.getElementById("auth-btn");
const modeRadios = document.querySelectorAll('input[name="mode"]');

function isSignUp() {
    return document.getElementById("mode-register").checked;
}

function showError(message) {
    errorText.textContent = message;
    errorText.hidden = message === "";
}

function updateMode() {
    const signUp = isSignUp();
    nameField.hidden = !signUp;
    passwordHelp.hidden = !signUp;
    button.textContent = signUp ? "Create account" : "Log in";
    passwordInput.autocomplete = signUp ? "new-password" : "current-password";
    showError("");
}

async function submit(event) {
    event.preventDefault();
    showError("");

    const signUp = isSignUp();
    if (signUp && nameInput.value.trim() === "") {
        showError("Please enter your name.");
        return;
    }

    button.disabled = true;
    button.textContent = signUp ? "Creating account..." : "Logging in...";

    try {
        await api(signUp ? "/api/auth/register" : "/api/auth/login", {
            method: "POST",
            body: {
                name: nameInput.value,
                email: emailInput.value,
                password: passwordInput.value
            }
        });
        window.location.href = "/";
    } catch (error) {
        button.disabled = false;
        button.textContent = signUp ? "Create account" : "Log in";
        showError(error.message);
    }
}

// already logged in? go straight to the app
api("/api/auth/me")
    .then(() => (window.location.href = "/"))
    .catch(() => {});

modeRadios.forEach((radio) => radio.addEventListener("change", updateMode));
form.addEventListener("submit", submit);
