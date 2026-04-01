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

        var email    = emailInput.value.trim();
        var password = passwordInput.value;

        /* Basic empty checks */
        if (email.length === 0) {
            showError(emailError, "Email is required.");
            return;
        }
        if (password.length === 0) {
            showError(passwordError, "Password is required.");
            return;
        }

        /* Look up user in mockData + sessionStorage */
        var user = findUser(email, password);

        if (!user) {
            showError(passwordError, "Invalid email or password.");
            return;
        }

        /* Save current user to sessionStorage for persistence */
        sessionStorage.setItem("currentUser", JSON.stringify(user));

        /* Redirect to landing page */
        window.location.href = "../landing/landing.html";
    });

})();
