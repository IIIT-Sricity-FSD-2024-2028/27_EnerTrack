import { isEmailTaken, isPhoneTaken, saveRegisteredUser } from "../shared/mockData.js";

(function () {
    "use strict";

    /* ───────── DOM references ───────── */
    const form            = document.getElementById("signUpForm");
    const nameInput       = document.getElementById("name");
    const emailInput      = document.getElementById("email");
    const phoneInput      = document.getElementById("phone");
    const passwordInput   = document.getElementById("password");
    const confirmPwInput  = document.getElementById("confirmPassword");
    const roleSelect      = document.getElementById("role");

    const nameError       = document.getElementById("nameError");
    const emailError      = document.getElementById("emailError");
    const phoneError      = document.getElementById("phoneError");
    const passwordError   = document.getElementById("passwordError");
    const confirmPwError  = document.getElementById("confirmPasswordError");
    const roleError       = document.getElementById("roleError");

    /* ───────── Constants ───────── */
    const NAME_MIN        = 2;
    const NAME_MAX        = 50;
    const PASSWORD_MIN    = 8;
    const PASSWORD_MAX    = 32;
    const EMAIL_MAX       = 254;

    const SPECIAL_CHARS   = "!@#$%^&*()_+-=[]{}|;':\"\\,.<>/?`~";

    /* ───────── Character-checking helpers ───────── */

    /* Returns true if the character is a letter (A-Z or a-z) */
    function isLetter(ch) {
        var code = ch.charCodeAt(0);
        return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    }

    /* Returns true if the character is uppercase (A-Z) */
    function isUpperCase(ch) {
        var code = ch.charCodeAt(0);
        return code >= 65 && code <= 90;
    }

    /* Returns true if the character is lowercase (a-z) */
    function isLowerCase(ch) {
        var code = ch.charCodeAt(0);
        return code >= 97 && code <= 122;
    }

    /* Returns true if the character is a digit (0-9) */
    function isDigit(ch) {
        var code = ch.charCodeAt(0);
        return code >= 48 && code <= 57;
    }

    /* Returns true if the character is whitespace */
    function isSpace(ch) {
        return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
    }

    /* Returns true if the character is a special character */
    function isSpecialChar(ch) {
        return SPECIAL_CHARS.indexOf(ch) !== -1;
    }

    /* Returns true if the string contains any whitespace */
    function containsSpace(str) {
        for (var i = 0; i < str.length; i++) {
            if (isSpace(str[i])) return true;
        }
        return false;
    }

    /* Returns true if the string has consecutive dots */
    function containsConsecutiveDots(str) {
        for (var i = 0; i < str.length - 1; i++) {
            if (str[i] === "." && str[i + 1] === ".") return true;
        }
        return false;
    }

    /* Returns true if the string has consecutive spaces */
    function containsConsecutiveSpaces(str) {
        for (var i = 0; i < str.length - 1; i++) {
            if (str[i] === " " && str[i + 1] === " ") return true;
        }
        return false;
    }

    /* Returns true if every character in the string is a letter */
    function isAllLetters(str) {
        for (var i = 0; i < str.length; i++) {
            if (!isLetter(str[i])) return false;
        }
        return str.length > 0;
    }

    /* Returns true if every character is a letter or a space */
    function isAllLettersOrSpaces(str) {
        for (var i = 0; i < str.length; i++) {
            if (!isLetter(str[i]) && !isDigit(str[i]) && str[i] !== " ") return false;
        }
        return true;
    }

    /* ───────── Color-coded field state helpers ───────── */

    /*
     * showError — Marks the input as invalid (red border) and shows
     * a red error/guidance message below it.
     */
    function showError(errorEl, msg, inputEl) {
        errorEl.textContent = msg;
        errorEl.style.display = "block";
        if (inputEl) {
            inputEl.classList.remove("input-valid");
            inputEl.classList.add("input-invalid");
        }
    }

    /*
     * markValid — Marks the input as valid (green border) and
     * hides any error text below it.
     */
    function markValid(inputEl, errorEl) {
        inputEl.classList.remove("input-invalid");
        inputEl.classList.add("input-valid");
        errorEl.textContent = "";
        errorEl.style.display = "none";
    }

    /*
     * resetField — Resets the input back to default grey state and
     * hides the error text. Used when focus leaves an empty field.
     */
    function resetField(inputEl, errorEl) {
        inputEl.classList.remove("input-invalid", "input-valid");
        errorEl.textContent = "";
        errorEl.style.display = "none";
    }

    /*
     * clearAllErrors — Resets all fields to default state.
     */
    function clearAllErrors() {
        [nameError, emailError, phoneError, passwordError, confirmPwError, roleError]
            .forEach(function (el) { el.textContent = ""; el.style.display = "none"; });
        [nameInput, emailInput, phoneInput, passwordInput, confirmPwInput, roleSelect]
            .forEach(function (el) { el.classList.remove("input-invalid", "input-valid"); });
    }

    /* ───────── Validators ───────── */

    /*
     * validateName — Grey initially, red with guidance while invalid,
     * green border when all rules pass.
     */
    function validateName(isSubmit) {
        var val = nameInput.value;

        if (val.length === 0) {
            if (isSubmit) { showError(nameError, "Name is required.", nameInput); }
            else { resetField(nameInput, nameError); }
            return false;
        }
        if (isSpace(val[0]) || isSpace(val[val.length - 1])) {
            showError(nameError, "Name must not start or end with a space.", nameInput);
            return false;
        }
        val = val.trim();
        if (val.length < NAME_MIN) {
            showError(nameError, "Name must be at least " + NAME_MIN + " characters.", nameInput);
            return false;
        }
        if (val.length > NAME_MAX) {
            showError(nameError, "Name must not exceed " + NAME_MAX + " characters.", nameInput);
            return false;
        }
        if (!isLetter(val[0])) {
            showError(nameError, "Name must start with a letter.", nameInput);
            return false;
        }
        if (!isAllLettersOrSpaces(val)) {
            showError(nameError, "Name can only contain letters, numbers, and spaces.", nameInput);
            return false;
        }
        if (containsConsecutiveSpaces(val)) {
            showError(nameError, "Name must not contain consecutive spaces.", nameInput);
            return false;
        }

        markValid(nameInput, nameError);
        return true;
    }

    /*
     * validateEmail — Red guidance while invalid, green when valid.
     */
    function validateEmail(isSubmit) {
        var val = emailInput.value.trim();

        if (val.length === 0) {
            if (isSubmit) { showError(emailError, "Email is required.", emailInput); }
            else { resetField(emailInput, emailError); }
            return false;
        }
        if (val.length > EMAIL_MAX) {
            showError(emailError, "Email must not exceed " + EMAIL_MAX + " characters.", emailInput);
            return false;
        }
        if (containsSpace(val)) {
            showError(emailError, "Email must not contain spaces.", emailInput);
            return false;
        }
        if (containsConsecutiveDots(val)) {
            showError(emailError, "Email must not contain consecutive dots.", emailInput);
            return false;
        }

        var atIndex = val.indexOf("@");
        if (atIndex === -1 || atIndex !== val.lastIndexOf("@")) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }

        var localPart  = val.substring(0, atIndex);
        var domainPart = val.substring(atIndex + 1);

        if (localPart.length === 0 || localPart.length > 64) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }
        if (!isLetter(localPart[0]) && !isDigit(localPart[0])) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }
        if (!isLetter(localPart[localPart.length - 1]) && !isDigit(localPart[localPart.length - 1])) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }
        var localAllowed = "._%-+";
        for (var i = 0; i < localPart.length; i++) {
            var ch = localPart[i];
            if (!isLetter(ch) && !isDigit(ch) && localAllowed.indexOf(ch) === -1) {
                showError(emailError, "Please enter a valid email address.", emailInput);
                return false;
            }
        }

        if (domainPart.length === 0) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }
        var domainLabels = domainPart.split(".");
        if (domainLabels.length < 2) {
            showError(emailError, "Please enter a valid email address.", emailInput);
            return false;
        }
        for (var d = 0; d < domainLabels.length; d++) {
            var label = domainLabels[d];
            if (label.length === 0) {
                showError(emailError, "Please enter a valid email address.", emailInput);
                return false;
            }
            if (!isLetter(label[0]) && !isDigit(label[0])) {
                showError(emailError, "Please enter a valid email address.", emailInput);
                return false;
            }
            if (!isLetter(label[label.length - 1]) && !isDigit(label[label.length - 1])) {
                showError(emailError, "Please enter a valid email address.", emailInput);
                return false;
            }
            for (var k = 0; k < label.length; k++) {
                if (!isLetter(label[k]) && !isDigit(label[k]) && label[k] !== "-") {
                    showError(emailError, "Please enter a valid email address.", emailInput);
                    return false;
                }
            }
        }

        var tld = domainLabels[domainLabels.length - 1];
        if (tld.length < 2 || !isAllLetters(tld)) {
            showError(emailError, "Email must have a valid top-level domain (e.g. .com, .org).", emailInput);
            return false;
        }

        markValid(emailInput, emailError);
        return true;
    }

    /*
     * validatePassword — Red guidance while invalid, green when valid.
     * Max 32 chars only checked on submit.
     */
    function validatePassword(isSubmit) {
        var val = passwordInput.value;

        if (val.length === 0) {
            if (isSubmit) { showError(passwordError, "Password is required.", passwordInput); }
            else { resetField(passwordInput, passwordError); }
            return false;
        }
        if (val.length < PASSWORD_MIN) {
            showError(passwordError, "Password must be at least " + PASSWORD_MIN + " characters.", passwordInput);
            return false;
        }
        if (isSubmit && val.length > PASSWORD_MAX) {
            showError(passwordError, "Password must not exceed " + PASSWORD_MAX + " characters.", passwordInput);
            return false;
        }

        var hasUpper = false, hasLower = false, hasNum = false, hasSpecial = false;
        for (var i = 0; i < val.length; i++) {
            var pch = val[i];
            if (isUpperCase(pch))       hasUpper   = true;
            else if (isLowerCase(pch))  hasLower   = true;
            else if (isDigit(pch))      hasNum     = true;
            else if (isSpecialChar(pch)) hasSpecial = true;
        }

        if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
            showError(passwordError, "Needs: 1 uppercase, 1 lowercase, 1 number, and 1 special character.", passwordInput);
            return false;
        }

        markValid(passwordInput, passwordError);
        return true;
    }

    /*
     * validateConfirmPassword — Red until passwords match, then green.
     */
    function validateConfirmPassword(isSubmit) {
        var val = confirmPwInput.value;

        if (val.length === 0) {
            if (isSubmit) { showError(confirmPwError, "Confirm password is required.", confirmPwInput); }
            else { resetField(confirmPwInput, confirmPwError); }
            return false;
        }
        if (val !== passwordInput.value) {
            showError(confirmPwError, "Passwords do not match.", confirmPwInput);
            return false;
        }

        markValid(confirmPwInput, confirmPwError);
        return true;
    }

    /*
     * validateRole — Red until a role is selected, then green.
     */
    function validateRole(isSubmit) {
        if (!roleSelect.value) {
            if (isSubmit) { showError(roleError, "Please select a role.", roleSelect); }
            else { resetField(roleSelect, roleError); }
            return false;
        }
        markValid(roleSelect, roleError);
        return true;
    }

    /*
     * validatePhone — Red while invalid, green when exactly 10 digits.
     */
    function validatePhone(isSubmit) {
        var val = phoneInput.value;

        if (val.length === 0) {
            if (isSubmit) { showError(phoneError, "Phone number is required.", phoneInput); }
            else { resetField(phoneInput, phoneError); }
            return false;
        }
        /* Only digits allowed */
        for (var i = 0; i < val.length; i++) {
            if (!isDigit(val[i])) {
                showError(phoneError, "Only digits are allowed.", phoneInput);
                return false;
            }
        }
        if (val.length !== 10) {
            showError(phoneError, "Phone number must be exactly 10 digits.", phoneInput);
            return false;
        }
        if (val === "0000000000") {
            showError(phoneError, "Phone number cannot be all zeros.", phoneInput);
            return false;
        }

        markValid(phoneInput, phoneError);
        return true;
    }





    /* ───────── Real-time validation on input ───────── */
    nameInput.addEventListener("input", validateName);
    emailInput.addEventListener("input", validateEmail);
    phoneInput.addEventListener("input", validatePhone);
    passwordInput.addEventListener("input", function () {
        validatePassword();
        if (confirmPwInput.value.length > 0) validateConfirmPassword();
    });
    confirmPwInput.addEventListener("input", validateConfirmPassword);
    roleSelect.addEventListener("change", validateRole);

    /* ───────── Character limit enforcement ───────── */
    nameInput.addEventListener("input", function () {
        if (this.value.length > NAME_MAX) this.value = this.value.slice(0, NAME_MAX);
    });
    emailInput.addEventListener("input", function () {
        if (this.value.length > EMAIL_MAX) this.value = this.value.slice(0, EMAIL_MAX);
    });
    phoneInput.addEventListener("input", function () {
        if (this.value.length > 10) this.value = this.value.slice(0, 10);
    });

    /* ──── Prevent pasting into confirm password field ──── */
    confirmPwInput.addEventListener("paste", function (e) {
        e.preventDefault();
    });

    /* ───────── Form submission ───────── */
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        clearAllErrors();

        var isValid = true;

        if (!validateName(true))            isValid = false;
        if (!validateEmail(true))           isValid = false;
        if (!validatePhone(true))           isValid = false;
        if (!validatePassword(true))        isValid = false;
        if (!validateConfirmPassword(true)) isValid = false;
        if (!validateRole(true))            isValid = false;

        if (!isValid) {
            var firstErr = form.querySelector(".field-error[style*='block']");
            if (firstErr) firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        /* Check if email or phone is already taken — show popup */
        var emailTaken = isEmailTaken(emailInput.value.trim());
        var phoneTaken = isPhoneTaken(phoneInput.value.trim());

        if (emailTaken || phoneTaken) {
            var popup = document.getElementById("duplicatePopup");
            var popupMsg = document.getElementById("popupMsg");

            if (emailTaken && phoneTaken) {
                popupMsg.textContent = "Both this email and phone number are already registered.";
            } else if (emailTaken) {
                popupMsg.textContent = "An account with this email already exists.";
            } else {
                popupMsg.textContent = "An account with this phone number already exists.";
            }

            popup.style.display = "flex";

            document.getElementById("popupClose").onclick = function () {
                popup.style.display = "none";
            };
            return;
        }

        /* Save new user to sessionStorage */
        var newUser = {
            name:     nameInput.value.trim(),
            email:    emailInput.value.trim().toLowerCase(),
            phone:    phoneInput.value.trim(),
            password: passwordInput.value,
            role:     roleSelect.value
        };
        var savedUser = saveRegisteredUser(newUser);

        /* Save current user to localStorage for persistence */
        localStorage.setItem("currentUser", JSON.stringify(savedUser));

        /* Redirect to landing page */
        window.location.href = "../landing/landing.html";
    });

    /* ───────── Password toggle functions ───────── */

    /* Toggles the password field between visible and hidden */
    window.togglePass = function () {
        var pw   = document.getElementById("password");
        var open = document.getElementById("eyeOpen");
        var shut = document.getElementById("eyeClosed");

        if (pw.type === "password") {
            pw.type       = "text";
            open.style.display = "block";
            shut.style.display = "none";
        } else {
            pw.type       = "password";
            open.style.display = "none";
            shut.style.display = "block";
        }
    };

    /* Toggles the confirm password field between visible and hidden */
    window.toggleConfirmPass = function () {
        var pw   = document.getElementById("confirmPassword");
        var open = document.getElementById("eyeOpenConfirm");
        var shut = document.getElementById("eyeClosedConfirm");

        if (pw.type === "password") {
            pw.type       = "text";
            open.style.display = "block";
            shut.style.display = "none";
        } else {
            pw.type       = "password";
            open.style.display = "none";
            shut.style.display = "block";
        }
    };

})();
