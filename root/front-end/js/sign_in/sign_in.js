(function () {
  "use strict";

  /* ───────── DOM references ───────── */
  var form = document.getElementById("signInForm");
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var emailError = document.getElementById("emailError");
  var passwordError = document.getElementById("passwordError");
  var signInBtn = document.getElementById("signInBtn");

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
    var pw = document.getElementById("password");
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

  /* ───────── Role → redirect map ───────── */
  function redirectByRole(role) {
    var routes = {
      "System Administrator": "../system_admin/system_admin_overview.html",
      "Financial Analyst": "../finance-analyst/finance_overview.html",
      "Technician Administrator": "../technician/technician_overview.html",
      Technician: "../technician_jr/technician_jr_work_orders.html",
      "Sustainability Officer":
        "../sustainability_officer/sustainability_officer_overview.html",
      "Campus Visitor": "../enduser/enduser_dashboard.html",
    };
    var path = routes[role] || "../landing/landing.html";
    window.location.href = path;
  }

  /* ───────── Form submission ───────── */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError(emailError);
    clearError(passwordError);

    var email = emailInput.value.trim().toLowerCase();
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

    /* Disable button while request is in flight */
    signInBtn.disabled = true;
    signInBtn.textContent = "Signing in…";

    try {
      /* Call the real backend login endpoint */
      var user = await api.post("/users/login", {
        email: email,
        password: password,
      });

      /* Persist session in localStorage for all pages to read */
      localStorage.setItem("currentUser", JSON.stringify(user));

      /* Redirect to the correct dashboard by role */
      redirectByRole(user.role);
    } catch (err) {
      showError(passwordError, err.message || "Invalid email or password.");
      signInBtn.disabled = false;
      signInBtn.textContent = "Sign In";
    }
  });
})();
