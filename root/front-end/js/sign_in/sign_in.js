import { userActions } from "../shared/mockData.js";

(function () {
    "use strict";

    /* ───────── DOM references ───────── */
    var form         = document.getElementById("signInForm");
    var emailInput   = document.getElementById("email");
    var passwordInput = document.getElementById("password");
    var emailError   = document.getElementById("emailError");
    var passwordError = document.getElementById("passwordError");

    /* ───────── Error helpers ───────── */
    function showError(el, msg) {
        el.textContent = msg;
        el.style.display = "block";
    }
    function clearError(el) {
        el.textContent = "";
        el.style.display = "none";
    }
    function isGmailAddress(email) {
        return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());
    }

    /* ───────── Password toggle ───────── */
    window.togglePass = function () {
        var pw   = document.getElementById("password");
        var open = document.getElementById("eyeOpen");
        var shut = document.getElementById("eyeClosed");
        if (pw.type === "password") {
            pw.type = "text";
            open.style.display = "block";
            shut.style.display = "none";
        } else {
            pw.type = "password";
            open.style.display = "none";
            shut.style.display = "block";
        }
    };

    /* ───────── Form submission ───────── */
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        clearError(emailError);
        clearError(passwordError);

        var email    = emailInput.value.trim().toLowerCase();
        var password = passwordInput.value;

        /* Basic empty checks */
        if (email.length === 0) {
            showError(emailError, "Email is required.");
            return;
        }
        if (!isGmailAddress(email)) {
            showError(emailError, "Only gmail.com email addresses are allowed.");
            return;
        }
        if (password.length === 0) {
            showError(passwordError, "Password is required.");
            return;
        }

        /* Look up user in the universal user store. */
        var user = userActions.authenticate(email, password);

        if (!user) {
            showError(passwordError, "Invalid email or password.");
            return;
        }

        /* Save current user to localStorage for persistence */
        localStorage.setItem("currentUser", JSON.stringify(user));

        /* Smart redirect based on role */
        if (user.role === "System Administrator" || user.role === "System Admin") {
            window.location.href = "../system_admin/system_admin_overview.html";
        } else if (user.role === "Campus Visitor") {
            window.location.href = "../enduser/enduser_dashboard.html";
        } else if (user.role === "Technician") {
            window.location.href = "../technician_jr/technician_jr_work_orders.html";
        } else if (user.role === "Technician Administrator") {
            window.location.href = "../technician/technician_overview.html";
        } else {
            window.location.href = "../landing/landing.html";
        }
    });

})();
