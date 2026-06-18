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
        const hasSpun = await checkIfSpun(currentUser.id);
        if (hasSpun) {
            spinBtn.disabled = true;
            resultDisplay.textContent = "You have already claimed your prize.";
        }
    }
});

// 🎡 PRIZE SYSTEM PROBABILITY ENGINE & VISUAL WHEEL CONFIG
const prizes = [
    { name: "🎁 FREE ITEM", chance: 0.001, color: "#d63031" },      // 0.1%
    { name: "💥 50% OFF", chance: 0.01, color: "#e17055" },         // 1%
    { name: "🔥 25% OFF", chance: 0.10, color: "#fdcb6e" },         // 10%
    { name: "20% OFF", chance: 0.15, color: "#00cec9" },            // 15%
    { name: "15% OFF", chance: 0.20, color: "#0984e3" },            // 20%
    { name: "Smaller Discount", chance: 0.539, color: "#6c5ce7" }   // 53.9%
];

// Canvas Wheel Setup
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const radius = canvas.width / 2;
let startAngle = 0;
const arc = Math.PI * 2 / prizes.length;

function drawWheel() {
    for (let i = 0; i < prizes.length; i++) {
        const angle = startAngle + i * arc;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, angle, angle + arc, false);
        ctx.lineTo(radius, radius);
        ctx.fillStyle = prizes[i].color;
        ctx.fill();
        ctx.stroke();
        ctx.save();

        // Text styling
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px Arial";
        ctx.translate(
            radius + Math.cos(angle + arc / 2) * (radius / 1.5),
            radius + Math.sin(angle + arc / 2) * (radius / 1.5)
        );
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        ctx.fillText(prizes[i].name, -ctx.measureText(prizes[i].name).width / 2, 0);
        ctx.restore();
    }
}

// Spin Resolution & Animation
let spinTimeout = null;
let startAngleValue = 0;
let arcRotations = 0;
let spinTime = 0;
let spinTimeTotal = 0;

function spinWheelVisual() {
    spinTime = 0;
    spinTimeTotal = Math.random() * 3000 + 4000; // spin between 4 to 7 seconds
    rotateWheel();
}

function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    const spinAngle = easeOut(spinTime, 0, arcRotations, spinTimeTotal);
    startAngleValue += (spinAngle * Math.PI / 180);
    ctx.clearRect(0,0,500,500);
    startAngle = startAngleValue;
    drawWheel();
    spinTimeout = setTimeout(rotateWheel, 30);
}

function easeOut(t, b, c, d) {
    const ts = (t/=d)*t;
    const tc = ts*t;
    return b+c*(tc + -3*ts + 3*t);
}

function getPrizeIndexByAngle(angle) {
    const degrees = (angle * 180 / Math.PI + 90) % 360;
    const arcDegrees = 360 / prizes.length;
    // Pin is at top (0/360 degrees). Inverse lookup based on angle.
    const index = Math.floor((360 - degrees) / arcDegrees) % prizes.length;
    return index < 0 ? index + prizes.length : index;
}

// Database check: Did the user spin already?
async function checkIfSpun(discordId) {
    const snapshot = await db.collection('spins').where('discordId', '==', discordId).get();
    return !snapshot.empty;
}

// Spin Button Logic
spinBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    const alreadySpun = await checkIfSpun(currentUser.id);
    if (alreadySpun) {
        alert("Nice try! You've already spun the wheel.");
        location.reload();
        return;
    }

    spinBtn.disabled = true;

    // Determine the winning slice from probability engine first
    const rand = Math.random();
    let cumulativeChance = 0;
    let chosenPrizeObj = prizes[prizes.length - 1]; // fallback

    for (let i = 0; i < prizes.length; i++) {
        cumulativeChance += prizes[i].chance;
        if (rand <= cumulativeChance) {
            chosenPrizeObj = prizes[i];
            break;
        }
    }

    // Calculate rotation offset so the chosen slice aligns with the top pointer (Pin)
    const prizeIndex = prizes.indexOf(chosenPrizeObj);
    const desiredAngle = (prizes.length - prizeIndex) * arc; 
    arcRotations = 10 * Math.PI * 2 + desiredAngle; // Multi-rotations + offset

    // Start Visual Animation
    spinWheelVisual();

    // Save to Firestore and resolve result after wheel animation completes (~7 seconds)
    setTimeout(async () => {
        try {
            await db.collection('spins').doc(currentUser.id).set({
                discordId: currentUser.id,
                username: currentUser.username,
                prize: chosenPrizeObj.name,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            resultDisplay.textContent = `🎉 You won: ${chosenPrizeObj.name}!`;
            spinBtn.textContent = "Done";

        } catch (error) {
            console.error("Error saving spin result:", error);
            alert("Database error occurred. Please try again.");
            spinBtn.disabled = false;
        }
    }, 7200);
});

// Initial Draw
drawWheel();
