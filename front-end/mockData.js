/*
 * mockData.js — Pre-defined users for each role.
 * Used by both sign_in.js and sign_up.js for authentication.
 *
 * Structure: array of user objects with email, password, name, phone, and role.
 * On sign-up, new users are saved to sessionStorage under "registeredUsers".
 * On sign-in, the system checks both this mock data AND sessionStorage.
 */

var MOCK_USERS = [
    {
        name: "Aadithya",
        email: "aadi150906@gmail.com",
        phone: "9876543210",
        password: "Aadi@123",
        role: "System Administrator"
    },
    {
        name: "Husaam",
        email: "Husaam@gmail.com",
        phone: "9876543211",
        password: "Husaam@123",
        role: "Financial Analyst"
    },
    {
        name: "Chirag",
        email: "chirag@gmail.com",
        phone: "9876543212",
        password: "Chirag@123",
        role: "Technician"
    },
    {
        name: "Viksa",
        email: "Viksa@gmail.com",
        phone: "9876543213",
        password: "Viksa@123",
        role: "Sustainability Officer"
    }
];

/*
 * getRegisteredUsers — Retrieves users saved via sign-up from sessionStorage.
 */
function getRegisteredUsers() {
    var stored = sessionStorage.getItem("registeredUsers");
    if (stored) {
        try { return JSON.parse(stored); }
        catch (e) { return []; }
    }
    return [];
}

/*
 * saveRegisteredUser — Adds a new user to sessionStorage.
 */
function saveRegisteredUser(user) {
    var users = getRegisteredUsers();
    users.push(user);
    sessionStorage.setItem("registeredUsers", JSON.stringify(users));
}

/*
 * findUser — Looks up a user by email and password across
 * both mock data and sessionStorage.
 * Returns the matching user object or null.
 */
function findUser(email, password) {
    var allUsers = MOCK_USERS.concat(getRegisteredUsers());
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].email.toLowerCase() === email.toLowerCase() &&
            allUsers[i].password === password) {
            return allUsers[i];
        }
    }
    return null;
}

/*
 * isEmailTaken — Checks if an email is already registered
 * in mock data or sessionStorage.
 */
function isEmailTaken(email) {
    var allUsers = MOCK_USERS.concat(getRegisteredUsers());
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].email.toLowerCase() === email.toLowerCase()) {
            return true;
        }
    }
    return false;
}

/*
 * isPhoneTaken — Checks if a phone number is already registered.
 */
function isPhoneTaken(phone) {
    var allUsers = MOCK_USERS.concat(getRegisteredUsers());
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].phone === phone) {
            return true;
        }
    }
    return false;
}
