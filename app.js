// Paste your Firebase Config below:
const firebaseConfig = {
    apiKey: "AIzaSyAK8KDRv2r8tjPGUYaDvMvPZFLeooSDHEg",
    authDomain: "discount-wheel.firebaseapp.com",
    projectId: "discount-wheel",
    storageBucket: "discount-wheel.firebasestorage.app",
    messagingSenderId: "605096690322",
    appId: "1:605096690322:web:78857f8c7cdc2f4e031c4b"
};

// Initialize Firebase using compatibility libraries
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Discord OAuth Settings
const DISCORD_CLIENT_ID = "1516896455191822496"; 
const REDIRECT_URI = "https://chahinechahed5-lang.github.io/discount-wheel/";

// DOM Elements
const loginSection = document.getElementById('login-section');
const wheelSection = document.getElementById('wheel-section');
const loginBtn = document.getElementById('login-btn');
const spinBtn = document.getElementById('spin-btn');
const usernameDisplay = document.getElementById('username-display');
const resultDisplay = document.getElementById('result-display');

let currentUser = null;

// Handle Discord Login Redirect
loginBtn.addEventListener('click', () => {
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
    window.location.href = authUrl;
});

// Check URL Hash for Discord Token on Page Load
window.addEventListener('DOMContentLoaded', async () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get('access_token');

    if (accessToken) {
        try {
            // Fetch user identity from Discord API
            const response = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const data = await response.json();
            
            if (data.id && data.username) {
                currentUser = { id: data.id, username: data.username };
                sessionStorage.setItem('discordUser', JSON.stringify(currentUser));
                // Clean up URL bar
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error("Error fetching Discord user:", error);
        }
    }

    // Check session storage
    const storedUser = sessionStorage.getItem('discordUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        loginSection.classList.add('hidden');
        wheelSection.classList.remove('hidden');
        usernameDisplay.textContent = currentUser.username;
        
        // Check if user already spun
        const hasSpun = await checkIfSpun(currentUser.id);
        if (hasSpun) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Already Spun!";
            spinBtn.style.backgroundColor = "#888";
            resultDisplay.textContent = "You have already claimed your prize.";
        }
    }
});

// 🎡 PRIZE SYSTEM PROBABILITY ENGINE
const prizes = [
    { name: "🎁 FREE ITEM", chance: 0.001 },      // 0.1%
    { name: "💥 50% OFF", chance: 0.01 },         // 1%
    { name: "🔥 25% OFF", chance: 0.10 },         // 10%
    { name: "20% OFF", chance: 0.15 },            // 15%
    { name: "15% OFF", chance: 0.20 },            // 20%
    { name: "Smaller Discount", chance: 0.539 }   // 53.9%
];

function spinWheel() {
    const rand = Math.random();
    let cumulativeChance = 0;

    for (const prize of prizes) {
        cumulativeChance += prize.chance;
        if (rand <= cumulativeChance) {
            return prize.name;
        }
    }
    return "Smaller Discount"; // Fallback
}

// Database check: Did the user spin already?
async function checkIfSpun(discordId) {
    const snapshot = await db.collection('spins').where('discordId', '==', discordId).get();
    return !snapshot.empty;
}

// Spin Button Logic
spinBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    // Double check state
    const alreadySpun = await checkIfSpun(currentUser.id);
    if (alreadySpun) {
        alert("Nice try! You've already spun the wheel.");
        location.reload();
        return;
    }

    const wonPrize = spinWheel();
    
    // Save to Firestore using client-side timestamp for simple rules validation
    try {
        await db.collection('spins').doc(currentUser.id).set({
            discordId: currentUser.id,
            username: currentUser.username,
            prize: wonPrize,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        resultDisplay.textContent = `🎉 You won: ${wonPrize}!`;
        spinBtn.disabled = true;
        spinBtn.textContent = "Spun Successfully";
        spinBtn.style.backgroundColor = "#888";

    } catch (error) {
        console.error("Error saving spin result:", error);
        alert("Database error occurred. Please try again.");
    }
});
