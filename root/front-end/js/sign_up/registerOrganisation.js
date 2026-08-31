/**
 * registerOrganisation.js
 * The front door: an organisation signing itself up.
 *
 * This is where an EnerTrack engagement begins. It creates two records at
 * once — the organisation as a prospect, and the person filling the form in
 * as its Organization Admin — because either alone is a dead record. An
 * organisation with nobody in it cannot request an audit, and a user with no
 * organisation belongs to no tenant and would see nothing at all.
 *
 * Note the difference from sign_up.js next door. That page is for JOINING an
 * organisation that already exists, and it deliberately refuses to grant the
 * Organization Admin role — you should not be able to appoint yourself owner
 * of somebody else's account. Here you are creating the organisation, so
 * owning it is correct. Same rule, opposite side of it.
 *
 * On success the caller is signed straight in, because making someone retype
 * the password they just chose is pointless friction.
 */
(function () {
  "use strict";

  var form = document.getElementById("registerOrgForm");
  if (!form) return;

  var btn = document.getElementById("registerOrgBtn");

  var FIELDS = [
    { id: "orgName", error: "orgNameError", label: "an organisation name", min: 3 },
    { id: "orgType", error: "orgTypeError", label: "a type" },
    { id: "orgLocation", error: "orgLocationError", label: "a location", min: 2 },
    { id: "adminName", error: "adminNameError", label: "your name", min: 2 },
    { id: "adminEmail", error: "adminEmailError", label: "your work email", email: true },
    { id: "adminPassword", error: "adminPasswordError", label: "a password", min: 6 },
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function showError(field, message) {
    var span = el(field.error);
    if (span) {
      span.textContent = message;
      span.style.display = "block";
    }
    el(field.id)?.classList.add("invalid");
  }

  function clearError(field) {
    var span = el(field.error);
    if (span) {
      span.textContent = "";
      span.style.display = "none";
    }
    el(field.id)?.classList.remove("invalid");
  }

  /** Client-side validation is courtesy; the backend re-checks everything. */
  function validate() {
    var ok = true;
    FIELDS.forEach(function (field) {
      clearError(field);
      var value = (el(field.id)?.value || "").trim();

      if (!value) {
        showError(field, "Please enter " + field.label + ".");
        ok = false;
        return;
      }
      if (field.min && value.length < field.min) {
        showError(field, "Please enter at least " + field.min + " characters.");
        ok = false;
        return;
      }
      if (field.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        showError(field, "That does not look like an email address.");
        ok = false;
      }
    });
    return ok;
  }

  FIELDS.forEach(function (field) {
    el(field.id)?.addEventListener("input", function () {
      clearError(field);
    });
    el(field.id)?.addEventListener("change", function () {
      clearError(field);
    });
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) return;

    var area = (el("orgArea").value || "").trim();
    var phone = (el("adminPhone").value || "").trim();

    var payload = {
      name: el("orgName").value.trim(),
      type: el("orgType").value,
      location: el("orgLocation").value.trim(),
      admin_name: el("adminName").value.trim(),
      admin_email: el("adminEmail").value.trim().toLowerCase(),
      admin_password: el("adminPassword").value,
    };
    if (area) payload.floor_area_sqm = Number(area);
    if (phone) payload.admin_phone = phone;

    btn.disabled = true;
    btn.textContent = "Registering…";

    try {
      var result = await window.api.post("/organizations/register", payload);

      // The response has the same shape as a login, so start the session
      // rather than bouncing them to the sign-in page.
      localStorage.setItem("currentUser", JSON.stringify(result.admin));
      window.location.href = window.roleRoutes
        ? window.roleRoutes.forRole(result.admin.role)
        : "../system_admin/system_admin_overview.html";
    } catch (err) {
      // The backend refuses a duplicate organisation name or email, and its
      // messages tell the user what to do about it, so show them verbatim.
      var message = err.message || "Could not register. Please try again.";
      var field = /email/i.test(message)
        ? FIELDS.find(function (f) {
            return f.id === "adminEmail";
          })
        : FIELDS[0];
      showError(field, message);

      btn.disabled = false;
      btn.textContent = "Register organisation";
    }
  });
})();
