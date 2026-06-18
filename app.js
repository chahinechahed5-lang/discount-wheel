// Paste your Firebase Config below:
const firebaseConfig = {
    apiKey: "AIzaSyAK8KDRv2r8tjPGUYaDvMvPZFLeooSDHEg",
    authDomain: "discount-wheel.firebaseapp.com",
    projectId: "discount-wheel",
    storageBucket: "discount-wheel.firebasestorage.app",
    messagingSenderId: "605096690322",
    appId: "1:605096690322:web:78857f8c7cdc2f4e031c4b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Discord OAuth & Webhook Settings
const DISCORD_CLIENT_ID = "1516896455191822496"; 
const REDIRECT_URI = "https://chahinechahed5-lang.github.io/discount-wheel/";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1517160213377974282/d-gX6PwSn0LR6bPpyAezX_i7zI3nI2rgy1zsacItitxee8DNK-lEdPb24Rcu-J1qjaAd"; 

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
            const response = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const data = await response.json();
            
            if (data.id && data.username) {
                currentUser = { id: data.id, username: data.username };
                sessionStorage.setItem('discordUser', JSON.stringify(currentUser));
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error("Error fetching Discord user:", error);
        }
    }

    const storedUser = sessionStorage.getItem('discordUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        loginSection.classList.add('hidden');
        wheelSection.classList.remove('hidden');
        usernameDisplay.textContent = currentUser.username;
        
        // Check if user already spun
        const hasSpin = await checkIfSpin(currentUser.id);
        if (hasSpin) {
            spinBtn.disabled = true;
            spinBtn.textContent = "Spin";
            resultDisplay.textContent = "You have already claimed your prize.";
        }
    }
});

// 🎡 PRIZE SYSTEM PROBABILITY ENGINE & VISUAL WHEEL CONFIG
const prizes = [
    { name: "🎁 FREE ITEM", chance: 0.001, color: "#d63031" },      // 0.1%
    { name: "💥 50% OFF", chance: 0.01, color: "#e17055" },         // 1%
    { name: "🔥 25% OFF", chance: 0.05, color: "#fdcb6e" },         // 5%
    { name: "20% OFF", chance: 0.10, color: "#00cec9" },            // 10%
    { name: "15% OFF", chance: 0.194, color: "#0984e3" },           // 19.4%
    { name: "5% OFF", chance: 0.645, color: "#6c5ce7" }           // 64.5%
];

// Canvas Wheel Setup
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const radius = canvas.width / 2;
let startAngle = 0;
const arc = Math.PI * 2 / prizes.length;

function drawWheel() {
    for (let i = 0; i < prizes.length; i++) {
        // Draw slices aligned so index 0 centers upwards towards the pin
        const angle = startAngle + i * arc;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, angle, angle + arc, false);
        ctx.lineTo(radius, radius);
        ctx.fillStyle = prizes[i].color;
        ctx.fill();
        ctx.stroke();
        ctx.save();

        // Text styling & placement
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px Arial";
        ctx.translate(
            radius + Math.cos(angle + arc / 2) * (radius / 1.6),
            radius + Math.sin(angle + arc / 2) * (radius / 1.6)
        );
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        ctx.fillText(prizes[i].name, -ctx.measureText(prizes[i].name).width / 2, 0);
        ctx.restore();
    }
}

// Spin Resolution & Animation Variables
let spinTimeout = null;
let startAngleValue = 0;
let totalAngleToSpin = 0;
let spinTime = 0;
let spinTimeTotal = 0;

function spinWheelVisual(targetAngle) {
    spinTime = 0;
    spinTimeTotal = 5000; // Fixed 5-second spin duration
    totalAngleToSpin = (Math.PI * 16) + targetAngle; // 8 full rotations + offset
    rotateWheel();
}

function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    
    // Easing formula for smooth deceleration
    const easeOutVal = easeOut(spinTime, 0, 1, spinTimeTotal);
    startAngleValue = easeOutVal * totalAngleToSpin;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    startAngle = startAngleValue;
    drawWheel();
    
    spinTimeout = setTimeout(rotateWheel, 30);
}

function stopRotateWheel() {
    clearTimeout(spinTimeout);
    // Ensure the wheel rests exactly on the calculated final angle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    startAngle = totalAngleToSpin;
    drawWheel();
}

function easeOut(t, b, c, d) {
    return c * (1 - Math.pow(1 - t / d, 3)) + b;
}

// Database check: Did the user spin already?
async function checkIfSpin(discordId) {
    const snapshot = await db.collection('spins').where('discordId', '==', discordId).get();
    return !snapshot.empty;
}

// Spin Button Logic
spinBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const alreadySpin = await checkIfSpin(currentUser.id);
    if (alreadySpin) {
        alert("Nice try! You've already spun the wheel.");
        location.reload();
        return;
    }

    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    // 1. Determine winning slice from probability engine
    const rand = Math.random();
    let cumulativeChance = 0;
    let chosenPrizeObj = prizes[prizes.length - 1];

    for (let i = 0; i < prizes.length; i++) {
        cumulativeChance += prizes[i].chance;
        if (rand <= cumulativeChance) {
            chosenPrizeObj = prizes[i];
            break;
        }
    }

    // 2. Calculate the exact angle offset required to align the middle of the slice with the top pin (12 o'clock position)
    const prizeIndex = prizes.indexOf(chosenPrizeObj);
    const targetSliceCenter = prizeIndex * arc + (arc / 2);
    const targetOffset = (Math.PI * 1.5) - targetSliceCenter;

    // 3. Trigger Animation
    spinWheelVisual(targetOffset);

    // 4. Save to database and trigger Discord announcement
    setTimeout(async () => {
        try {
            await db.collection('spins').doc(currentUser.id).set({
                discordId: currentUser.id,
                username: currentUser.username,
                prize: chosenPrizeObj.name,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            resultDisplay.textContent = `🎉 You won: ${chosenPrizeObj.name}!`;
            spinBtn.textContent = "Spin";

            // Announce to Discord announcement channel via webhook
            if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL !== "YOUR_DISCORD_WEBHOOK_URL_HERE") {
                await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `🎉 **${currentUser.username}** just spun the wheel and received **${chosenPrizeObj.name}**! 🎰`
                    })
                });
            }

        } catch (error) {
            console.error("Error saving spin result or sending announcement:", error);
            alert("Database/announcement error occurred. Please try again.");
            spinBtn.disabled = false;
        }
    }, 5200); // Resolve right after the 5s animation completes
});

// Initial Draw
drawWheel();
