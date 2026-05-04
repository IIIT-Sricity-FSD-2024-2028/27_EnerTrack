/*
 * mockData.js - universal user source for EnerTrack authentication.
 * Admin, sign-up, and sign-in all read and write this same localStorage-backed
 * UniversalDB user list.
 */

import universalDB from "./universalDB.js";

export let users = universalDB.data.users;

function syncUsers(nextUsers) {
    users = nextUsers;
    universalDB.data.users = users;
    universalDB.save();
}

function createUserId() {
    return "user-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function mockHashPassword(password) {
    return "hashed_" + btoa(password).substring(0, 10);
}

function cloneUser(user) {
    return JSON.parse(JSON.stringify(user));
}

function repairDemoPasswords() {
    const demoPasswords = {
        "user-001": "Aadi@123",
        "user-002": "Teja@123",
        "user-003": "Chirag@123",
        "user-004": "Husaam@123",
        "user-005": "Viksa@123"
    };

    let changed = false;
    users.forEach((user) => {
        if (user.password === "hashed_password_mock" && demoPasswords[user.user_id]) {
            user.password = demoPasswords[user.user_id];
            changed = true;
        }
    });

    if (changed) syncUsers(users);
}

function repairDemoEmails() {
    const demoEmails = {
        "user-001": "aadithya@gmail.com",
        "user-002": "teja@gmail.com",
        "user-003": "chirag@gmail.com",
        "user-004": "husaam@gmail.com",
        "user-005": "viksa@gmail.com"
    };

    let changed = false;
    users.forEach((user) => {
        if (demoEmails[user.user_id] && /@enertrack\.edu$/i.test(user.email || "")) {
            user.email = demoEmails[user.user_id];
            changed = true;
        }
    });

    if (changed) syncUsers(users);
}

function migrateRegisteredUsers() {
    const stored = localStorage.getItem("registeredUsers");
    if (!stored) return;

    try {
        const registeredUsers = JSON.parse(stored);
        if (!Array.isArray(registeredUsers)) return;

        let changed = false;
        registeredUsers.forEach((user) => {
            const email = normalizeEmail(user.email);
            if (!email || users.some((existing) => normalizeEmail(existing.email) === email)) return;

            users.push({
                user_id: user.user_id || createUserId(),
                name: user.name,
                email,
                phone: user.phone || null,
                password: user.password,
                role: user.role,
                specialization: user.specialization || null
            });
            changed = true;
        });

        if (changed) syncUsers(users);
        localStorage.removeItem("registeredUsers");
    } catch (e) {
        console.error("mockData: Failed to migrate registered users", e);
    }
}

repairDemoPasswords();
repairDemoEmails();
migrateRegisteredUsers();

export const userActions = {
    getAllUsers() {
        users = universalDB.data.users;
        return users.map(cloneUser);
    },

    addUser(userData) {
        const user = {
            user_id: userData.user_id || userData.id || createUserId(),
            name: userData.name,
            email: normalizeEmail(userData.email),
            phone: userData.phone || null,
            password: userData.password,
            role: userData.role,
            specialization: userData.specialization || null
        };

        users = universalDB.data.users;
        users.push(user);
        syncUsers(users);
        return cloneUser(user);
    },

    deleteUser(id) {
        users = universalDB.data.users;
        const beforeCount = users.length;
        syncUsers(users.filter((user) => user.user_id !== id && user.id !== id));
        return users.length !== beforeCount;
    },

    authenticate(username, password) {
        const normalizedUsername = normalizeEmail(username);
        users = universalDB.data.users;

        const found = users.find((user) => {
            const emailMatches = normalizeEmail(user.email) === normalizedUsername;
            const passwordMatches = user.password === password || user.password === mockHashPassword(password);
            return emailMatches && passwordMatches;
        });

        return found ? cloneUser(found) : null;
    }
};

export function getRegisteredUsers() {
    return userActions.getAllUsers();
}

export function saveRegisteredUser(user) {
    return userActions.addUser(user);
}

export function findUser(email, password) {
    return userActions.authenticate(email, password);
}

export function isEmailTaken(email) {
    const normalizedEmail = normalizeEmail(email);
    return userActions.getAllUsers().some((user) => normalizeEmail(user.email) === normalizedEmail);
}

export function isPhoneTaken(phone) {
    return userActions.getAllUsers().some((user) => user.phone && user.phone === phone);
}

window.userActions = userActions;
window.getRegisteredUsers = getRegisteredUsers;
window.saveRegisteredUser = saveRegisteredUser;
window.findUser = findUser;
window.isEmailTaken = isEmailTaken;
window.isPhoneTaken = isPhoneTaken;
