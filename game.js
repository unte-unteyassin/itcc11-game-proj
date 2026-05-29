// =====================================================
// SLAYER'S PATH - FULL GAME SCRIPT (CRASH-PROOF UI)
// =====================================================

// --- FIREBASE INITIALIZATION (safe fallback to localStorage) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    runTransaction,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcHLBdl6FcZQwejQdRYcZ7bB4Wvuad4I0",
  authDomain: "infinity-duel-e0474.firebaseapp.com",
  projectId: "infinity-duel-e0474",
  storageBucket: "infinity-duel-e0474.firebasestorage.app",
  messagingSenderId: "897660081382",
  appId: "1:897660081382:web:78bc6886c89dc94ddad727",
  measurementId: "G-Y2PLDVF0F7"
};

let firebaseApp = null;
let db = null;
let auth = null;
let firebaseReady = false;
let firebaseUser = null;
let authReady = false;

const hasRealFirebaseConfig = !Object.values(firebaseConfig).some((value) => {
    const text = String(value || "");
    return text.length === 0 || text.includes("PLACEHOLDER") || text.startsWith("YOUR_");
});

try {
    if (hasRealFirebaseConfig) {
        firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);
        firebaseReady = true;
        console.log("Firebase connected. Leaderboards will sync with Firestore.");
    } else {
        console.warn("Firebase placeholders detected. Using localStorage leaderboards for now.");
    }
} catch (error) {
    firebaseReady = false;
    console.warn("Firebase initialization failed. Using localStorage leaderboards.", error);
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// =====================================================
// POLISHED MENU UI + FIREBASE-READY LEADERBOARDS
// =====================================================
const menuContainer = document.getElementById("mainMenu");

if (!menuContainer) {
    throw new Error("Missing #mainMenu in index.html");
}

const btnArcade = document.getElementById("btnArcade");
const btnBoss = document.getElementById("btnBoss");
const btnControls = document.getElementById("btnControls");
const controlsPanel = document.getElementById("controlsPanel");
const btnCloseControls = document.getElementById("btnCloseControls");

if (!menuContainer.dataset.hover) menuContainer.dataset.hover = "none";

function setMenuHover(mode = "none") {
    if (!menuContainer) return;
    menuContainer.dataset.hover = mode;
}

if (btnBoss) {
    btnBoss.addEventListener("mouseenter", () => setMenuHover("boss"));
    btnBoss.addEventListener("focus", () => setMenuHover("boss"));
    btnBoss.addEventListener("click", () => { if (requireLoginBeforePlaying()) startGameplay("boss"); });
}

if (btnArcade) {
    btnArcade.addEventListener("mouseenter", () => setMenuHover("arcade"));
    btnArcade.addEventListener("focus", () => setMenuHover("arcade"));
    btnArcade.addEventListener("click", () => { if (requireLoginBeforePlaying()) startGameplay("arcade"); });
}

function openControlsPanel() {
    if (!controlsPanel) return;
    controlsPanel.classList.add("open");
    controlsPanel.setAttribute("aria-hidden", "false");
}

function closeControlsPanel() {
    if (!controlsPanel) return;
    controlsPanel.classList.remove("open");
    controlsPanel.setAttribute("aria-hidden", "true");
}

if (btnControls) {
    btnControls.addEventListener("mouseenter", () => setMenuHover("controls"));
    btnControls.addEventListener("focus", () => setMenuHover("controls"));
    btnControls.addEventListener("click", openControlsPanel);
}

if (btnCloseControls) btnCloseControls.addEventListener("click", closeControlsPanel);
if (controlsPanel) {
    controlsPanel.addEventListener("click", (event) => {
        if (event.target === controlsPanel) closeControlsPanel();
    });
}

window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") closeControlsPanel();
});

menuContainer.addEventListener("mouseleave", () => setMenuHover("none"));


injectFirebaseAuthStyles();
ensureFirebaseAuthPanel();

const authPanel = document.getElementById("authPanel");
const authStatus = document.getElementById("authStatus");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authNameInput = document.getElementById("authName");
const btnLogin = document.getElementById("btnLogin");
const btnCreateAccount = document.getElementById("btnCreateAccount");
const btnLogout = document.getElementById("btnLogout");

function injectFirebaseAuthStyles() {
    if (document.getElementById("firebaseAuthRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "firebaseAuthRuntimeStyles";
    style.textContent = `
        #authPanel {
            width: min(880px, 92vw);
            margin: 18px auto 0;
            padding: 14px;
            border: 2px solid rgba(56, 189, 248, 0.55);
            background: rgba(2, 6, 23, 0.78);
            box-shadow: 0 0 24px rgba(56, 189, 248, 0.18);
            backdrop-filter: blur(10px);
            font-family: 'Press Start 2P', 'Courier New', monospace;
        }
        #authPanel .auth-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
        }
        #authPanel h2 {
            font-size: clamp(0.7rem, 1.4vw, 1rem);
            color: #fbbf24;
            text-shadow: 0 0 10px rgba(251, 191, 36, 0.75);
        }
        #authStatus {
            font-size: 0.62rem;
            color: #bfdbfe;
            line-height: 1.6;
            text-align: right;
        }
        #authForm {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr auto auto;
            gap: 8px;
            align-items: center;
        }
        #authForm input {
            min-width: 0;
            padding: 11px 10px;
            border: 1px solid rgba(148, 163, 184, 0.8);
            background: rgba(15, 23, 42, 0.9);
            color: #fff;
            font-family: 'Press Start 2P', 'Courier New', monospace;
            font-size: 0.62rem;
            outline: none;
        }
        #authForm input:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.35);
        }
        #authForm button {
            white-space: nowrap;
            padding: 11px 12px;
            font-size: 0.6rem;
            font-family: 'Press Start 2P', 'Courier New', monospace;
        }
        #btnLogout {
            border-color: #fb7185;
        }
        body.firebase-login-required .mode-btn:not(.controls-btn) {
            opacity: 0.55;
        }
        body.firebase-login-required .mode-btn:not(.controls-btn)::after {
            content: "LOGIN REQUIRED";
            display: block;
            margin-top: 8px;
            color: #fbbf24;
            font-size: 0.55rem;
        }
        @media (max-width: 900px) {
            #authForm {
                grid-template-columns: 1fr;
            }
            #authStatus {
                text-align: left;
            }
            #authPanel .auth-title-row {
                align-items: flex-start;
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(style);
}

function ensureFirebaseAuthPanel() {
    if (document.getElementById("authPanel")) return;

    const menuUI = menuContainer.querySelector(".menu-ui") || menuContainer;
    const leaderboard = document.getElementById("leaderboard");

    const panel = document.createElement("div");
    panel.id = "authPanel";
    panel.innerHTML = `
        <div class="auth-title-row">
            <h2>PLAYER LOGIN</h2>
            <p id="authStatus">Firebase placeholder mode. Add config to enable login.</p>
        </div>
        <div id="authForm">
            <input id="authName" type="text" maxlength="12" placeholder="NAME TAG" autocomplete="nickname" />
            <input id="authEmail" type="email" placeholder="EMAIL" autocomplete="email" />
            <input id="authPassword" type="password" placeholder="PASSWORD" autocomplete="current-password" />
            <button id="btnLogin" type="button">LOGIN</button>
            <button id="btnCreateAccount" type="button">SIGN UP</button>
            <button id="btnLogout" type="button" style="display:none;">LOGOUT</button>
        </div>
    `;

    if (leaderboard && leaderboard.parentElement === menuUI) menuUI.insertBefore(panel, leaderboard);
    else menuUI.appendChild(panel);
}

function formatFirebaseError(error) {
    const raw = String(error?.code || error?.message || "unknown error");
    return raw
        .replace("auth/", "")
        .replaceAll("-", " ")
        .replaceAll("_", " ")
        .toUpperCase();
}

function updateAuthUI(message = "") {
    const needsLogin = firebaseReady && !firebaseUser;

    if (!firebaseReady) {
        document.body.classList.remove("firebase-login-required");
        if (authStatus) authStatus.textContent = "DEV MODE: Firebase config is placeholder. Login is disabled and localStorage scores are active.";
        if (btnLogin) btnLogin.disabled = true;
        if (btnCreateAccount) btnCreateAccount.disabled = true;
        if (btnLogout) btnLogout.style.display = "none";
        return;
    }

    document.body.classList.toggle("firebase-login-required", needsLogin);

    if (firebaseUser) {
        const shownName = firebaseUser.displayName || firebaseUser.email || "SIGNED IN";
        if (authStatus) authStatus.textContent = message || `SIGNED IN AS ${shownName}`;
        if (btnLogin) btnLogin.style.display = "none";
        if (btnCreateAccount) btnCreateAccount.style.display = "none";
        if (btnLogout) btnLogout.style.display = "inline-block";
        if (authEmailInput) authEmailInput.style.display = "none";
        if (authPasswordInput) authPasswordInput.style.display = "none";
        if (authNameInput) authNameInput.style.display = "none";
    } else {
        if (authStatus) authStatus.textContent = message || "LOGIN REQUIRED: create an account or log in before playing/submitting scores.";
        if (btnLogin) {
            btnLogin.style.display = "inline-block";
            btnLogin.disabled = false;
        }
        if (btnCreateAccount) {
            btnCreateAccount.style.display = "inline-block";
            btnCreateAccount.disabled = false;
        }
        if (btnLogout) btnLogout.style.display = "none";
        if (authEmailInput) authEmailInput.style.display = "block";
        if (authPasswordInput) authPasswordInput.style.display = "block";
        if (authNameInput) authNameInput.style.display = "block";
    }
}

function requireLoginBeforePlaying() {
    if (!firebaseReady) return true;
    if (firebaseUser) return true;

    updateAuthUI("LOGIN FIRST, THEN PICK BOSS OR ARCADE.");
    const panel = document.getElementById("authPanel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "center" });
    playSound(sfxReveal);
    return false;
}

async function handleAuthLogin(createAccount = false) {
    if (!firebaseReady || !auth) {
        updateAuthUI("ADD YOUR FIREBASE CONFIG FIRST.");
        return;
    }

    const email = String(authEmailInput?.value || "").trim();
    const password = String(authPasswordInput?.value || "");
    const typedNickname = String(authNameInput?.value || "").trim();
    const nickname = cleanLeaderboardName(typedNickname || getEmailPrefix(email));

    if (!email || !password) {
        updateAuthUI("EMAIL AND PASSWORD ARE REQUIRED.");
        return;
    }

    if (createAccount && !typedNickname) {
        updateAuthUI("NAME TAG REQUIRED FOR SIGN UP.");
        return;
    }

    try {
        updateAuthUI(createAccount ? "CREATING ACCOUNT..." : "LOGGING IN...");

        const result = createAccount
            ? await createUserWithEmailAndPassword(auth, email, password)
            : await signInWithEmailAndPassword(auth, email, password);

        if (result.user && nickname && (createAccount || isBadLeaderboardName(result.user.displayName))) {
            await updateProfile(result.user, { displayName: nickname });
        }

        firebaseUser = result.user;
        if (authNameInput && result.user.displayName) authNameInput.value = result.user.displayName;
        await repairMyLeaderboardName();
        updateAuthUI(createAccount ? "ACCOUNT CREATED. READY." : "LOGIN SUCCESS. READY.");
        await updateLeaderboardUI();
    } catch (error) {
        updateAuthUI(`AUTH ERROR: ${formatFirebaseError(error)}`);
    }
}

if (btnLogin) btnLogin.addEventListener("click", () => handleAuthLogin(false));
if (btnCreateAccount) btnCreateAccount.addEventListener("click", () => handleAuthLogin(true));
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        if (!auth) return;
        await signOut(auth);
        firebaseUser = null;
        updateAuthUI("LOGGED OUT.");
        await updateLeaderboardUI();
    });
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        firebaseUser = user || null;
        authReady = true;
        if (firebaseUser) await repairMyLeaderboardName();
        updateAuthUI();
        await updateLeaderboardUI();
    });
} else {
    authReady = true;
    updateAuthUI();
}

const endContainer = document.getElementById("endScreen") || document.createElement("div");
endContainer.id = "endScreen";
endContainer.style.display = "none";
endContainer.innerHTML = `
    <div class="end-panel result-panel">
        <span id="endResultBadge" class="result-badge">RESULT</span>
        <h1 id="endTitle">RESULT</h1>
        <p id="endSubtext" class="result-subtext">Run complete.</p>
        <div class="result-stats">
            <p id="endMode">Mode: ---</p>
            <p id="endScore">Final Score: 0</p>
        </div>
        <div class="result-actions">
            <button id="btnSubmitScore" type="button">SAVE SCORE</button>
            <button id="btnEndBackMenu" type="button">BACK TO MENU</button>
        </div>
        <p id="endSaveStatus" class="end-save-status">Save your score or return to menu.</p>
    </div>
`;
if (!endContainer.parentElement) document.body.appendChild(endContainer);

const defaultLeaderboards = {
    // No fake placeholder scores. Only real saved player scores should appear.
    arcade: [],
    boss: []
};

const VALID_LEADERBOARD_MODES = new Set(["arcade", "boss"]);
const INVALID_LEADERBOARD_NAMES = new Set([
    "",
    "SLAYER",
    "PLAYER",
    "UNKNOWN",
    "UNDEFINED",
    "NULL",
    "NONE",
    "N/A",
    "GUEST"
]);

const legacyPlaceholderScores = {
    arcade: new Set([
        "YORIICHI:150000",
        "RENGOKU:65000",
        "GIYUU:40000",
        "TANJIRO:25000",
        "ZENITSU:18000"
    ]),
    boss: new Set([
        "AKAZA:120000",
        "YORIICHI:90000",
        "GIYUU:70000",
        "SLAYER:50000",
        "TENGEN:35000"
    ])
};

function getSafeLeaderboardMode(mode) {
    return mode === "boss" ? "boss" : "arcade";
}

function getEmailPrefix(email = "") {
    const text = String(email || "").trim();
    if (!text) return "";
    return text.includes("@") ? text.split("@")[0] : text;
}

function normalizeNameSource(name = "") {
    const text = String(name || "").trim();
    if (!text) return "";
    return text.includes("@") ? getEmailPrefix(text) : text;
}

function cleanLeaderboardName(name, fallback = "") {
    const raw = normalizeNameSource(name) || normalizeNameSource(fallback);
    return String(raw || "")
        .trim()
        .replace(/[^\w !?'-]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 12)
        .toUpperCase();
}

function isBadLeaderboardName(name) {
    const cleaned = cleanLeaderboardName(name);
    return !cleaned || INVALID_LEADERBOARD_NAMES.has(cleaned);
}

function getBestPlayerName(preferredName = "") {
    const candidates = [
        preferredName,
        firebaseUser?.displayName,
        authNameInput?.value,
        getEmailPrefix(firebaseUser?.email)
    ];

    for (const candidate of candidates) {
        const cleaned = cleanLeaderboardName(candidate);
        if (!isBadLeaderboardName(cleaned)) return cleaned;
    }

    if (firebaseUser?.uid) {
        return `P${String(firebaseUser.uid).slice(0, 7).toUpperCase()}`;
    }

    return "LOCAL";
}

function isLegacyPlaceholderScore(mode, entry) {
    if (!entry) return false;
    const key = `${cleanLeaderboardName(entry.name || entry.displayName)}:${Math.max(0, Math.floor(Number(entry.score) || 0))}`;
    return legacyPlaceholderScores[mode]?.has(key) || false;
}

function isBadLeaderboardEntry(mode, entry) {
    if (!entry) return true;
    if (!Number.isFinite(Number(entry.score))) return true;
    if (isLegacyPlaceholderScore(mode, entry)) return true;
    return isBadLeaderboardName(entry.name || entry.displayName);
}

function filterLegacyPlaceholderScores(mode, entries = []) {
    return (entries || []).filter((entry) => !isBadLeaderboardEntry(mode, entry));
}

let currentMode = "arcade";
let gameplaySessionId = 0;
let resultScreenToken = 0;
let scoreSubmissionLocked = false;
let endScreenShown = false;
let localLeaderboard = loadLocalLeaderboards();

function normalizeLeaderboardData(data) {
    if (Array.isArray(data)) {
        return {
            arcade: filterLegacyPlaceholderScores("arcade", data),
            boss: []
        };
    }

    return {
        arcade: filterLegacyPlaceholderScores("arcade", Array.isArray(data?.arcade) ? data.arcade : []),
        boss: filterLegacyPlaceholderScores("boss", Array.isArray(data?.boss) ? data.boss : [])
    };
}

function loadLocalLeaderboards() {
    try {
        const saved = localStorage.getItem("slayer_leaderboards_v2") || localStorage.getItem("slayer_leaderboard");
        if (saved) {
            const cleaned = normalizeLeaderboardData(JSON.parse(saved));
            try { localStorage.setItem("slayer_leaderboards_v2", JSON.stringify(cleaned)); } catch (_) {}
            return cleaned;
        }
    } catch (e) {
        console.warn("Local storage disabled. Leaderboard won't save permanently.", e);
    }
    return normalizeLeaderboardData(defaultLeaderboards);
}

function saveLocalLeaderboards() {
    try {
        localStorage.setItem("slayer_leaderboards_v2", JSON.stringify(localLeaderboard));
    } catch (e) {
        console.warn("Could not save leaderboard locally.", e);
    }
}

const PLAYER_SCORE_SNAPSHOT_KEY = "slayer_player_score_snapshot_v1";

function getPlayerScoreSnapshotKey() {
    if (firebaseUser?.uid) return `uid:${firebaseUser.uid}`;
    const emailKey = getEmailPrefix(firebaseUser?.email);
    if (emailKey) return `email:${cleanLeaderboardName(emailKey)}`;
    return "local";
}

function loadPlayerScoreSnapshots() {
    try {
        const raw = localStorage.getItem(PLAYER_SCORE_SNAPSHOT_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
        return {};
    }
}

function savePlayerScoreSnapshots(data) {
    try {
        localStorage.setItem(PLAYER_SCORE_SNAPSHOT_KEY, JSON.stringify(data || {}));
    } catch (_) {}
}

function ensurePlayerScoreSnapshot(mode) {
    const safeMode = getSafeLeaderboardMode(mode);
    const data = loadPlayerScoreSnapshots();
    const playerKey = getPlayerScoreSnapshotKey();

    if (!data[playerKey]) data[playerKey] = {};
    if (!data[playerKey][safeMode]) {
        data[playerKey][safeMode] = {
            current: 0,
            highest: 0,
            updatedAt: Date.now()
        };
    }

    return { data, playerKey, safeMode, record: data[playerKey][safeMode] };
}

function recordPlayerCurrentScore(mode, finalScore, options = {}) {
    const { updateHighest = false } = options;
    const cleanScore = Math.max(0, Math.floor(Number(finalScore) || 0));
    const { data, safeMode, record } = ensurePlayerScoreSnapshot(mode);

    record.current = cleanScore;
    if (updateHighest) record.highest = Math.max(Math.max(0, Math.floor(Number(record.highest) || 0)), cleanScore);
    record.updatedAt = Date.now();

    savePlayerScoreSnapshots(data);
    updatePlayerScoreSummaryUI();
}

function getLocalPlayerScoreSnapshot(mode) {
    const safeMode = getSafeLeaderboardMode(mode);
    const data = loadPlayerScoreSnapshots();
    const playerKey = getPlayerScoreSnapshotKey();
    const record = data?.[playerKey]?.[safeMode] || {};
    return {
        current: Math.max(0, Math.floor(Number(record.current) || 0)),
        highest: Math.max(0, Math.floor(Number(record.highest) || 0))
    };
}

async function fetchMyFirebaseHighScore(mode) {
    const safeMode = getSafeLeaderboardMode(mode);
    if (!firebaseReady || !db || !firebaseUser) return null;

    try {
        const scoreSnap = await getDoc(doc(db, "leaderboards", safeMode, "scores", firebaseUser.uid));
        if (!scoreSnap.exists()) return 0;
        return Math.max(0, Math.floor(Number(scoreSnap.data()?.score) || 0));
    } catch (error) {
        console.warn(`Could not read personal ${safeMode} high score from Firebase.`, error);
        return null;
    }
}

function setScoreSummaryText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();
}

async function updatePlayerScoreSummaryUI() {
    const [bossFirebaseHigh, arcadeFirebaseHigh] = await Promise.all([
        fetchMyFirebaseHighScore("boss"),
        fetchMyFirebaseHighScore("arcade")
    ]);

    const bossLocal = getLocalPlayerScoreSnapshot("boss");
    const arcadeLocal = getLocalPlayerScoreSnapshot("arcade");

    const bossHighest = bossFirebaseHigh !== null ? bossFirebaseHigh : bossLocal.highest;
    const arcadeHighest = arcadeFirebaseHigh !== null ? arcadeFirebaseHigh : arcadeLocal.highest;

    setScoreSummaryText("bossCurrentScore", bossLocal.current);
    setScoreSummaryText("bossHighestScore", bossHighest);
    setScoreSummaryText("arcadeCurrentScore", arcadeLocal.current);
    setScoreSummaryText("arcadeHighestScore", arcadeHighest);
}

function getLeaderboardEntryKey(entry) {
    const uid = String(entry?.uid || entry?.playerKey || "").trim();
    if (uid && !uid.startsWith("name:")) return `uid:${uid}`;
    return `name:${cleanLeaderboardName(entry?.name || entry?.displayName)}`;
}

function normalizeLeaderboardEntry(mode, entry) {
    if (!entry || !Number.isFinite(Number(entry.score))) return null;
    if (isLegacyPlaceholderScore(mode, entry)) return null;

    const cleanScore = Math.max(0, Math.floor(Number(entry.score) || 0));
    const rawUid = String(entry.uid || entry.playerKey || "").trim();
    const uid = rawUid && !rawUid.startsWith("name:") ? rawUid : "";

    let cleanName = cleanLeaderboardName(entry.name || entry.displayName || entry.email);
    if (isBadLeaderboardName(cleanName) && uid && firebaseUser?.uid === uid) {
        cleanName = getBestPlayerName("");
    }

    if (isBadLeaderboardName(cleanName)) return null;

    return {
        name: cleanName,
        score: cleanScore,
        uid: uid || null,
        playerKey: uid || cleanName
    };
}

function mergeLeaderboardEntries(mode, ...entryLists) {
    const bestByUidOrName = new Map();

    entryLists.flat().forEach((rawEntry) => {
        const entry = normalizeLeaderboardEntry(mode, rawEntry);
        if (!entry) return;

        const key = getLeaderboardEntryKey(entry);
        const old = bestByUidOrName.get(key);
        if (!old || entry.score > old.score) bestByUidOrName.set(key, entry);
    });

    // Second pass collapses old random Firestore docs that have the same name but missing/old UID fields.
    // This keeps the visible leaderboard logical: one visible high score per player name.
    const bestByVisibleName = new Map();
    [...bestByUidOrName.values()].forEach((entry) => {
        const nameKey = cleanLeaderboardName(entry.name);
        const old = bestByVisibleName.get(nameKey);
        if (!old || entry.score > old.score) bestByVisibleName.set(nameKey, entry);
    });

    return [...bestByVisibleName.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

function sortAndTrimLeaderboard(mode) {
    localLeaderboard[mode] = mergeLeaderboardEntries(mode, localLeaderboard[mode] || []);
}

async function ensureLeaderboardParentDocs() {
    if (!firebaseReady || !db || !firebaseUser) return;
    try {
        await Promise.all(["arcade", "boss"].map((mode) => (
            setDoc(doc(db, "leaderboards", mode), {
                mode,
                updatedAt: serverTimestamp()
            }, { merge: true })
        )));
    } catch (error) {
        // This is cosmetic only. Scores still work even if the parent document is missing in the console.
        console.warn("Could not create leaderboard parent docs. This does not block scores.", error);
    }
}

async function repairMyLeaderboardName() {
    if (!firebaseReady || !db || !firebaseUser) return;

    const goodName = getBestPlayerName("");
    if (isBadLeaderboardName(goodName)) return;

    try {
        await ensureLeaderboardParentDocs();

        for (const mode of ["arcade", "boss"]) {
            const scoreRef = doc(db, "leaderboards", mode, "scores", firebaseUser.uid);
            const scoreSnap = await getDoc(scoreRef);
            if (!scoreSnap.exists()) continue;

            const data = scoreSnap.data();
            const oldName = cleanLeaderboardName(data.name || data.displayName);
            const currentScore = Math.max(0, Math.floor(Number(data.score) || 0));

            if (isBadLeaderboardName(oldName) || data.uid !== firebaseUser.uid || data.mode !== mode) {
                await setDoc(scoreRef, {
                    name: goodName,
                    displayName: goodName,
                    score: currentScore,
                    mode,
                    uid: firebaseUser.uid,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        }
    } catch (error) {
        console.warn("Could not repair your leaderboard name yet.", error);
    }
}

async function fetchFirebaseLeaderboard(mode) {
    const safeMode = getSafeLeaderboardMode(mode);
    if (!firebaseReady || !db) return null;

    try {
        const scoresQuery = query(
            collection(db, "leaderboards", safeMode, "scores"),
            orderBy("score", "desc"),
            limit(100)
        );

        const snapshot = await getDocs(scoresQuery);
        const entries = snapshot.docs.map((scoreDoc) => {
            const data = scoreDoc.data();
            const uid = String(data.uid || scoreDoc.id || "").trim();
            const name = data.name || data.displayName || "";

            return {
                name,
                displayName: data.displayName || name,
                score: Math.max(0, Math.floor(Number(data.score) || 0)),
                uid,
                playerKey: uid || scoreDoc.id
            };
        });

        return mergeLeaderboardEntries(safeMode, entries);
    } catch (error) {
        console.warn(`Could not read ${safeMode} leaderboard from Firebase. Using local data.`, error);
        return null;
    }
}

function saveLocalHighScore(safeMode, entry) {
    if (!localLeaderboard[safeMode]) localLeaderboard[safeMode] = [];

    const cleanEntry = normalizeLeaderboardEntry(safeMode, entry);
    if (!cleanEntry) return false;

    const entryKey = getLeaderboardEntryKey(cleanEntry);
    const existing = localLeaderboard[safeMode].find((old) => getLeaderboardEntryKey(old) === entryKey);
    const oldScore = existing ? Math.max(0, Math.floor(Number(existing.score) || 0)) : -1;

    if (!existing || cleanEntry.score > oldScore) {
        if (existing) {
            existing.name = cleanEntry.name;
            existing.score = cleanEntry.score;
            existing.uid = cleanEntry.uid || existing.uid || null;
            existing.playerKey = cleanEntry.playerKey || existing.playerKey || cleanEntry.name;
        } else {
            localLeaderboard[safeMode].push({ ...cleanEntry });
        }

        sortAndTrimLeaderboard(safeMode);
        saveLocalLeaderboards();
        return true;
    }

    sortAndTrimLeaderboard(safeMode);
    saveLocalLeaderboards();
    return false;
}

async function submitLeaderboardScore(mode, playerName, finalScore) {
    const safeMode = getSafeLeaderboardMode(mode);
    const uid = firebaseUser?.uid || null;
    const entry = {
        name: getBestPlayerName(playerName),
        score: Math.max(0, Math.floor(Number(finalScore) || 0)),
        uid,
        playerKey: uid || getBestPlayerName(playerName)
    };

    recordPlayerCurrentScore(safeMode, entry.score, { updateHighest: false });

    if (isBadLeaderboardName(entry.name)) {
        return {
            entry,
            localImproved: false,
            firebaseImproved: false,
            firebaseStatus: "bad_name",
            improved: false,
            previousHighScore: 0,
            savedHighScore: 0
        };
    }

    const localBefore = getLocalPlayerScoreSnapshot(safeMode).highest;
    const localImproved = saveLocalHighScore(safeMode, entry);
    if (localImproved) recordPlayerCurrentScore(safeMode, entry.score, { updateHighest: true });

    let firebaseStatus = firebaseReady && db && firebaseUser ? "not_improved" : "offline";
    let firebaseImproved = false;
    let previousHighScore = localBefore;
    let savedHighScore = Math.max(localBefore, entry.score);

    if (firebaseReady && db && firebaseUser) {
        try {
            await ensureLeaderboardParentDocs();

            const scoreRef = doc(db, "leaderboards", safeMode, "scores", firebaseUser.uid);

            const transactionResult = await runTransaction(db, async (transaction) => {
                const existingSnap = await transaction.get(scoreRef);
                const existingScore = existingSnap.exists()
                    ? Math.max(0, Math.floor(Number(existingSnap.data().score) || 0))
                    : -1;

                const oldName = existingSnap.exists()
                    ? cleanLeaderboardName(existingSnap.data().name || existingSnap.data().displayName)
                    : "";

                const shouldUpdateScore = entry.score > existingScore;
                const shouldRepairName = isBadLeaderboardName(oldName) || oldName !== entry.name;

                if (!shouldUpdateScore && !shouldRepairName) {
                    return {
                        improved: false,
                        previousHighScore: Math.max(0, existingScore),
                        savedHighScore: Math.max(0, existingScore)
                    };
                }

                const scoreData = {
                    name: entry.name,
                    score: shouldUpdateScore ? entry.score : existingScore,
                    mode: safeMode,
                    uid: firebaseUser.uid,
                    displayName: entry.name,
                    updatedAt: serverTimestamp()
                };

                if (!existingSnap.exists()) scoreData.createdAt = serverTimestamp();
                transaction.set(scoreRef, scoreData, { merge: true });

                return {
                    improved: shouldUpdateScore,
                    previousHighScore: Math.max(0, existingScore),
                    savedHighScore: Math.max(0, shouldUpdateScore ? entry.score : existingScore)
                };
            });

            firebaseImproved = Boolean(transactionResult.improved);
            previousHighScore = transactionResult.previousHighScore;
            savedHighScore = transactionResult.savedHighScore;
            firebaseStatus = firebaseImproved ? "saved" : "not_improved";

            if (firebaseImproved) {
                recordPlayerCurrentScore(safeMode, entry.score, { updateHighest: true });
            }
        } catch (error) {
            firebaseStatus = "failed";
            console.warn("Firebase score submit failed. Your high score was saved locally instead.", error);
        }
    }

    // Firebase is the official source when logged in. Local backup should not lie and say
    // "new high score" if Firebase says the old score is still higher.
    const improved = firebaseReady && db && firebaseUser
        ? firebaseImproved
        : localImproved;

    return {
        entry,
        localImproved,
        firebaseImproved,
        firebaseStatus,
        improved,
        previousHighScore,
        savedHighScore
    };
}

function renderLeaderboardList(listId, entries) {
    const list = document.getElementById(listId);
    if (!list) return;

    const safeEntries = (entries || [])
        .map((entry) => normalizeLeaderboardEntry(listId.includes("boss") ? "boss" : "arcade", entry))
        .filter(Boolean)
        .slice(0, 10);

    if (safeEntries.length === 0) {
        list.innerHTML = `<li><span>NO SCORES YET</span><b>---</b></li>`;
        return;
    }

    list.innerHTML = safeEntries.map((entry) => `
        <li>
            <span>${entry.name}</span>
            <b>${Math.max(0, Math.floor(Number(entry.score))).toLocaleString()}</b>
        </li>
    `).join("");
}

async function updateLeaderboardUI() {
    sortAndTrimLeaderboard("arcade");
    sortAndTrimLeaderboard("boss");

    const [firebaseArcade, firebaseBoss] = await Promise.all([
        fetchFirebaseLeaderboard("arcade"),
        fetchFirebaseLeaderboard("boss")
    ]);

    // If Firebase reads successfully, Firebase is the source of truth.
    // Local backup is only shown when Firebase cannot be read.
    const arcadeEntries = firebaseArcade !== null ? firebaseArcade : mergeLeaderboardEntries("arcade", localLeaderboard.arcade || []);
    const bossEntries = firebaseBoss !== null ? firebaseBoss : mergeLeaderboardEntries("boss", localLeaderboard.boss || []);

    renderLeaderboardList("arcadeLeaderboardList", arcadeEntries);
    renderLeaderboardList("bossLeaderboardList", bossEntries);
    await updatePlayerScoreSummaryUI();

    // Backward compatibility for older HTML that still has one <ul id="lbList">.
    renderLeaderboardList("lbList", arcadeEntries);

    const status = document.getElementById("leaderboardSyncStatus");
    if (status) {
        if (firebaseReady) status.textContent = "Firebase leaderboard sync active.";
        else status.textContent = "Local scores active until Firebase config is added.";
    }
}

// Dev-only local test: run seedTestLeaderboardScores("arcade", 35) in the browser console.
// It proves 20-30+ entries won't break the leaderboard because it still displays only the top 10.
window.seedTestLeaderboardScores = async function(mode = "arcade", count = 35) {
    const safeMode = getSafeLeaderboardMode(mode);
    if (!localLeaderboard[safeMode]) localLeaderboard[safeMode] = [];

    for (let i = 0; i < count; i++) {
        localLeaderboard[safeMode].push({
            name: `TEST${String(i + 1).padStart(2, "0")}`,
            score: Math.floor(Math.random() * 250000),
            uid: `test-${safeMode}-${i + 1}`
        });
    }

    sortAndTrimLeaderboard(safeMode);
    saveLocalLeaderboards();
    await updateLeaderboardUI();
    console.log(`${safeMode.toUpperCase()} leaderboard tested with ${count} fake local scores. Showing top 10 only.`);
};

window.clearLocalLeaderboardBackup = async function() {
    localLeaderboard = normalizeLeaderboardData(defaultLeaderboards);
    try {
        localStorage.removeItem("slayer_leaderboard");
        localStorage.removeItem(PLAYER_SCORE_SNAPSHOT_KEY);
        localStorage.setItem("slayer_leaderboards_v2", JSON.stringify(localLeaderboard));
    } catch (_) {}
    await updateLeaderboardUI();
    console.log("Local leaderboard backup cleared. Firebase scores are untouched.");
};

window.repairMyLeaderboardName = repairMyLeaderboardName;

function getLoggedInScoreName() {
    return getBestPlayerName("");
}

function getResultScoreName() {
    return getBestPlayerName("");
}

function prefillResultName() {
    // Privacy fix: result screen never shows the player nametag.
    const nameInput = document.getElementById("playerName");
    if (nameInput) nameInput.style.display = "none";

    const lockedNameLabel = document.getElementById("lockedPlayerName");
    if (lockedNameLabel) lockedNameLabel.remove();
}


function hideResultScreenHard() {
    resultScreenToken++;

    const endScreen = document.getElementById("endScreen");
    if (endScreen) {
        endScreen.style.display = "none";
        endScreen.style.pointerEvents = "none";
        endScreen.classList.remove("active");
    }

    const submitButton = document.getElementById("btnSubmitScore");
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "SAVE SCORE";
    }

    const saveStatus = document.getElementById("endSaveStatus");
    if (saveStatus) saveStatus.textContent = "Save your score or return to menu.";
}

function resetCanvasContextState() {
    try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = "none";
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.lineWidth = 1;
    } catch (_) {}
}

function clearGameplayCanvas() {
    try {
        resetCanvasContextState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (_) {}
}

function forceShowMenu() {
    if (!menuContainer) return;
    menuContainer.style.display = "flex";
    menuContainer.style.opacity = "";
    menuContainer.style.pointerEvents = "auto";
    menuContainer.classList.remove("menu-launching");
    requestAnimationFrame(() => menuContainer.classList.add("menu-active"));
}

function forceHideMenuForGameplay() {
    if (!menuContainer) return;
    menuContainer.classList.remove("menu-active", "menu-launching");
    menuContainer.style.opacity = "";
    menuContainer.style.pointerEvents = "none";
    menuContainer.style.display = "none";
}

function resetRoundFlagsForFreshStart() {
    resultScreenToken++;
    gameOver = false;
    gameWon = false;
    endSequenceTimer = 0;
    endScreenShown = false;
    scoreSubmissionLocked = false;
    pauseScoreSubmissionLocked = false;
    endMusicStopped = false;
    timeScale = 1;
    globalDt = 1;
    lastTime = performance.now();

    score = 0;
    combo = 0;
    comboTimer = 0;
    spawnTimer = 0;
    damageFlashTimer = 0;
    impactFrameTimer = 0;
    lightImpactFrameTimer = 0;
    shakeTimer = 0;
    shakeStrength = 0;
    screenShakeX = 0;
    screenShakeY = 0;
    cameraX = 0;

    const pauseOverlay = document.getElementById("pauseOverlay");
    if (pauseOverlay) pauseOverlay.classList.remove("open");

    hideResultScreenHard();
    stopAllGameplayAudio();
    resetInputState();
}

async function returnToMenuAfterRun() {
    // Hard reset everything that can freeze a new run.
    // This prevents the death/victory frame, paused sounds, timers, and result overlays from carrying into another mode.
    gameplaySessionId++;
    resetRoundFlagsForFreshStart();
    resetRunVisualAndCutsceneState();

    gameOver = false;
    gameWon = false;
    endSequenceTimer = 0;
    endScreenShown = false;
    scoreSubmissionLocked = false;
    pauseScoreSubmissionLocked = false;
    endMusicStopped = false;
    timeScale = 1;

    clearGameplayCanvas();
    gameState = "menu";

    hideResultScreenHard();

    forceShowMenu();
    await updateLeaderboardUI();

    if (bgmMenuTheme) {
        bgmMenuTheme.currentTime = 0;
        startMenuMusic();
    }
}

const submitScoreButton = document.getElementById("btnSubmitScore");
if (submitScoreButton) {
    submitScoreButton.onclick = async () => {
        if (scoreSubmissionLocked) return;
        scoreSubmissionLocked = true;
        submitScoreButton.disabled = true;
        submitScoreButton.textContent = "SAVING...";

        const status = document.getElementById("endSaveStatus");
        if (status) status.textContent = "Saving score...";

        const name = getResultScoreName();

        const saveResult = await submitLeaderboardScore(currentMode, name, score);
        await updateLeaderboardUI();

        submitScoreButton.textContent = "SAVED!";
        if (status) {
            if (saveResult.firebaseStatus === "failed") status.textContent = "Firebase failed. Local backup saved if this was higher.";
            else if (saveResult.firebaseStatus === "bad_name") status.textContent = "Score not saved. Your account name is invalid.";
            else if (saveResult.improved) status.textContent = "New high score saved. Returning to menu...";
            else status.textContent = "Your saved high score is still higher. Returning to menu...";
        }
        setTimeout(() => returnToMenuAfterRun(), 900);
    };
}

const btnEndBackMenu = document.getElementById("btnEndBackMenu");
if (btnEndBackMenu) {
    btnEndBackMenu.onclick = () => returnToMenuAfterRun();
}


// =====================================================
// SIMPLE PAUSE / LEAVE SYSTEM
// =====================================================
let pauseScoreSubmissionLocked = false;
let pausePausedAudios = [];

function injectPauseRuntimeStyles() {
    if (document.getElementById("pauseRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "pauseRuntimeStyles";
    style.textContent = `
        #pauseOverlay {
            position: fixed;
            inset: 0;
            z-index: 12000;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.72);
            backdrop-filter: blur(8px);
            font-family: 'Press Start 2P', 'Courier New', monospace;
            color: white;
        }
        #pauseOverlay.open { display: flex; }
        .pause-panel {
            width: min(620px, 92vw);
            padding: 26px;
            text-align: center;
            border: 3px solid rgba(251, 191, 36, 0.82);
            background: rgba(2, 6, 23, 0.94);
            box-shadow: 0 0 38px rgba(251, 191, 36, 0.24), 0 24px 60px rgba(0,0,0,0.65);
        }
        .pause-panel h2 {
            color: #fbbf24;
            font-size: clamp(1rem, 3vw, 2rem);
            margin-bottom: 14px;
            text-shadow: 0 0 16px rgba(251, 191, 36, 0.55);
        }
        .pause-panel p {
            color: #cbd5e1;
            font-size: clamp(0.55rem, 1.4vw, 0.8rem);
            line-height: 1.8;
            margin-bottom: 18px;
        }
        .pause-buttons {
            display: grid;
            gap: 10px;
        }
        .pause-buttons button {
            padding: 14px 16px;
            border: 2px solid rgba(226, 232, 240, 0.65);
            background: #0f172a;
            color: white;
            font-family: 'Press Start 2P', 'Courier New', monospace;
            font-size: clamp(0.52rem, 1.35vw, 0.76rem);
            cursor: pointer;
        }
        .pause-buttons button:hover,
        .pause-buttons button:focus-visible {
            outline: none;
            border-color: #38bdf8;
            box-shadow: 0 0 18px rgba(56, 189, 248, 0.35);
        }
        #btnPauseSaveLeave { border-color: #22c55e; }
        #btnPauseNoSaveLeave { border-color: #fb7185; }
    `;
    document.head.appendChild(style);
}

function ensurePauseOverlay() {
    if (document.getElementById("pauseOverlay")) return;
    injectPauseRuntimeStyles();

    const overlay = document.createElement("div");
    overlay.id = "pauseOverlay";
    overlay.innerHTML = `
        <div class="pause-panel">
            <h2>PAUSED</h2>
            <p>Resume, save your current score and leave, or leave without saving.</p>
            <div class="pause-buttons">
                <button id="btnPauseResume" type="button">RESUME</button>
                <button id="btnPauseSaveLeave" type="button">SAVE SCORE & LEAVE</button>
                <button id="btnPauseNoSaveLeave" type="button">LEAVE WITHOUT SAVING</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btnPauseResume")?.addEventListener("click", resumeGameFromPause);
    document.getElementById("btnPauseSaveLeave")?.addEventListener("click", () => leaveCurrentRun(true));
    document.getElementById("btnPauseNoSaveLeave")?.addEventListener("click", () => leaveCurrentRun(false));
}

function pauseGameplayAudio() {
    pausePausedAudios = [];

    getPersistentGameplayAudios().forEach((audioFile) => {
        if (audioFile && !audioFile.paused) {
            pausePausedAudios.push(audioFile);
            audioFile.pause();
        }
    });

    activeSoundClones.forEach((audioFile) => {
        if (audioFile && !audioFile.paused) {
            pausePausedAudios.push(audioFile);
            audioFile.pause();
        }
    });
}

function resumeGameplayAudio() {
    if (gameState !== "playing" || gameOver || gameWon) {
        pausePausedAudios = [];
        return;
    }

    pausePausedAudios.forEach((audioFile) => {
        if (audioFile) audioFile.play().catch(() => {});
    });
    pausePausedAudios = [];
}

function resetInputState() {
    keys.Left = false;
    keys.Right = false;
    keys.G = false;
    keys.W = false;
    keys.Space = false;
    player.isGuarding = false;
    player.guardFrame = 0;
    player.formParryLock = 0;
}

function resetFormCooldowns() {
    if (typeof formCooldowns === "undefined") return;
    for (const key in formCooldowns) formCooldowns[key] = 0;
}

function cancelPlayerActionState(options = {}) {
    const { resetCooldowns = false, clearTrails = false } = options;

    resetInputState();
    player.isAttacking = false;
    player.attackFrame = 0;
    player.currentForm = 0;
    player.selectedForm = 0;
    player.m1AlreadyHit = false;
    player.sunSecondHitReset = false;
    player.sunImpactLock = false;
    player.isDashing = false;
    player.dashTimer = 0;
    player.isStunned = false;
    player.stunTimer = 0;
    player.invincibleTimer = 0;
    player.bodyRotation = 0;
    player.attackBox = { x: 0, y: 0, width: 90, height: 60 };
    if (player.hitTargets && typeof player.hitTargets.clear === "function") player.hitTargets.clear();

    if (player.y > player.baseY || Math.abs(player.y - player.baseY) < 6) {
        player.y = player.baseY;
        player.vy = 0;
        player.isGrounded = true;
    }

    if (resetCooldowns) resetFormCooldowns();
    if (clearTrails) {
        if (typeof waterTrails !== "undefined") waterTrails.length = 0;
        if (typeof foamParticles !== "undefined") foamParticles.length = 0;
        if (typeof clashSparks !== "undefined") clashSparks.length = 0;
        if (typeof parrySlashes !== "undefined") parrySlashes.length = 0;
    }
}

function resetRunVisualAndCutsceneState() {
    stopBreathingSoundAfterCurrentFile();
    cancelPlayerActionState({ resetCooldowns: true, clearTrails: true });

    demons.length = 0;
    projectiles.length = 0;
    healthDrops.length = 0;
    shockwaves.length = 0;
    afterglowFistStreaks.length = 0;
    clashSparks.length = 0;
    parrySlashes.length = 0;
    afterglowFistStreaks.length = 0;
    waterTrails.length = 0;
    foamParticles.length = 0;
    jumpBursts.length = 0;
    healTexts.length = 0;
    bossSmoke.length = 0;

    akaza = null;
    akazaIntro = {
        active: false,
        done: false,
        timer: 0,
        phase: 0,
        letterbox: 0,
        smoke: [],
        shockRings: [],
        smokeAlpha: 1,
        landed: false,
        standingProgress: 0,
        cameraFocusX: 0,
        zoomTarget: 1,
        currentZoom: 1,
        dialogue: null,
        compassRadius: 0,
        compassRedAlpha: 0,
        compassBlueAlpha: 0,
        playedReveal: false
    };

    enemyRevealPopup.active = false;
    enemyRevealPopup.timer = 0;
    enemyRevealPopup.title = "";
    enemyRevealPopup.description = "";
    enemyRevealPopup.tip = "";
    enemyRevealPopup.hp = "";
    enemyRevealPopup.alert = "";
    enemyRevealPopup.hpCapText = "";

    timeScale = 1;
    impactFrameTimer = 0;
    lightImpactFrameTimer = 0;
    damageFlashTimer = 0;
    shakeTimer = 0;
    shakeStrength = 0;
    screenShakeX = 0;
    screenShakeY = 0;
    cameraX = 0;
    timeScale = 1;
    endMusicStopped = false;
}

function pauseGame() {
    if (gameState !== "playing" || gameOver || gameWon) return;
    ensurePauseOverlay();
    gameState = "paused";
    resetInputState();
    stopBreathingSoundAfterCurrentFile();
    pauseGameplayAudio();
    document.getElementById("pauseOverlay")?.classList.add("open");
}

function resumeGameFromPause() {
    if (gameState !== "paused") return;
    document.getElementById("pauseOverlay")?.classList.remove("open");
    gameState = "playing";
    lastTime = performance.now();
    resumeGameplayAudio();
}

function getNameForPauseSave() {
    // Save internally without asking/displaying the player's nametag.
    return getBestPlayerName("");
}

async function leaveCurrentRun(saveScore) {
    if (pauseScoreSubmissionLocked) return;
    pauseScoreSubmissionLocked = true;

    const saveButton = document.getElementById("btnPauseSaveLeave");
    const noSaveButton = document.getElementById("btnPauseNoSaveLeave");
    const resumeButton = document.getElementById("btnPauseResume");
    if (saveButton) saveButton.disabled = true;
    if (noSaveButton) noSaveButton.disabled = true;
    if (resumeButton) resumeButton.disabled = true;

    recordPlayerCurrentScore(currentMode, score, { updateHighest: false });

    if (saveScore) {
        if (saveButton) saveButton.textContent = "SAVING...";
        await submitLeaderboardScore(currentMode, getNameForPauseSave(), score);
        await updateLeaderboardUI();
    }

    gameplaySessionId++;
    resetRoundFlagsForFreshStart();
    resetRunVisualAndCutsceneState();

    gameOver = false;
    gameWon = false;
    endSequenceTimer = 0;
    endScreenShown = false;
    scoreSubmissionLocked = false;
    pauseScoreSubmissionLocked = false;
    gameState = "menu";
    timeScale = 1;

    hideResultScreenHard();
    clearGameplayCanvas();

    const pauseOverlay = document.getElementById("pauseOverlay");
    if (pauseOverlay) pauseOverlay.classList.remove("open");

    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "SAVE SCORE & LEAVE";
    }
    if (noSaveButton) noSaveButton.disabled = false;
    if (resumeButton) resumeButton.disabled = false;

    forceShowMenu();
    await updateLeaderboardUI();

    // Restart menu music after leaving a paused run.
    // Important: gameState is already "menu", so startMenuMusic() will not block itself.
    if (bgmMenuTheme) {
        bgmMenuTheme.currentTime = 0;
        startMenuMusic();
    }
}

window.addEventListener("keydown", (event) => {
    if ((event.code === "Escape" || event.code === "KeyP") && gameState === "playing") {
        event.preventDefault();
        pauseGame();
    } else if ((event.code === "Escape" || event.code === "KeyP") && gameState === "paused") {
        event.preventDefault();
        resumeGameFromPause();
    }
});

ensurePauseOverlay();

// =====================================================
// START SCREENS & SYSTEM STATES
// =====================================================
const PIXEL_FONT = "'Courier New', monospace";
let gameState = "splash";
let BOSS_TEST_MODE = false; 

const splashEl = document.getElementById("splashScreen");

function startGameFromSplash() {
    if (gameState !== "splash") return;
    startMenuMusic();
    gameState = "menu";

    if (splashEl) {
        splashEl.classList.add("fade-out");
        setTimeout(() => { 
            splashEl.style.display = "none"; 
            menuContainer.style.display = "flex";
            requestAnimationFrame(() => menuContainer.classList.add("menu-active"));
            updateLeaderboardUI();
        }, 900);
    } else {
        menuContainer.style.display = "flex";
        requestAnimationFrame(() => menuContainer.classList.add("menu-active"));
        updateLeaderboardUI();
    }
}
if (splashEl) splashEl.addEventListener("click", startGameFromSplash);

function startGameplay(mode) {
    // Fresh session every time. This is the important anti-freeze reset.
    gameplaySessionId++;
    const startSessionId = gameplaySessionId;

    resetRoundFlagsForFreshStart();
    resetRunVisualAndCutsceneState();
    clearGameplayCanvas();

    currentMode = mode === "boss" ? "boss" : "arcade";
    BOSS_TEST_MODE = (currentMode === "boss");
    closeControlsPanel();
    stopMenuMusic();
    stopAllGameplayAudio();

    gameState = "playing";
    timeScale = 1;
    globalDt = 1;
    lastTime = performance.now();
    endMusicStopped = false;

    // Hide the menu immediately. The old delayed fade could leave an invisible
    // full-screen menu over the canvas after a death/victory restart, which made
    // the new run look like a black screen.
    forceHideMenuForGameplay();

    score = 0;
    combo = 0;
    comboTimer = 0;
    spawnTimer = 0;
    endSequenceTimer = 0;
    damageFlashTimer = 0;
    gameOver = false;
    gameWon = false;
    endScreenShown = false;
    scoreSubmissionLocked = false;
    pauseScoreSubmissionLocked = false;

    hideResultScreenHard();

    const submitButton = document.getElementById("btnSubmitScore");
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "SAVE SCORE";
    }

    const saveStatus = document.getElementById("endSaveStatus");
    if (saveStatus) saveStatus.textContent = "Save your score or return to menu.";

    player.maxHealth = BOSS_TEST_MODE ? 485 : 100;
    player.health = player.maxHealth;
    player.breathing = 60;
    player.x = 400;
    player.y = player.baseY;
    player.vy = 0;
    player.isGrounded = true;
    player.invincibleTimer = 0;
    player.isGuarding = false;
    player.isDashing = false;
    player.isAttacking = false;
    player.currentForm = 0;
    player.selectedForm = 0;
    player.hitTargets.clear();

    enemyMilestones.forEach(m => m.revealed = false);

    if (bgmBossTheme) bgmBossTheme.volume = 0.6;
    if (bgmTechniqueDeployment) bgmTechniqueDeployment.volume = 0.8;
    // Battle music is disabled for now. Menu music only before gameplay; boss music still starts during Akaza.

    if (BOSS_TEST_MODE) {
        // Boss mode skips straight to Akaza, but score starts at 0 so it is fair.
        score = 0;
        startAkazaIntro();
    }
}

// =====================================================
// AUDIO SETUP
// =====================================================
const m1Sounds = [new Audio("audio/combo1.mp3"), new Audio("audio/combo2.mp3"), new Audio("audio/combo3.mp3"), new Audio("audio/combo4.mp3")];
const formSounds = { 1: new Audio("audio/form1.mp3"), 2: new Audio("audio/form2.mp3"), 3: new Audio("audio/form3.mp3"), 4: new Audio("audio/form4.mp3") };
const sfxJump = new Audio("audio/jump.mp3");
const sfxDash = new Audio("audio/dash.mp3");
const sfxParryClang = new Audio("audio/parry_clang.mp3");
const sfxPerfectParry = new Audio("audio/perfect_parry.mp3");
const sfxGuardDamage = new Audio("audio/guard_damage.mp3");
const sfxPlayerHurt = new Audio("audio/player_hurt.mp3");
const sfxClash = new Audio("audio/clash.mp3");
const sfxDemonHit = new Audio("audio/demon_hit.mp3");
const sfxProjectileShoot = new Audio("audio/projectile_shoot.mp3");
const sfxProjectileHit = new Audio("audio/projectile_hit.mp3");
const sfxGruntAttack = new Audio("audio/enemy_attack.mp3");
const sfxSwiftDash = new Audio("audio/swift_dash.mp3");
const sfxSwiftAttack = new Audio("audio/swift_attack.mp3");
const sfxBruteWindup = new Audio("audio/brute_windup.mp3");
const sfxBruteSlam = new Audio("audio/brute_slam.mp3");
const sfxReveal = new Audio("audio/enemy_reveal.mp3");
const sfxAkazaLanding = new Audio("audio/akaza_landing.mp3");
const sfxAkazaVoice = new Audio("audio/akaza_intro.mp3");
const sfxTotalConcentration = new Audio("audio/ability_call_5.mp3"); sfxTotalConcentration.volume = 1;
const sfxSunDance = new Audio("audio/sun_dance.mp3"); sfxSunDance.volume = 0.9;
const sfxAirType = new Audio("audio/air_type.mp3");
const sfxLegType = new Audio("audio/leg_type.mp3");
const sfxDisorder = new Audio("audio/disorder.mp3");
const sfxRush = new Audio("audio/rush.mp3");
const sfxEightLayered = new Audio("audio/eight_layered.mp3");
const sfxAnnihilation = new Audio("audio/annihilation.mp3");
const sfxCrownSplitter = new Audio("audio/crown_splitter.mp3");
const sfxChaoticAfterglow = new Audio("audio/chaotic_afterglow.mp3");
const sfxBigLeap = new Audio("audio/big_leap.mp3");

sfxTotalConcentration.volume = 0.8;
const bgmMenuTheme = new Audio("audio/menu_theme.mp3"); bgmMenuTheme.loop = true; bgmMenuTheme.volume = 0.45;
const bgmBattleTheme = null; // Battle music removed for now. Keep menu music + boss/technique music only.
const bgmTechniqueDeployment = new Audio("audio/technique_deployment.mp3"); bgmTechniqueDeployment.loop = false; bgmTechniqueDeployment.volume = 0.8;
const bgmBossTheme = new Audio("audio/boss_theme.mp3"); bgmBossTheme.loop = true; bgmBossTheme.volume = 0.6;
let menuMusicUnlocked = false;
let endMusicStopped = false;

function fadeOutAndPause(audioFile) {
    if (!audioFile) return;
    audioFile.pause();
    audioFile.currentTime = 0;
}

function startMenuMusic() {
    if (!bgmMenuTheme || gameState === "playing") return;
    menuMusicUnlocked = true;
    bgmMenuTheme.play().catch(() => {});
}

function stopMenuMusic() { fadeOutAndPause(bgmMenuTheme); }

function startBattleMusic() {
    // Battle music disabled for now.
    return;
}

function stopBattleMusic() { return; }

function stopBossMusic() {
    fadeOutAndPause(bgmBossTheme);
    fadeOutAndPause(bgmTechniqueDeployment);
}

window.addEventListener("pointerdown", () => {
    if (!menuMusicUnlocked && gameState !== "playing") startMenuMusic();
}, { once: true });

window.addEventListener("keydown", () => {
    if (!menuMusicUnlocked && gameState !== "playing") startMenuMusic();
}, { once: true });

sfxAkazaLanding.volume = 0.9; sfxAkazaVoice.volume = 0.9;
const sfxBreathing = new Audio("audio/breathing.mp3"); sfxBreathing.loop = false; sfxBreathing.volume = 0.55;
let wantsBreathingSound = false;

sfxBreathing.addEventListener("ended", () => {
    if (wantsBreathingSound && gameState === "playing" && !gameOver) {
        sfxBreathing.currentTime = 0; sfxBreathing.play().catch(() => {});
    }
});

const activeSoundClones = new Set();

function shouldBlockGameplaySound() {
    return gameState === "paused" || gameOver || gameWon || endScreenShown;
}

function playSound(audioFile) {
    if (!audioFile || shouldBlockGameplaySound()) return;

    const s = audioFile.cloneNode();
    s.volume = audioFile.volume || 1;
    activeSoundClones.add(s);

    const cleanup = () => {
        activeSoundClones.delete(s);
        try { s.remove(); } catch (_) {}
    };

    s.onended = cleanup;
    s.onerror = cleanup;
    s.play().catch(cleanup);
}

function stopActiveSoundClones() {
    activeSoundClones.forEach((s) => {
        try {
            s.pause();
            s.currentTime = 0;
            s.remove();
        } catch (_) {}
    });
    activeSoundClones.clear();
}

function getPersistentGameplayAudios() {
    return [
        bgmTechniqueDeployment,
        bgmBossTheme,
        sfxBreathing
    ].filter(Boolean);
}

function stopAllGameplayAudio() {
    stopBreathingSoundAfterCurrentFile();
    stopBattleMusic();
    stopBossMusic();
    stopActiveSoundClones();

    getPersistentGameplayAudios().forEach((audioFile) => {
        try {
            audioFile.pause();
            audioFile.currentTime = 0;
        } catch (_) {}
    });
}

function startBreathingSound() {
    if (!sfxBreathing) return;
    wantsBreathingSound = true;
    if (sfxBreathing.paused || sfxBreathing.ended) { sfxBreathing.currentTime = 0; sfxBreathing.play().catch(() => {}); }
}

function stopBreathingSoundAfterCurrentFile() { wantsBreathingSound = false; }
function updateBreathingSound() {
    const breathingStateActive = keys.G || player.totalConcentrationActive;
    if (gameState === "playing" && !gameOver && breathingStateActive) startBreathingSound();
    else stopBreathingSoundAfterCurrentFile();
}

function activateTotalConcentration() {
    if (player.totalConcentrationActive || player.totalConcentrationCooldown > 0) return;
    playSound(sfxTotalConcentration); 
    player.totalConcentrationActive = true; 
    player.totalConcentrationTimer = player.totalConcentrationDuration; 
    player.totalConcentrationCooldown = player.totalConcentrationCooldownMax;
    player.health = Math.max(1, player.health - 15); 
    player.breathing = Math.min(player.maxBreathing, player.breathing + 50);
    pushHealText(player.x + player.width / 2, player.y - 18, "5TH ABILITY -15 HP"); 
    addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 26);
    damageFlashTimer = 15;
    startCameraShake(12, 10);
}

// =====================================================
// WORLD & GAME STATE
// =====================================================
const MAP_WIDTH = 3000;
let GROUND_Y = 520;
let cameraX = 0;
let shakeTimer = 0, shakeStrength = 0, screenShakeX = 0, screenShakeY = 0;
let impactFrameTimer = 0, lightImpactFrameTimer = 0, damageFlashTimer = 0; 
let score = 0, combo = 0, comboTimer = 0, gameOver = false, gameWon = false, spawnTimer = 0, demonIdCounter = 1, timeScale = 1;
let endSequenceTimer = 0;
let bossSmoke = [];

function resizeCanvas() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    canvas.style.width = "100vw"; canvas.style.height = "100vh";
    
    GROUND_Y = Math.max(430, canvas.height - 160);
    player.baseY = GROUND_Y - player.height;
    
    if (player.isGrounded && !player.isAttacking) {
        player.y = player.baseY;
    } else if (player.y > player.baseY) {
        player.y = player.baseY; 
    }

    if (akaza) {
        akaza.targetY = GROUND_Y - 95;
        if (akaza.pose === "standing" || akaza.pose === "kneeling" || akaza.state === "idle") {
            akaza.y = akaza.targetY;
        } else if (akaza.y > akaza.targetY) {
            akaza.y = akaza.targetY; 
        }
    }

    if (typeof demons !== 'undefined') {
        demons.forEach(d => {
            d.y = GROUND_Y - d.height;
        });
    }

    if (typeof healthDrops !== 'undefined') {
        healthDrops.forEach(drop => {
            drop.y = GROUND_Y - 24; 
        });
    }
}
window.addEventListener("resize", resizeCanvas);

// =====================================================
// ARRAYS & SYSTEM DATA
// =====================================================
let akaza = null;
let akazaIntro = {
    active: false, done: false, timer: 0, phase: 0, letterbox: 0, smoke: [], shockRings: [], smokeAlpha: 1, landed: false,
    standingProgress: 0, cameraFocusX: 0, zoomTarget: 1, currentZoom: 1, dialogue: null,
    compassRadius: 0, compassRedAlpha: 0, compassBlueAlpha: 0, playedReveal: false
};

const demons = [], projectiles = [], waterTrails = [], foamParticles = [], jumpBursts = [], shockwaves = [], healTexts = [], clashSparks = [], parrySlashes = [], afterglowFistStreaks = [];
const healthDrops = []; 

const MAX_DEMONS = 11, MAX_PROJECTILES = 400, MAX_WATER_TRAILS = 70, MAX_FOAM = 140, MAX_JUMP_BURSTS = 10, MAX_SHOCKWAVES = 250, MAX_HEAL_TEXTS = 10, MAX_CLASH_SPARKS = 220, MAX_PARRY_SLASHES = 14, MAX_AFTERGLOW_FIST_STREAKS = 135;
const MAX_HEALTH_DROPS = 25;
const MAX_PROGRESS_SCORE = 70000; // Arcade threat path ends when Akaza arrives at 70K.

const enemyMilestones = [
    { score: 15000, enemy: "SNIPER DEMON", hp: "1 HP", alert: "ELITE ENEMY UNLOCKED AT 15K SCORE. HP CAP RAISES TO 150.", description: "A ranged demon that keeps distance and fires blood projectiles.", tip: "TIP: Dash in, use forms, or deflect its projectile back.", revealed: false },
    { score: 30000, enemy: "SWIFT DEMON", hp: "2 HP", alert: "ELITE ENEMY UNLOCKED AT 30K SCORE. HP CAP RAISES TO 240.", description: "A fast demon that dashes through you and attacks quickly.", tip: "TIP: Guard, parry, then punish after its dash.", revealed: false },
    { score: 60000, enemy: "BRUTE DEMON", hp: "8 HP", alert: "ELITE ENEMY UNLOCKED AT 60K SCORE. HP CAP RAISES TO 320.", description: "A heavy demon with armor, brutal swings, and shockwaves.", tip: "TIP: M1 is weak. Use Whirlpool or stronger forms.", revealed: false },
    { score: 70000, enemy: "???", hp: "???", alert: "BOSS WARNING AT 70K SCORE / 70% THREAT. AKAZA IS APPROACHING. HP CAP RAISES TO 485.", description: "A terrifying presence approaches...", tip: "TIP: Heal up and prepare. Boss music will take over after the intro.", revealed: false }
];

let enemyRevealPopup = { active: false, timer: 0, maxTimer: 420, title: "", description: "", tip: "", hp: "", scoreNeeded: 0, alert: "", hpCapText: "" };
let enemyRevealCloseButton = { active: false, x: 0, y: 0, size: 0 };

function checkEnemyMilestones() {
    for (let i = 0; i < enemyMilestones.length; i++) {
        const m = enemyMilestones[i];
        if (!m.revealed && score >= m.score) { 
            m.revealed = true; 
            startEnemyRevealPopup(m); 
            if (m.score >= 70000) {
                const introSessionId = gameplaySessionId;
                setTimeout(() => {
                    if (gameplaySessionId === introSessionId && gameState === "playing" && currentMode === "arcade" && !akaza && !akazaIntro.active) {
                        startAkazaIntro();
                    }
                }, 2500);
            }
            break; 
        }
    }
}
function startEnemyRevealPopup(milestone) {
    resetInputState();
    enemyRevealPopup.active = true;
    enemyRevealPopup.timer = enemyRevealPopup.maxTimer;
    enemyRevealPopup.title = milestone.enemy;
    enemyRevealPopup.description = milestone.description;
    enemyRevealPopup.tip = milestone.tip;
    enemyRevealPopup.hp = milestone.hp;
    enemyRevealPopup.scoreNeeded = milestone.score;
    enemyRevealPopup.alert = milestone.alert || "ELITE ENEMY UNLOCKED.";
    enemyRevealPopup.hpCapText = "";
    timeScale = 0.15; playSound(sfxReveal); startCameraShake(20, 5);
    
    let oldMax = player.maxHealth;
    if (milestone.score >= 15000 && player.maxHealth < 150) player.maxHealth = 150;
    if (milestone.score >= 30000 && player.maxHealth < 240) player.maxHealth = 240;
    if (milestone.score >= 60000 && player.maxHealth < 320) player.maxHealth = 320;
    if (milestone.score >= 70000 && player.maxHealth < 485) player.maxHealth = 485;
    
    if (player.maxHealth > oldMax) {
        player.health += (player.maxHealth - oldMax); 
        enemyRevealPopup.hpCapText = `PLAYER MAX HP CAP RAISED: ${oldMax} -> ${player.maxHealth}`;
        pushHealText(player.x + player.width / 2, player.y - 30, "MAX HP UP!");
    } else {
        enemyRevealPopup.hpCapText = `PLAYER MAX HP CAP: ${player.maxHealth}`;
    }
}
function dismissEnemyRevealPopup() {
    enemyRevealPopup.active = false;
    enemyRevealPopup.timer = 0;
    enemyRevealCloseButton.active = false;
    timeScale = 1;
}

function updateEnemyRevealPopup() {
    if (!enemyRevealPopup.active) {
        enemyRevealCloseButton.active = false;
        timeScale = 1;
        return;
    }

    enemyRevealPopup.timer--;
    if (enemyRevealPopup.timer <= 0) dismissEnemyRevealPopup();
}

function getCanvasPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function isInsideEnemyRevealCloseButton(point) {
    if (!enemyRevealPopup.active || !enemyRevealCloseButton.active) return false;

    return point.x >= enemyRevealCloseButton.x &&
        point.x <= enemyRevealCloseButton.x + enemyRevealCloseButton.size &&
        point.y >= enemyRevealCloseButton.y &&
        point.y <= enemyRevealCloseButton.y + enemyRevealCloseButton.size;
}

window.addEventListener("mousedown", (event) => {
    if (!enemyRevealPopup.active) return;

    const point = getCanvasPointerPosition(event);
    if (!isInsideEnemyRevealCloseButton(point)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    dismissEnemyRevealPopup();
}, true);

// =====================================================
// PLAYER CONFIGURATION
// =====================================================
const keys = { Left: false, Right: false, G: false, W: false, Space: false };
const player = {
    x: 400, y: GROUND_Y - 70, baseY: GROUND_Y - 70, vy: 0, isGrounded: true,
    width: 38, height: 70, speed: 6.5, guardSpeedMultiplier: 0.32, facing: "right", bodyRotation: 0,
    health: 100, maxHealth: 100,
    breathing: 60, maxBreathing: 180, 
    totalConcentrationActive: false, totalConcentrationTimer: 0, totalConcentrationDuration: 480, totalConcentrationCooldown: 0, totalConcentrationCooldownMax: 1200,
    selectedForm: 0, currentForm: 0, isAttacking: false, attackFrame: 0, maxAttackFrames: 12,
    attackBox: { x: 0, y: 0, width: 90, height: 60 }, hitTargets: new Set(), m1AlreadyHit: false, m1Step: 0,
    isGuarding: false, guardFrame: 0, perfectParryFrames: 18, guardCooldown: 0,
    isStunned: false, stunTimer: 0, invincibleTimer: 0,
    isDashing: false, dashTimer: 0, dashDir: 1, dashCharges: 2, maxDashCharges: 2, dashRechargeTimer: 0, dashRechargeDelay: 120,
    jumpSquash: 0, landingSquash: 0, sunSecondHitReset: false, sunImpactLock: false, formParryLock: 0
};

const formCooldowns = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; 
const maxCooldowns = { 1: 240, 2: 360, 3: 900, 4: 1400, 5: 3000 }; 
const formRequirements = { 0: 0, 1: 40, 2: 80, 3: 100, 4: 140, 5: 180 };
const attackDamage = { 0: 1, 1: 12, 2: 4, 3: 5, 4: 7, 5: 34 }; // Sun Dance is still ultimate, but not boss-melting too fast.
const sunHealthCost = { 5: 22 };
resizeCanvas();

function isCutsceneOrPopupActive() {
    return Boolean((typeof akazaIntro !== "undefined" && akazaIntro.active) || (typeof enemyRevealPopup !== "undefined" && enemyRevealPopup.active));
}

function isPlayerControlLocked() {
    return gameState !== "playing" || gameOver || gameWon || player.isStunned || isCutsceneOrPopupActive();
}

// =====================================================
// INPUT
// =====================================================
window.addEventListener("keydown", (e) => {
    if (isPlayerControlLocked()) return;

    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.Left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.Right = true;
    if (e.code === "KeyG") keys.G = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.W = true;

    if (e.code === "Space") {
        keys.Space = true;
        if (!player.isGuarding && player.guardCooldown <= 0 && !player.isAttacking && !player.isDashing) {
            player.isGuarding = true;
            player.guardFrame = 0;
        }
    }

    if (e.code === "KeyQ" && player.dashCharges > 0 && !player.isAttacking && !player.isGuarding && !player.isDashing) {
        player.isDashing = true;
        player.dashTimer = 10;
        player.invincibleTimer = 14;
        player.dashDir = player.facing === "right" ? 1 : -1;
        player.dashCharges--;
        if (player.dashRechargeTimer <= 0) player.dashRechargeTimer = player.dashRechargeDelay;
        playSound(sfxDash);
        addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 12);
    }

    if (e.code === "Digit1" && player.breathing >= formRequirements[1] && formCooldowns[1] <= 0) player.selectedForm = 1;
    if (e.code === "Digit2" && player.breathing >= formRequirements[2] && formCooldowns[2] <= 0) player.selectedForm = 2;
    if (e.code === "Digit3" && player.breathing >= formRequirements[3] && formCooldowns[3] <= 0) player.selectedForm = 3;
    if (e.code === "Digit4" && player.breathing >= formRequirements[4] && formCooldowns[4] <= 0) player.selectedForm = 4;
    if (e.code === "Digit5" && player.breathing >= formRequirements[5] && formCooldowns[5] <= 0) player.selectedForm = 5;

    if (e.code === "KeyF" && player.totalConcentrationCooldown <= 0 && !player.totalConcentrationActive && !e.repeat) activateTotalConcentration();
});

window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.Left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.Right = false;
    if (e.code === "KeyG") keys.G = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.W = false;
    if (e.code === "Space") {
        keys.Space = false;
        if (player.isGuarding) {
            player.isGuarding = false;
            player.guardFrame = 0;
            player.guardCooldown = 18;
        }
    }
});

window.addEventListener("mousedown", (e) => {
    if (isPlayerControlLocked() || player.isGuarding || player.isDashing || e.button !== 0 || player.isAttacking || keys.G) return;

    const requestedForm = player.selectedForm || 0;
    if (requestedForm > 0) {
        const req = formRequirements[requestedForm] || 0;
        if (player.breathing < req || formCooldowns[requestedForm] > 0) return;
    }

    player.isAttacking = true;
    player.attackFrame = 0;
    player.currentForm = requestedForm;
    player.hitTargets.clear();
    player.m1AlreadyHit = false;
    player.sunSecondHitReset = false;
    player.sunImpactLock = false;
    player.formParryLock = 0;

    if (player.currentForm === 0) {
        player.m1Step = player.m1Step ? (player.m1Step % 4) + 1 : 1;
        player.maxAttackFrames = 12;
        playSound(m1Sounds[player.m1Step - 1]);
    } else {
        player.m1Step = 0;
    }

    if (player.currentForm === 1) {
        player.maxAttackFrames = 35;
        player.breathing -= 40;
        playSound(formSounds[1]);
    } else if (player.currentForm === 2) {
        player.maxAttackFrames = 72;
        player.breathing -= 80;
        playSound(formSounds[2]);
    } else if (player.currentForm === 3) {
        player.maxAttackFrames = 120;
        player.breathing -= 100;
        player.isGrounded = false;
        player.vy = 0;
        player.jumpSquash = 8;
        addFoamBurst(player.x + player.width / 2, player.y + player.height, 16);
        pushJumpBurst(player.x + player.width / 2, player.y + player.height, "jump");
        startCameraShake(6, 3.5);
        playSound(formSounds[3]);
    } else if (player.currentForm === 4) {
        player.maxAttackFrames = 130;
        player.breathing -= 140;
        playSound(formSounds[4]);
    } else if (player.currentForm === 5) {
        // Sun Breathing 1st Form: SUN DANCE. Ultimate offense + full invulnerability during execution.
        player.maxAttackFrames = 96;
        player.breathing -= 180;
        player.health = Math.max(1, player.health - sunHealthCost[5]);
        player.invincibleTimer = Math.max(player.invincibleTimer, 42);
        damageFlashTimer = Math.max(damageFlashTimer, 24);
        impactFrameTimer = Math.max(impactFrameTimer, 12);
        lightImpactFrameTimer = Math.max(lightImpactFrameTimer, 8);
        addSunFlareBurst(player.x + player.width / 2, player.y + player.height / 2, 38);
        pushStatusText(player.x + player.width / 2, player.y - 30, "SUN BREATHING: SUN DANCE!", "#f97316", 88);
        startCameraShake(16, 13);
        playSound(sfxSunDance);
    }
});

// =====================================================
// HELPERS & EFFECTS ENGINE
// =====================================================
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function rectsOverlap(a, b) { return (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y); }
function circleRectCollision(cx, cy, radius, rect, padding = 0) { const closestX = clamp(cx, rect.x - padding, rect.x + rect.width + padding); const closestY = clamp(cy, rect.y - padding, rect.y + rect.height + padding); const dx = cx - closestX; const dy = cy - closestY; return dx * dx + dy * dy <= radius * radius; }
function distanceBetween(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function pushWaterTrail(trail) { if (waterTrails.length >= MAX_WATER_TRAILS) waterTrails.shift(); waterTrails.push(trail); }
function pushProjectile(projectile) { if (projectiles.length >= MAX_PROJECTILES) projectiles.shift(); projectiles.push(projectile); }
function pushJumpBurst(x, y, type = "jump") { if (jumpBursts.length >= MAX_JUMP_BURSTS) jumpBursts.shift(); jumpBursts.push({ x, y, radius: type === "land" ? 34 : 24, alpha: 1, type }); }
function pushShockwave(x, y, maxRadius, damage, owner, color = "#fb923c", speed = 8, lineWidth = 8) { if (shockwaves.length >= MAX_SHOCKWAVES) shockwaves.shift(); shockwaves.push({ x, y, radius: 10, maxRadius, damage, alpha: 1, owner, hasHitPlayer: false, color, speed, lineWidth }); }
function pushHealText(x, y, amount, color = "#22c55e", life = 70) { if (healTexts.length >= MAX_HEAL_TEXTS) healTexts.shift(); healTexts.push({ x, y, amount, alpha: 1, vy: -0.6, life, maxLife: life, color }); }
function pushStatusText(x, y, text, color = "#38bdf8", life = 70) { pushHealText(x, y, text, color, life); }
function pushStunText(x, y) { pushStatusText(x, y, "STUNNED!", "#38bdf8", 74); }
function pushClashSparks(x, y, amount = 20, color = "#fb923c") { for (let i = 0; i < amount; i++) { if (clashSparks.length >= MAX_CLASH_SPARKS) clashSparks.shift(); const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 6 + 3; clashSparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, length: Math.random() * 18 + 8, alpha: 1, color }); } }
function pushParrySlash(x, y) { if (parrySlashes.length >= MAX_PARRY_SLASHES) parrySlashes.shift(); parrySlashes.push({ x, y, alpha: 1, radius: 35, rotation: Math.random() * Math.PI }); parrySlashes.push({ x, y, alpha: 1, radius: 26, rotation: Math.random() * Math.PI }); }
function pushAfterglowFistStreak(x, y, angle, length = 130, color = "#e0f2fe") {
    if (afterglowFistStreaks.length >= MAX_AFTERGLOW_FIST_STREAKS) afterglowFistStreaks.shift();
    afterglowFistStreaks.push({
        x,
        y,
        angle,
        length,
        alpha: 1,
        width: 22 + Math.random() * 24,
        color,
        curl: (Math.random() - 0.5) * 34,
        pulse: Math.random() * Math.PI * 2
    });
}
function addFoamBurst(worldX, worldY, amount = 12) { for (let i = 0; i < amount; i++) { if (foamParticles.length >= MAX_FOAM) foamParticles.shift(); foamParticles.push({ x: worldX, y: worldY, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, radius: Math.random() * 6 + 2, alpha: 1, decay: Math.random() * 0.035 + 0.025, color: "#dbeafe", shadow: "#38bdf8" }); } }
function addSunFlareBurst(worldX, worldY, amount = 24) { for (let i = 0; i < amount; i++) { if (foamParticles.length >= MAX_FOAM) foamParticles.shift(); const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 16 + 5; const ember = Math.random(); foamParticles.push({ x: worldX, y: worldY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - Math.random() * 2.5, radius: Math.random() * 10 + 4, alpha: 1, decay: Math.random() * 0.026 + 0.012, color: ember < 0.25 ? "#fff7ad" : ember < 0.58 ? "#fbbf24" : ember < 0.84 ? "#f97316" : "#ef4444", shadow: ember < 0.7 ? "#f97316" : "#991b1b" }); } }
function startCameraShake(duration, strength) { shakeTimer = duration; shakeStrength = strength; }
function isPerfectParryWindow() { return player.isGuarding && player.guardFrame <= player.perfectParryFrames; }
function isSunDanceActive() {
    return player.isAttacking && player.currentForm === 5 && player.attackFrame > 0 && player.attackFrame < player.maxAttackFrames - 1;
}

function isWaterDefenseFormActive() {
    // Water 1 and 2 are damage-only. Water 3 and 4 are the defensive forms.
    return player.isAttacking && (player.currentForm === 3 || player.currentForm === 4) && player.attackFrame > 3 && player.attackFrame < player.maxAttackFrames - 2;
}

function isWaterWheelProjectileDeflectActive() {
    // Water Wheel can cut/deflect projectiles only. It does NOT block physical contact attacks.
    return player.isAttacking && player.currentForm === 2 && player.attackFrame > 4 && player.attackFrame < player.maxAttackFrames - 2;
}

function getWaterWheelDeflectBox() {
    const padding = 34;
    return {
        x: player.attackBox.x - padding,
        y: player.attackBox.y - padding,
        width: player.attackBox.width + padding * 2,
        height: player.attackBox.height + padding * 2
    };
}

function deflectProjectileWithWaterWheel(pr) {
    const dir = player.facing === "right" ? 1 : -1;
    pr.vx = Math.max(16, Math.abs(pr.vx || 16)) * dir * 1.65;
    pr.vy = (Math.random() - 0.5) * 4;
    pr.color = "#38bdf8";
    pr.deflected = true;
    combo++;
    comboTimer = 230;
    score += 160;
    playSound(sfxParryClang);
    addFoamBurst(pr.x, pr.y, 12);
    pushClashSparks(pr.x, pr.y, 24, "#38bdf8");
    pushClashSparks(pr.x, pr.y, 10, "#ffffff");
    pushParrySlash(pr.x, pr.y);
    startCameraShake(7, 5);
}

function isFormDefenseActive() {
    return isWaterDefenseFormActive() || isSunDanceActive();
}

function isFormParryActive() {
    // True parry/clash belongs to Sun Dance only. Water 3/4 defend, but they do not become Sun-level parries.
    return isSunDanceActive();
}

function getActiveFormDefenseBox() {
    if (!isFormDefenseActive()) return getPlayerBox();
    const padding = player.currentForm === 5 ? 68 : 44;
    return {
        x: player.attackBox.x - padding,
        y: player.attackBox.y - padding,
        width: player.attackBox.width + padding * 2,
        height: player.attackBox.height + padding * 2
    };
}

function getActiveFormParryBox() {
    return getActiveFormDefenseBox();
}

function doFormDefense(targetObject = null, x = null, y = null) {
    if (isSunDanceActive()) return doFormParry(targetObject, x, y);
    if (!isWaterDefenseFormActive()) return false;

    const px = x ?? (player.x + player.width / 2);
    const py = y ?? (player.y + player.height / 2);
    if (player.formParryLock > 0) return true;

    player.formParryLock = 7;
    player.invincibleTimer = Math.max(player.invincibleTimer, 10);
    comboTimer = 220;
    score += 55;
    playSound(sfxClash);
    pushClashSparks(px, py, 34, "#38bdf8");
    pushClashSparks(px, py, 12, "#ffffff");
    pushParrySlash(px, py);
    addFoamBurst(px, py, 10);
    startCameraShake(8, 6);

    if (targetObject) {
        targetObject.attackWindup = 0;
        targetObject.attackHasHit = true;
        if (targetObject !== akaza) targetObject.attackCooldown = Math.max(targetObject.attackCooldown || 0, 35);
        if (targetObject === akaza && targetObject.currentAttack !== "chaotic_afterglow") {
            targetObject.attackDuration = Math.min(targetObject.attackDuration || 0, 26);
        }
    }
    return true;
}

function doFormParry(targetObject = null, x = null, y = null) {
    if (!isSunDanceActive()) return false;

    const px = x ?? (player.x + player.width / 2);
    const py = y ?? (player.y + player.height / 2);
    if (player.formParryLock > 0) return true;

    player.formParryLock = 6;
    player.invincibleTimer = Math.max(player.invincibleTimer, 18);
    combo += 2;
    comboTimer = 240;
    score += 140;
    playSound(sfxParryClang);
    pushClashSparks(px, py, 54, "#fbbf24");
    pushClashSparks(px, py, 28, "#ffffff");
    pushParrySlash(px, py);
    startCameraShake(13, 10);
    addSunFlareBurst(px, py, 12);

    if (targetObject) {
        targetObject.stunnedTimer = Math.max(targetObject.stunnedTimer || 0, 54);
        targetObject.attackWindup = 0;
        targetObject.attackHasHit = true;
        if (targetObject === akaza && targetObject.currentAttack !== "chaotic_afterglow") {
            targetObject.attackDuration = Math.min(targetObject.attackDuration || 0, 18);
            pushStunText(targetObject.x + targetObject.width / 2, targetObject.y - 22);
        }
    }
    return true;
}

// --- EXPLOSIVE EXPANDING BOSS SMOKE SYSTEM ---
function createBossSmoke(x, y, amount) {
    bossSmoke = [];
    for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 30 + 10; 
        bossSmoke.push({
            x: x, y: y - 10, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.4 - 2, 
            radius: Math.random() * 60 + 40, alpha: Math.random() * 0.5 + 0.5, grow: Math.random() * 0.5 + 0.2, drift: Math.random() * Math.PI * 2, friction: 0.90 
        });
    }
}
function updateBossSmoke(dt) {
    for (let i = bossSmoke.length - 1; i >= 0; i--) {
        const s = bossSmoke[i];
        s.drift += 0.02 * dt; s.x += (s.vx + Math.sin(s.drift) * 1.5) * dt; s.y += s.vy * dt; s.vx *= Math.pow(s.friction, dt); s.vy *= Math.pow(s.friction, dt);
        s.radius += s.grow * dt; s.alpha -= 0.0025 * dt; 
        if (s.alpha <= 0) bossSmoke.splice(i, 1);
    }
}
function drawBossSmoke() {
    if (bossSmoke.length === 0) return;
    bossSmoke.forEach((s) => {
        ctx.save(); ctx.globalAlpha = s.alpha; ctx.fillStyle = "#0f172a"; ctx.shadowBlur = 30; ctx.shadowColor = "#020617";
        ctx.beginPath(); ctx.arc(s.x - cameraX, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(100,116,139,0.15)";
        ctx.beginPath(); ctx.arc(s.x - cameraX - s.radius * 0.2, s.y - s.radius * 0.2, s.radius * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });
}

// --- HEALTH DROP SYSTEM ---
function updateHealthDrops(dt) {
    for (let i = healthDrops.length - 1; i >= 0; i--) {
        const drop = healthDrops[i];
        const isPickedUp = player.x < drop.x + drop.width && player.x + player.width > drop.x &&
                           player.y < drop.y + drop.height && player.y + player.height > drop.y;
        if (isPickedUp) {
            player.health = Math.min(player.maxHealth, player.health + drop.healValue);
            addFoamBurst(drop.x + drop.width / 2, drop.y + drop.height / 2, 16);
            pushHealText(drop.x, drop.y, drop.healValue);
            healthDrops.splice(i, 1);
        }
    }
}
function drawHealthDrops() {
    healthDrops.forEach((drop) => {
        ctx.save();
        const bobY = Math.sin((Date.now() / 240) + drop.bobOffset) * 5;
        ctx.shadowBlur = 18; ctx.shadowColor = "#10b981"; ctx.fillStyle = "#10b981";
        ctx.fillRect(drop.x - cameraX, drop.y + 6 + bobY, drop.width, 8);
        ctx.fillRect(drop.x + 6 - cameraX, drop.y + bobY, 8, drop.height);
        ctx.fillStyle = "#a7f3d0";
        ctx.fillRect(drop.x + 6 - cameraX, drop.y + 6 + bobY, 8, 8);
        ctx.restore();
    });
}

function freezeRunAfterEnd() {
    stopAllGameplayAudio();
    cancelPlayerActionState({ resetCooldowns: false, clearTrails: true });

    demons.length = 0;
    projectiles.length = 0;
    shockwaves.length = 0;
    afterglowFistStreaks.length = 0;
    bossSmoke.length = 0;
    clashSparks.length = 0;
    parrySlashes.length = 0;

    if (akaza) {
        akaza.state = "ended";
        akaza.currentAttack = null;
        akaza.attackWindup = 0;
        akaza.attackDuration = 0;
        akaza.comboStep = 0;
        akaza.afterglowCloseHitTimer = 0;
    }

    if (akazaIntro) {
        akazaIntro.active = false;
        akazaIntro.dialogue = null;
        akazaIntro.smoke = [];
        akazaIntro.shockRings = [];
    }

    enemyRevealPopup.active = false;
    enemyRevealPopup.timer = 0;
    timeScale = 0;
}

function scheduleResultScreen(delay = 900) {
    const resultSessionId = gameplaySessionId;
    const resultToken = ++resultScreenToken;

    setTimeout(() => {
        if (gameplaySessionId !== resultSessionId) return;
        if (resultToken !== resultScreenToken) return;
        if (gameState !== "playing") return;
        if (!(gameOver || gameWon) || endScreenShown) return;
        showResultScreen();
    }, delay);
}

function handlePlayerDamage(amount, options = {}) {
    if (gameOver || gameWon || endScreenShown) return;

    const ignoreFormDefense = Boolean(options.ignoreFormDefense);
    const ignoreGuard = Boolean(options.ignoreGuard);
    const ignoreInvincibility = Boolean(options.ignoreInvincibility);
    const invincibleFrames = Number.isFinite(options.invincibleFrames) ? options.invincibleFrames : (player.isGuarding && !ignoreGuard ? 18 : 32);

    if (!ignoreFormDefense && isFormDefenseActive()) { doFormDefense(null); return; }
    if (!ignoreInvincibility && player.invincibleTimer > 0) return;

    let finalDamage = amount;
    if (player.isGuarding && !ignoreGuard) {
        finalDamage *= 0.35;
        addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 6);
    }

    player.health -= finalDamage;
    combo = 0;
    comboTimer = 0;
    player.invincibleTimer = Math.max(player.invincibleTimer, invincibleFrames);

    if (player.isGuarding && !ignoreGuard) {
        playSound(sfxGuardDamage);
        playSound(sfxClash);
        pushClashSparks(player.x + player.width / 2, player.y + player.height / 2, 24, "#fb923c");
        pushClashSparks(player.x + player.width / 2, player.y + player.height / 2, 10, "#ffffff");
    } else {
        playSound(sfxPlayerHurt);
        if (player.isGuarding && ignoreGuard) {
            pushStatusText(player.x + player.width / 2, player.y - 18, "GUARD BROKEN!", "#f43f5e", 46);
            pushClashSparks(player.x + player.width / 2, player.y + player.height / 2, 36, "#e0f2fe");
        }
    }
    
    startCameraShake(ignoreGuard ? 22 : (player.isGuarding ? 8 : 18), ignoreGuard ? 16 : (player.isGuarding ? 5 : 15));
    damageFlashTimer = Math.max(damageFlashTimer, ignoreGuard ? 22 : (!player.isGuarding ? 15 : 0));
    
    if (player.health <= 0) { 
        player.health = 0; 
        gameOver = true; 
        gameWon = false;
        endSequenceTimer = 0;
        endMusicStopped = false;
        freezeRunAfterEnd();
        scheduleResultScreen(650);
    }
}

function doPerfectParry(targetObject, isProjectile = false) {
    player.invincibleTimer = 30; player.guardCooldown = 0; combo += 5; comboTimer = 250; score += 650;
    
    // Universal Parry Buff! Physical and Projectile both give 8 HP.
    // Parry intentionally does NOT restore breathing.
    let healAmount = 8;
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    pushHealText(player.x + player.width / 2, player.y - 20, `PARRY! +${healAmount} HP`);

    if (targetObject) targetObject.stunnedTimer = 130;
    const px = player.x + player.width / 2; const py = player.y + player.height / 2;
    addFoamBurst(px, py, 22); pushClashSparks(px, py, 70, "#f97316"); pushClashSparks(px, py, 50, "#ffffff"); pushClashSparks(px, py, 38, "#38bdf8"); pushParrySlash(px, py); stunNearbyEnemies(px, py, 125); startCameraShake(11, 8); playSound(sfxParryClang); playSound(sfxPerfectParry);
    return true;
}

function stunNearbyEnemies(x, y, radius) {
    if (akaza) { 
        if (akaza.currentAttack !== "chaotic_afterglow") {
            akaza.stunnedTimer = Math.max(akaza.stunnedTimer, 55); akaza.attackWindup = 0; akaza.currentAttack = null; 
            pushStunText(akaza.x + akaza.width / 2, akaza.y - 18);
        }
    }
    demons.forEach((d) => { const dx = d.x + d.width / 2 - x; const dy = d.y + d.height / 2 - y; const dist = Math.sqrt(dx * dx + dy * dy); if (dist <= radius) { d.stunnedTimer = Math.max(d.stunnedTimer, 65); d.health -= 0.35; pushStunText(d.x + d.width / 2, d.y - 18); } });
}

function handleGuardOrParryAgainstPhysical(targetObject, damageAmount) {
    if (isFormDefenseActive()) { doFormDefense(targetObject); return; }
    if (!player.isGuarding) { handlePlayerDamage(damageAmount); return; }
    if (isPerfectParryWindow()) { doPerfectParry(targetObject, false); return; }
    handlePlayerDamage(damageAmount);
}

// =====================================================
// AKAZA CINEMATIC INTRO
// =====================================================
function startAkazaIntro() {
    if (gameState !== "playing") return;
    stopBattleMusic();
    bossSmoke.length = 0;
    akazaIntro.smoke = [];
    akazaIntro.shockRings = [];
    if (!BOSS_TEST_MODE) {
        let oldMax = player.maxHealth;
        player.maxHealth = 485;
        if (player.maxHealth > oldMax) {
            player.health += (player.maxHealth - oldMax);
            pushHealText(player.x + player.width/2, player.y - 30, "MAX HP UP!");
        }
        // WIPE ALL ENEMIES INSTANTLY IN ARCADE MODE
        demons.forEach((d) => {
            addFoamBurst(d.x + d.width/2, d.y + d.height/2, 20); // Make them pop
        });
        demons.length = 0; 
    } else {
        // Boss Mode specific forced position to look clean
        player.x = 500;
    }
    
    projectiles.length = 0; shockwaves.length = 0; clashSparks.length = 0; parrySlashes.length = 0;
    healthDrops.length = 0; 
    
    if (BOSS_TEST_MODE) score = 0;
    combo = 0; comboTimer = 0; spawnTimer = 0;
    
    // Keep player grounded but DON'T forcibly teleport them in Arcade to fix the camera jitter!
    cancelPlayerActionState({ resetCooldowns: false, clearTrails: true });
    player.y = player.baseY; player.vy = 0; player.isGrounded = true; player.facing = "right";

    // Dynamically calculate spawn X so he drops relative to the player's current location smoothly
    let spawnDir = player.x < MAP_WIDTH / 2 ? 1 : -1;
    const spawnX = clamp(player.x + (620 * spawnDir), 50, MAP_WIDTH - 70);
    
    akaza = {
        x: spawnX, y: -220, targetY: GROUND_Y - 95, width: 60, height: 95, vy: 30, pose: "falling", facing: "left", bodyRotation: 0,
        health: 2400, maxHealth: 2400, state: "idle", actionTimer: 60,
        attackWindup: 0, currentAttack: null, attackDuration: 0,
        comboStep: 0, dodgeCooldown: 0, invulnerable: false,
        stunnedTimer: 0, flashRed: 0, dashTargetX: 0,
        compassFadeAlpha: 0.85, damageScale: 1, chaoticUses: 0, chaoticThresholdTriggered: false 
    };

    akazaIntro = { active: true, done: false, timer: 0, phase: 1, letterbox: 0, smoke: [], shockRings: [], smokeAlpha: 1, landed: false, standingProgress: 0, cameraFocusX: player.x + player.width / 2, zoomTarget: 1, currentZoom: 1, dialogue: null, compassRadius: 0, compassRedAlpha: 0, compassBlueAlpha: 0, playedReveal: false };
    enemyRevealPopup.active = false; timeScale = 0.25;
}

function updateAkazaIntro(realDt) {
    if (!akazaIntro.active || !akaza) return;
    akazaIntro.timer += realDt;

    if (akazaIntro.phase === 1) { timeScale = 0.18; akazaIntro.letterbox = Math.min(90, akazaIntro.letterbox + 3 * realDt); if (akazaIntro.letterbox >= 90) { akazaIntro.phase = 2; akazaIntro.timer = 0; } return; }
    if (akazaIntro.phase === 2) {
        timeScale = 0.25; akaza.y += akaza.vy * realDt; akaza.vy += 1.35 * realDt; akaza.bodyRotation = Math.sin(akazaIntro.timer * 0.14) * 0.08;
        if (akaza.y >= akaza.targetY) {
            akaza.y = akaza.targetY; akaza.vy = 0; akaza.pose = "kneeling"; akaza.bodyRotation = 0; akazaIntro.phase = 3; akazaIntro.timer = 0; akazaIntro.landed = true; 
            playSound(sfxAkazaLanding); 
            startCameraShake(45, 18); createAkazaSmoke(akaza.x + akaza.width / 2, akaza.y + akaza.height, 115); createAkazaShockRings(akaza.x + akaza.width / 2, akaza.y + akaza.height);
        } return;
    }

    updateAkazaSmoke(realDt); updateAkazaShockRings(realDt);

    if (akazaIntro.phase === 3) { 
        timeScale = 0.2; akazaIntro.zoomTarget = 1.4; akazaIntro.cameraFocusX = akaza.x + akaza.width / 2; 
        if (akazaIntro.timer >= 240) { akazaIntro.phase = 4; akazaIntro.timer = 0; } return; 
    }
    if (akazaIntro.phase === 4) { 
        timeScale = 0.35; akaza.pose = "standingUp"; akazaIntro.smokeAlpha = Math.max(0, akazaIntro.smokeAlpha - 0.006 * realDt); akazaIntro.standingProgress = Math.min(1, akazaIntro.standingProgress + 0.015 * realDt); 
        
        if (akazaIntro.smokeAlpha <= 0.4 && !akazaIntro.playedReveal) { playSound(sfxReveal); akazaIntro.playedReveal = true; }
        if (akazaIntro.smokeAlpha <= 0 && akazaIntro.standingProgress >= 1) { akaza.pose = "standing"; akazaIntro.phase = 5; akazaIntro.timer = 0; } return; 
    }
    if (akazaIntro.phase === 5) { timeScale = 0.55; akazaIntro.dialogue = "akaza: hi be a demon"; if (akazaIntro.timer >= 120) { akazaIntro.phase = 6; akazaIntro.timer = 0; } return; }
    if (akazaIntro.phase === 6) { 
        akazaIntro.cameraFocusX = player.x + player.width / 2; akazaIntro.zoomTarget = 1.3; akazaIntro.dialogue = "no"; 
        if (akazaIntro.timer >= 140) { akazaIntro.phase = 7; akazaIntro.timer = 0; bgmTechniqueDeployment.currentTime = 0; bgmTechniqueDeployment.play().catch(()=>{});} 
        return; 
    } 

    if (akazaIntro.phase === 7) { 
        akazaIntro.cameraFocusX = akaza.x + akaza.width / 2; akazaIntro.zoomTarget = 1.4; akazaIntro.dialogue = "akaza: i see"; 
        if (akazaIntro.timer >= 340) { impactFrameTimer = 10; startCameraShake(50, 45); akazaIntro.phase = 7.1; akazaIntro.timer = 0; } 
        return; 
    }

    if (akazaIntro.phase === 7.1) { 
        akazaIntro.compassRedAlpha = Math.min(0.85, akazaIntro.compassRedAlpha + 0.08 * realDt); akazaIntro.compassRadius += (1100 - akazaIntro.compassRadius) * 0.08 * realDt;
        if (akazaIntro.timer >= 170) { akazaIntro.phase = 7.2; akazaIntro.timer = 0; } 
        return; 
    }

    if (akazaIntro.phase === 7.2) { 
        akazaIntro.cameraFocusX = akaza.x + akaza.width / 2; akazaIntro.zoomTarget = 1.4; akazaIntro.dialogue = "akaza: Technique Deployment!"; 
        akazaIntro.compassRedAlpha = Math.min(0.85, akazaIntro.compassRedAlpha + 0.08 * realDt); akazaIntro.compassRadius += (1100 - akazaIntro.compassRadius) * 0.08 * realDt;
        if (akazaIntro.timer >= 350) { akazaIntro.phase = 9; akazaIntro.timer = 0; impactFrameTimer = 8; startCameraShake(25, 12); } 
        return; 
    }
    if (akazaIntro.phase === 9) { 
        akazaIntro.compassRedAlpha = Math.max(0, akazaIntro.compassRedAlpha - 0.05 * realDt); akazaIntro.compassBlueAlpha = Math.min(0.85, akazaIntro.compassBlueAlpha + 0.04 * realDt);
        if (akazaIntro.timer >= 180) { akazaIntro.phase = 9.1; akazaIntro.timer = 0; } 
        return; 
    }

    if (akazaIntro.phase === 9.1) {
        akazaIntro.dialogue = "akaza: Compass Needle!"; 
        akazaIntro.compassRedAlpha = Math.max(0, akazaIntro.compassRedAlpha - 0.05 * realDt); akazaIntro.compassBlueAlpha = Math.min(0.85, akazaIntro.compassBlueAlpha + 0.04 * realDt);
        if (akazaIntro.timer >= 295) { akazaIntro.phase = 10; akazaIntro.timer = 0; } 
        return;
    }
    if (akazaIntro.phase === 10) {
        timeScale = 1; akazaIntro.dialogue = null; akazaIntro.zoomTarget = 1; akazaIntro.cameraFocusX = player.x + player.width / 2; akazaIntro.letterbox = Math.max(0, akazaIntro.letterbox - 2.2 * realDt);
        if (akazaIntro.letterbox <= 0 && akazaIntro.currentZoom <= 1.02) {
            akazaIntro.active = false; akazaIntro.done = true; akazaIntro.currentZoom = 1; 
            akaza.state = "idle"; akaza.actionTimer = 60;
            bgmTechniqueDeployment.pause(); bgmTechniqueDeployment.currentTime = 0; bgmBossTheme.currentTime = 0; bgmBossTheme.play().catch(()=>{}); 
        }
    }
}

// =====================================================
// BOSS AI CONTROLLER - MILESTONE ENRAGE SCALING
// =====================================================
function updateAkazaBoss(realDt) {
    if (!akaza || akazaIntro.active || akaza.health <= 0) return;

    const hpPct = Math.max(0, akaza.health / akaza.maxHealth);
    
    let speedBoost = 0;
    if (hpPct <= 0.70) speedBoost = 0.05;
    if (hpPct <= 0.60) speedBoost = 0.10;
    if (hpPct <= 0.50) speedBoost = 0.15;
    if (hpPct <= 0.40) speedBoost = 0.20;
    if (hpPct <= 0.30) speedBoost = 0.25;
    if (hpPct <= 0.20) speedBoost = 0.30;
    if (hpPct <= 0.10) speedBoost = 0.35;
    
    const enrageMult = 1 + speedBoost;
    akaza.damageScale = 1 + speedBoost; 

    const bossDt = realDt * enrageMult;

    // Chaotic Afterglow can randomly start once Akaza is around 45% HP,
    // but if he reaches 35% HP it is guaranteed so the final form never gets skipped.
    if (hpPct <= 0.35 && akaza.chaoticUses < 1 && akaza.state !== "attacking") {
        akaza.chaoticThresholdTriggered = true;
        akaza.stunnedTimer = 0;
        akaza.invulnerable = false;
        akaza.actionTimer = 0;
        pushStatusText(akaza.x + akaza.width / 2, akaza.y - 34, "FINAL FORM!", "#f43f5e", 120);
        startAkazaAttack("chaotic_afterglow");
        return;
    }

    if (akaza.compassFadeAlpha > 0) akaza.compassFadeAlpha = Math.max(0, akaza.compassFadeAlpha - 0.015 * bossDt);
    if (akaza.flashRed > 0) akaza.flashRed -= bossDt;
    if (akaza.stunnedTimer > 0) { akaza.stunnedTimer -= bossDt; return; }
    if (akaza.dodgeCooldown > 0) akaza.dodgeCooldown -= bossDt;

    const playerCenter = player.x + player.width / 2;
    const akazaCenter = akaza.x + akaza.width / 2;
    const dist = Math.abs(playerCenter - akazaCenter);
    const dir = akazaCenter < playerCenter ? 1 : -1;
    akaza.facing = dir === 1 ? "right" : "left";

    if (player.isAttacking && dist < 160 && akaza.state === "idle" && akaza.dodgeCooldown <= 0 && Math.random() < 0.35) {
        akaza.state = "dodge"; akaza.actionTimer = 16; akaza.invulnerable = true; 
        akaza.dodgeCooldown = 180 * hpPct; 
        const dashBehindDir = player.facing === "right" ? -1 : 1;
        akaza.dashTargetX = playerCenter + (dashBehindDir * 200); 
        addFoamBurst(akaza.x + akaza.width/2, akaza.y + akaza.height/2, 20); 
        playSound(sfxSwiftDash);
        return;
    }

    if (akaza.state === "dodge") {
        akaza.actionTimer -= bossDt; akaza.x += (akaza.dashTargetX - akaza.x) * 0.35 * bossDt;
        if (akaza.actionTimer <= 0) { akaza.state = "idle"; akaza.invulnerable = false; akaza.actionTimer = 10; }
        akaza.x = clamp(akaza.x, 0, MAP_WIDTH - akaza.width); return;
    }

    if (akaza.state === "idle") {
        akaza.actionTimer -= bossDt;
        
        if (dist > 160) akaza.x += dir * 3.5 * bossDt; 
        else if (dist < 110) akaza.x -= dir * 3.5 * bossDt; 

        if (akaza.actionTimer <= 0) {
            const rand = Math.random();
            const tryChaotic = akaza.chaoticUses < 1 && hpPct <= 0.45 && hpPct > 0.35 && rand < 0.30;

            if (tryChaotic) {
                akaza.chaoticThresholdTriggered = true;
                pushStatusText(akaza.x + akaza.width / 2, akaza.y - 34, "FINAL FORM!", "#f43f5e", 120);
                startAkazaAttack("chaotic_afterglow");
            } else {
                if (dist > 400) {
                    if (rand < 0.3) startAkazaAttack("air_type");
                    else if (rand < 0.6) startAkazaAttack("annihilation");
                    else startAkazaAttack("leg_type");
                } else if (dist > 150) {
                    if (rand < 0.2) startAkazaAttack("rush");
                    else if (rand < 0.4) startAkazaAttack("air_type");
                    else if (rand < 0.6) startAkazaAttack("leg_type");
                    else if (rand < 0.8) startAkazaAttack("annihilation");
                    else startAkazaAttack("eight_layered");
                } else {
                    if (rand < 0.15) startAkazaAttack("disorder");
                    else if (rand < 0.3) startAkazaAttack("crown_splitter");
                    else if (rand < 0.5) startAkazaAttack("eight_layered");
                    else if (rand < 0.7) startAkazaAttack("rush");
                    else if (hpPct < 0.3 && rand < 0.85) startAkazaAttack("annihilation"); 
                    else startAkazaAttack("disorder");
                }
            }
        }
    } else if (akaza.state === "attacking") {
        processAkazaAttack(bossDt, realDt, dist, dir);
    }
    akaza.x = clamp(akaza.x, 0, MAP_WIDTH - akaza.width);
}

function startAkazaAttack(attackName) {
    akaza.state = "attacking"; akaza.currentAttack = attackName; akaza.comboStep = 0;
    
    switch(attackName) {
        case "air_type": 
            akaza.attackWindup = 20; akaza.attackDuration = 80; akaza.flashRed = 20; playSound(sfxSwiftDash); break;
        case "leg_type": 
            akaza.attackWindup = 34; akaza.attackDuration = 58; akaza.flashRed = 28; playSound(sfxLegType); break;
        case "disorder": 
            akaza.attackWindup = 15; akaza.attackDuration = 50; akaza.flashRed = 15; playSound(sfxDisorder); break; 
        case "rush": 
            akaza.attackWindup = 15; akaza.attackDuration = 60; playSound(sfxSwiftDash); break;
        case "eight_layered": 
            akaza.attackWindup = 25; akaza.attackDuration = 55; akaza.flashRed = 25; playSound(sfxEightLayered); break;
        case "annihilation": 
            akaza.attackWindup = 60; akaza.attackDuration = 60; akaza.flashRed = 40; playSound(sfxReveal); break;
        case "crown_splitter": 
            akaza.attackWindup = 20; akaza.attackDuration = 100; akaza.flashRed = 20; playSound(sfxBigLeap); break;
        case "chaotic_afterglow": 
            akaza.chaoticUses++; 
            akaza.attackWindup = 100;
            akaza.attackDuration = 1180; // Final form barrage, still long but capped for performance
            akaza.flashRed = 60;
            akaza.comboStep = 0;
            akaza.afterglowCloseHitTimer = 0;
            impactFrameTimer = 72; 
            lightImpactFrameTimer = Math.max(lightImpactFrameTimer, 30);
            startCameraShake(115, 42);
            playSound(sfxBruteSlam); 
            createBossSmoke(akaza.x + akaza.width/2, akaza.y + akaza.height, 220); 
            // Huge dramatic stomp shockwave: warning first, lethal pulse second.
            pushShockwave(akaza.x + akaza.width / 2, akaza.y + akaza.height - 4, 2050, 0, akaza, "#ffffff", 70, 18);
            pushShockwave(akaza.x + akaza.width / 2, akaza.y + akaza.height - 4, 1900, 28 * akaza.damageScale, akaza, "#38bdf8", 54, 34);
            pushStatusText(akaza.x + akaza.width / 2, akaza.y - 46, "CHAOTIC AFTERGLOW! GET AWAY!", "#e0f2fe", 135);
            break;
    }
}

function processAkazaAttack(dt, realDt, dist, dir) {
    if (akaza.attackWindup > 0) {
        akaza.attackWindup -= realDt;
        if (akaza.currentAttack === "annihilation" && akaza.attackWindup <= 0) {
            akaza.dashTargetX = player.x + (player.width / 2) + dir * 100; playSound(sfxRush);
        }
        if (akaza.currentAttack === "air_type") akaza.y -= 12 * dt; 
        if (akaza.currentAttack === "crown_splitter" && akaza.attackWindup <= 0) akaza.y = -200; 
        return;
    }

    akaza.attackDuration -= realDt;
    const isDone = akaza.attackDuration <= 0;

    switch (akaza.currentAttack) {
        case "air_type": 
            akaza.y = akaza.targetY - 140 + Math.sin(akaza.attackDuration * 0.2) * 10;
            if (Math.floor(akaza.attackDuration) % 15 <= 1 && akaza.comboStep < 5) {
                akaza.comboStep++; playSound(sfxAirType);
                pushShockwave(akaza.x + akaza.width/2 + (dir*20), akaza.y + 40, 58, 0, akaza, "#38bdf8", 12, 3); pushClashSparks(akaza.x + akaza.width/2 + dir * 24, akaza.y + 34, 8, "#38bdf8");
                const angle = Math.atan2((player.y + player.height/2) - (akaza.y + 20), (player.x + player.width/2) - (akaza.x + akaza.width/2));
                const vSpeed = 18;
                pushProjectile({ x: akaza.x + akaza.width / 2, y: akaza.y + 20 + Math.random()*20, vx: Math.cos(angle)*vSpeed, vy: Math.sin(angle)*vSpeed, radius: 14, coreRadius: 8, color: "#38bdf8", damage: 2 * akaza.damageScale, deflected: false });
                startCameraShake(5, 3); 
            } break;

        case "leg_type": 
            if (akaza.comboStep === 0) {
                akaza.comboStep = 1; 
                playSound(sfxLegType); playSound(sfxSwiftDash);
                pushShockwave(akaza.x + akaza.width/2, akaza.y + akaza.height, 185, 4 * akaza.damageScale, akaza, "#0ea5e9", 14, 6);
                pushShockwave(akaza.x + akaza.width/2 + dir * 38, akaza.y + akaza.height - 18, 115, 0, akaza, "#38bdf8", 18, 4);
                pushProjectile({ x: akaza.x + akaza.width / 2, y: akaza.y + akaza.height - 10, vx: dir * 48, vy: 0, radius: 24, coreRadius: 12, color: "#0ea5e9", damage: 5.5 * akaza.damageScale, deflected: false });
                pushClashSparks(akaza.x + akaza.width/2 + dir * 70, akaza.y + akaza.height - 22, 22, "#38bdf8");
                pushParrySlash(akaza.x + akaza.width/2 + dir * 86, akaza.y + akaza.height - 42);
                startCameraShake(10, 6);
            } break;
            
        case "disorder": 
            if (Math.floor(akaza.attackDuration) % 6 <= 1) {
                const hx = akaza.x + (dir === 1 ? akaza.width : -120);
                pushClashSparks(hx + Math.random()*120, akaza.y + Math.random()*akaza.height, 5, "#38bdf8");
                pushShockwave(hx + Math.random()*40, akaza.y + 20 + Math.random()*60, 45, 0, akaza, "#38bdf8", 14, 2);
                if (rectsOverlap({x: hx, y: akaza.y, width: 120, height: akaza.height}, getPlayerBox()) || (isFormDefenseActive() && rectsOverlap({x: hx, y: akaza.y, width: 120, height: akaza.height}, getActiveFormParryBox()))) handleGuardOrParryAgainstPhysical(akaza, 1.5 * akaza.damageScale); 
                playSound(sfxDisorder);
            } break;
            
        case "rush": 
            akaza.x += dir * 8.5 * dt;
            if (Math.floor(akaza.attackDuration) % 10 <= 1) pushShockwave(akaza.x + akaza.width/2, akaza.y + akaza.height - 6, 42, 0, akaza, "#e0f2fe", 14, 2);
            if (Math.floor(akaza.attackDuration) % 20 <= 1 && akaza.comboStep < 3) {
                akaza.comboStep++; playSound(sfxRush);
                pushShockwave(akaza.x + akaza.width/2, akaza.y + 40, 70, 0, akaza, "#ffffff", 12, 3);
                if (dist < 80 || (isFormDefenseActive() && rectsOverlap(getActiveFormParryBox(), { x: akaza.x - 90, y: akaza.y, width: akaza.width + 180, height: akaza.height }))) handleGuardOrParryAgainstPhysical(akaza, 4 * akaza.damageScale); 
                pushClashSparks(akaza.x + (dir===1?akaza.width:0), akaza.y + 40, 10, "#ffffff");
            } break;

        case "eight_layered": 
            akaza.x += dir * 4.8 * dt; 
            if (Math.floor(akaza.attackDuration) % 12 <= 1) pushShockwave(akaza.x + akaza.width/2, akaza.y + akaza.height/2, 44, 0, akaza, "#38bdf8", 12, 2);
            if (Math.floor(akaza.attackDuration) % 6 <= 1 && akaza.comboStep < 8) {
                akaza.comboStep++; playSound(sfxEightLayered);
                const hx = akaza.x + (dir === 1 ? akaza.width : -80);
                pushShockwave(hx + Math.random()*40, akaza.y + Math.random()*akaza.height, 65, 0, akaza, "#38bdf8", 12, 4);
                if (rectsOverlap({x: hx, y: akaza.y, width: 80, height: akaza.height}, getPlayerBox()) || (isFormDefenseActive() && rectsOverlap({x: hx, y: akaza.y, width: 80, height: akaza.height}, getActiveFormParryBox()))) handleGuardOrParryAgainstPhysical(akaza, 2 * akaza.damageScale); 
                pushClashSparks(akaza.x + (dir===1?akaza.width:0), akaza.y + Math.random()*akaza.height, 12, "#38bdf8");
                startCameraShake(4, 3); 
            } break;

        case "annihilation": 
            akaza.x += (akaza.dashTargetX - akaza.x) * 0.3 * dt;
            pushJumpBurst(akaza.x + akaza.width/2, akaza.y + akaza.height/2, "jump");
            if (akaza.attackDuration > 10 && (dist < 70 || (isFormDefenseActive() && rectsOverlap(getActiveFormParryBox(), { x: akaza.x - 110, y: akaza.y, width: akaza.width + 220, height: akaza.height }))) && akaza.comboStep === 0) {
                akaza.comboStep = 1; 
                handleGuardOrParryAgainstPhysical(akaza, 25 * akaza.damageScale); 
                impactFrameTimer = 12; 
                startCameraShake(35, 25); 
                playSound(sfxAnnihilation); playSound(sfxClash);
                pushShockwave(akaza.x + akaza.width/2, akaza.y + akaza.height/2, 450, 0, akaza, "#f43f5e", 26, 12);
            } break;

        case "crown_splitter": 
            if (akaza.comboStep === 0) {
                akaza.x = player.x + player.width/2 - akaza.width/2; 
                akaza.y += 40 * dt; 
                if (akaza.y >= akaza.targetY) {
                    akaza.y = akaza.targetY; 
                    akaza.comboStep = 1; 
                    playSound(sfxCrownSplitter); 
                    playSound(sfxBruteSlam); 
                    impactFrameTimer = 15; 
                    startCameraShake(20, 15);
                    pushShockwave(akaza.x + akaza.width/2, akaza.y + akaza.height - 5, 260, 15 * akaza.damageScale, akaza, "#fb923c", 18, 8); 
                    addFoamBurst(akaza.x + akaza.width/2, akaza.y + akaza.height, 35);
                }
            } break;

        case "chaotic_afterglow": 
            if (akaza.comboStep === 0) {
                akaza.comboStep = 1;
                playSound(sfxChaoticAfterglow);
                impactFrameTimer = Math.max(impactFrameTimer, 28);
                lightImpactFrameTimer = Math.max(lightImpactFrameTimer, 14);
                startCameraShake(42, 26);
                const burstCX = akaza.x + akaza.width / 2;
                const burstCY = akaza.y + akaza.height / 2;
                for (let j = 0; j < 16; j++) {
                    const a = (Math.PI * 2 * j) / 16 + (Math.random() - 0.5) * 0.16;
                    pushAfterglowFistStreak(burstCX + Math.cos(a) * 18, burstCY + Math.sin(a) * 18, a, 190 + Math.random() * 110, j % 3 === 0 ? "#ffffff" : "#38bdf8");
                }
            }

            // Close-range punishment: guarding should not let the player hug Akaza and auto-block everything.
            // These are physical punch shockwaves around his body, so they still chip hard through guard.
            akaza.afterglowCloseHitTimer = Math.max(0, (akaza.afterglowCloseHitTimer || 0) - realDt);
            const centerX = akaza.x + akaza.width / 2;
            const centerY = akaza.y + akaza.height / 2;
            const playerCX = player.x + player.width / 2;
            const playerCY = player.y + player.height / 2;
            const closeDist = distanceBetween(centerX, centerY, playerCX, playerCY);
            const afterglowDangerRadius = 520;
            if (closeDist < afterglowDangerRadius && akaza.afterglowCloseHitTimer <= 0) {
                akaza.afterglowCloseHitTimer = 15;
                const punchAngle = Math.atan2(playerCY - centerY, playerCX - centerX);
                for (let j = 0; j < 14; j++) {
                    const a = punchAngle + (Math.random() - 0.5) * 1.85;
                    const sx = centerX + Math.cos(a) * (38 + Math.random() * 105);
                    const sy = centerY + Math.sin(a) * (22 + Math.random() * 64);
                    const punchColor = Math.random() < 0.48 ? "#ffffff" : Math.random() < 0.76 ? "#e0f2fe" : "#38bdf8";
                    pushAfterglowFistStreak(sx, sy, a, 245 + Math.random() * 175, punchColor);
                    if (j < 7) {
                        pushShockwave(sx + Math.cos(a) * 72, sy + Math.sin(a) * 26, 210 + Math.random() * 120, 0, akaza, punchColor, 30, 13);
                    }
                }
                pushClashSparks(playerCX, playerCY, 42, "#e0f2fe");
                pushStatusText(playerCX, playerCY - 42, "GET OUT OF RANGE!", "#f43f5e", 44);
                handlePlayerDamage(38 * akaza.damageScale, { ignoreGuard: true, ignoreFormDefense: true, ignoreInvincibility: true, invincibleFrames: 4 });
                startCameraShake(24, 18);
            }

            if (Math.floor(akaza.attackDuration) % 5 <= 1) { 
                const shots = akaza.attackDuration > 820 ? 5 : 4;
                for (let extra = 0; extra < 3; extra++) {
                    const a = Math.random() * Math.PI * 2;
                    pushAfterglowFistStreak(centerX + Math.cos(a) * 28, centerY + Math.sin(a) * 18, a, 170 + Math.random() * 120, Math.random() < 0.45 ? "#ffffff" : "#38bdf8");
                }
                for (let i = 0; i < shots; i++) {
                    const side = Math.random() < 0.5 ? -1 : 1;
                    const fistX = centerX + side * (24 + Math.random() * 42);
                    const fistY = centerY - 18 + (Math.random() - 0.5) * 72;
                    let angle;
                    if (Math.random() < 0.7) {
                        // Bias left/right so it spreads across the stage instead of mostly up/down.
                        angle = (side < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 0.9;
                    } else {
                        angle = Math.atan2(playerCY - fistY, playerCX - fistX) + (Math.random() - 0.5) * 0.75;
                    }
                    const vSpeed = Math.random() * 14 + 27;
                    const color = Math.random() < 0.34 ? "#ffffff" : Math.random() < 0.72 ? "#e0f2fe" : "#38bdf8";
                    pushAfterglowFistStreak(fistX, fistY, angle, 190 + Math.random() * 150, color);
                    pushProjectile({ 
                        x: fistX + Math.cos(angle) * 24, 
                        y: fistY + Math.sin(angle) * 12, 
                        vx: Math.cos(angle) * vSpeed, 
                        vy: Math.sin(angle) * vSpeed, 
                        radius: Math.random() * 13 + 22, 
                        coreRadius: 10, 
                        color, 
                        damage: 25 * akaza.damageScale, 
                        deflected: false,
                        style: "chaotic",
                        duration: 112
                    });

                    if (i < 2) {
                        const waveX = fistX + Math.cos(angle) * (70 + Math.random() * 80);
                        const waveY = fistY + Math.sin(angle) * (30 + Math.random() * 30);
                        pushShockwave(waveX, waveY, Math.random() * 115 + 140, 0, akaza, color, Math.random() * 10 + 22, 8);
                    }
                }
                pushClashSparks(centerX + (Math.random() - 0.5) * 210, centerY + (Math.random() - 0.5) * 130, 18, Math.random() < 0.5 ? "#38bdf8" : "#ffffff");
                startCameraShake(8, 6.5); 
            } break;
    }

    if (isDone) {
        akaza.state = "idle"; akaza.currentAttack = null; 
        const hpPct = Math.max(0, akaza.health / akaza.maxHealth);
        akaza.actionTimer = 85 * Math.max(0.4, hpPct); 
        akaza.y = akaza.targetY;
    }
}


function finishAkazaVictory(source = "player") {
    if (gameWon || gameOver || !akaza) return;

    const victoryX = akaza.x + akaza.width / 2;
    const victoryY = akaza.y + akaza.height / 2;

    akaza.health = 0;
    gameWon = true;
    gameOver = false;
    endSequenceTimer = 0;
    spawnTimer = 0;

    // Stop the run instantly and cleanly. No more attacks, spawns, or lingering final-form sounds.
    freezeRunAfterEnd();

    score += 50000;
    addFoamBurst(victoryX, victoryY, 100);
    startCameraShake(50, 25);
    scheduleResultScreen(900);
}


function handlePlayerAttackAgainstBoss() {
    if (!akaza || akazaIntro.active || akaza.health <= 0) return;
    if (!player.isAttacking || player.attackFrame <= 1) return;
    if (player.hitTargets.has("akaza")) return;
    if (player.currentForm === 0 && player.m1AlreadyHit) return;

    const hitBoss = rectsOverlap(player.attackBox, akaza);
    if (hitBoss) {
        if (akaza.invulnerable) { playSound(sfxParryClang); pushClashSparks(akaza.x + akaza.width/2, akaza.y + akaza.height/2, 20, "#38bdf8"); return; }
        if (player.currentForm < 5) playSound(sfxDemonHit); 

        let damageValue = attackDamage[player.currentForm] * 3.5;
        akaza.health -= damageValue; player.hitTargets.add("akaza");
        if (player.currentForm === 0) player.m1AlreadyHit = true;
        
        addFoamBurst(akaza.x + akaza.width / 2, akaza.y + akaza.height / 2, 8); 
        pushClashSparks(akaza.x + akaza.width / 2, akaza.y + akaza.height / 2, 12, "#ffffff"); 
        
        if (player.currentForm === 5) { akaza.stunnedTimer = Math.max(akaza.stunnedTimer, 125); pushStunText(akaza.x + akaza.width / 2, akaza.y - 22); addSunFlareBurst(akaza.x + akaza.width / 2, akaza.y + akaza.height / 2, 36); }
        combo++; comboTimer = 240; score += player.currentForm >= 5 ? 95 : 50;
        
        if (akaza.health <= 0) {
            finishAkazaVictory("direct_hit");
        }
    }
}

function createAkazaSmoke(x, y, amount) { akazaIntro.smoke = []; for (let i = 0; i < amount; i++) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 8 + 2; const wide = Math.random() * 190; akazaIntro.smoke.push({ x: x + Math.cos(angle) * wide * 0.35, y: y - Math.random() * 45, vx: Math.cos(angle) * speed, vy: -Math.random() * 4 - 0.5, radius: Math.random() * 38 + 24, alpha: Math.random() * 0.18 + 0.22, grow: Math.random() * 0.25 + 0.12, drift: Math.random() * Math.PI * 2 }); } }
function createAkazaShockRings(x, y) { akazaIntro.shockRings = []; for (let i = 0; i < 4; i++) akazaIntro.shockRings.push({ x, y, radius: 18 + i * 16, maxRadius: 260 + i * 80, alpha: 1 - i * 0.15, speed: 7 + i * 1.5 }); }
function updateAkazaSmoke(dt) { for (let i = akazaIntro.smoke.length - 1; i >= 0; i--) { const s = akazaIntro.smoke[i]; s.drift += 0.03 * dt; s.x += (s.vx + Math.sin(s.drift) * 0.7) * dt; s.y += s.vy * dt; s.vx *= 0.982; s.vy *= 0.985; s.radius += s.grow * dt; if (akazaIntro.phase >= 4) s.alpha -= 0.018 * dt; if (s.alpha <= 0) akazaIntro.smoke.splice(i, 1); } }
function updateAkazaShockRings(dt) { for (let i = akazaIntro.shockRings.length - 1; i >= 0; i--) { const r = akazaIntro.shockRings[i]; r.radius += r.speed * dt; r.alpha -= 0.018 * dt; if (r.radius >= r.maxRadius || r.alpha <= 0) akazaIntro.shockRings.splice(i, 1); } }

function drawAkaza() {
    if (!akaza || akaza.health <= 0 && !gameWon) return;
    const x = akaza.x - cameraX; const y = akaza.y;
    if (akaza.flashRed > 0) { ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(akaza.flashRed * 0.4) * 0.2; ctx.fillStyle = "#ef4444"; ctx.fillRect(x - 20, y - 10, akaza.width + 40, akaza.height + 20); ctx.restore(); }
    if (akaza.invulnerable) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#38bdf8"; ctx.fillRect(x, y, akaza.width, akaza.height); ctx.restore(); }

    ctx.save(); ctx.translate(x + akaza.width / 2, y + akaza.height / 2); ctx.rotate(akaza.bodyRotation); 
    if (akaza.state === "attacking" && akaza.currentAttack === "leg_type") { ctx.rotate(akaza.facing === "right" ? Math.PI/4 : -Math.PI/4); } 
    ctx.translate(-akaza.width / 2, -akaza.height / 2);

    if (akaza.pose === "falling") drawBlockyAkazaFalling(0, 0);
    else if (akaza.pose === "kneeling") drawBlockyAkazaKneeling(0, 0);
    else if (akaza.pose === "standingUp") drawBlockyAkazaStandingUp(0, 0, akazaIntro.standingProgress);
    else drawBlockyAkazaStanding(0, 0);
    ctx.restore();

    if (!akazaIntro.active && akaza.health > 0) {
        const barW = 800; const barH = 20; const hx = canvas.width/2 - barW/2; const hy = canvas.height - 60;
        ctx.save(); ctx.fillStyle = "#000000"; ctx.fillRect(hx, hy, barW, barH); ctx.fillStyle = "#f43f5e"; ctx.fillRect(hx, hy, barW * (akaza.health / akaza.maxHealth), barH); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.strokeRect(hx, hy, barW, barH); ctx.fillStyle = "#ffffff"; ctx.font = `bold 24px ${PIXEL_FONT}`; ctx.fillText("AKAZA - UPPER MOON 3", hx, hy - 10); ctx.restore();
    }
}

// ==========================================
// AKAZA NEW VISUALS (White Skin, Pink Vest)
// ==========================================
function drawBlockyAkazaFalling(x, y) { ctx.save(); ctx.fillStyle = "#ec4899"; ctx.fillRect(x + 18, y + 24, 28, 34); ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 12, y + 54, 42, 18); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 2, y + 30, 18, 12); ctx.fillRect(x + 42, y + 30, 18, 12); ctx.fillRect(x + 15, y + 70, 12, 25); ctx.fillRect(x + 36, y + 70, 12, 25); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 17, y + 4, 30, 24); ctx.fillStyle = "#f472b6"; ctx.fillRect(x + 14, y, 36, 10); ctx.fillRect(x + 18, y - 5, 28, 8); ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y + 30); ctx.lineTo(x + 44, y + 50); ctx.moveTo(x + 44, y + 30); ctx.lineTo(x + 20, y + 50); ctx.stroke(); ctx.restore(); }
function drawBlockyAkazaKneeling(x, y) { ctx.save(); ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 34, y + 72, 32, 14); ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 9, y + 65, 22, 26); ctx.fillStyle = "#ec4899"; ctx.fillRect(x + 20, y + 35, 30, 34); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 5, y + 62, 18, 12); ctx.fillRect(x + 45, y + 60, 18, 12); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 19, y + 14, 30, 24); ctx.fillStyle = "#f472b6"; ctx.fillRect(x + 16, y + 8, 36, 10); ctx.fillRect(x + 21, y + 3, 26, 8); ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 23, y + 42); ctx.lineTo(x + 48, y + 62); ctx.moveTo(x + 48, y + 42); ctx.lineTo(x + 23, y + 62); ctx.stroke(); ctx.fillStyle = "#38bdf8"; ctx.fillRect(x + 36, y + 24, 8, 4); ctx.restore(); }
function drawBlockyAkazaStandingUp(x, y, progress) { const kneelOffset = (1 - progress) * 20; ctx.save(); ctx.translate(0, kneelOffset); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 15, y + 62, 12, 33); ctx.fillRect(x + 38, y + 62, 12, 33); ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 10, y + 54, 45, 23); ctx.fillStyle = "#ec4899"; ctx.fillRect(x + 17, y + 25, 32, 36); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 3, y + 34, 13, 35); ctx.fillRect(x + 50, y + 34, 13, 35); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 18, y + 4, 30, 24); ctx.fillStyle = "#f472b6"; ctx.fillRect(x + 15, y - 2, 36, 10); ctx.fillRect(x + 20, y - 7, 26, 8); ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y + 32); ctx.lineTo(x + 47, y + 52); ctx.moveTo(x + 47, y + 32); ctx.lineTo(x + 20, y + 52); ctx.stroke(); ctx.fillStyle = "#38bdf8"; ctx.fillRect(x + 25, y + 14, 7, 4); ctx.fillRect(x + 38, y + 14, 7, 4); ctx.restore(); }
function drawBlockyAkazaStanding(x, y) { ctx.save(); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 15, y + 62, 12, 33); ctx.fillRect(x + 38, y + 62, 12, 33); ctx.fillStyle = "#f8fafc"; ctx.fillRect(x + 10, y + 54, 45, 23); ctx.fillStyle = "#ec4899"; ctx.fillRect(x + 17, y + 25, 32, 36); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 3, y + 34, 13, 35); ctx.fillRect(x + 50, y + 34, 13, 35); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 18, y + 4, 30, 24); ctx.fillStyle = "#f472b6"; ctx.fillRect(x + 15, y - 2, 36, 10); ctx.fillRect(x + 20, y - 7, 26, 8); ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y + 32); ctx.lineTo(x + 47, y + 52); ctx.moveTo(x + 47, y + 32); ctx.lineTo(x + 20, y + 52); ctx.stroke(); ctx.fillStyle = "#38bdf8"; ctx.fillRect(x + 25, y + 14, 7, 4); ctx.fillRect(x + 38, y + 14, 7, 4); ctx.restore(); }

function drawAkazaCompass() {
    if (!akaza) return;
    const cx = akaza.x + akaza.width / 2 - cameraX; const cy = akaza.y + akaza.height;
    if (akazaIntro.compassRedAlpha > 0) {
        ctx.save(); ctx.globalAlpha = akazaIntro.compassRedAlpha; ctx.fillStyle = "#8b0000"; ctx.shadowBlur = 40; ctx.shadowColor = "#ff0000";
        ctx.beginPath(); ctx.ellipse(cx, cy, akazaIntro.compassRadius, akazaIntro.compassRadius * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    
    const bAlpha = akazaIntro.active ? akazaIntro.compassBlueAlpha : akaza.compassFadeAlpha;
    if (bAlpha > 0) {
        ctx.save(); ctx.globalAlpha = bAlpha; ctx.fillStyle = "rgba(6, 182, 212, 0.2)"; ctx.shadowBlur = 40; ctx.shadowColor = "#06b6d4";
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(cx, cy, akazaIntro.compassRadius, akazaIntro.compassRadius * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(56, 189, 248, 0.6)"; ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) { let angle = (i * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * akazaIntro.compassRadius, cy + Math.sin(angle) * akazaIntro.compassRadius * 0.3); ctx.stroke(); } 
        ctx.restore();
    }
}
function drawAkazaSmoke() { if (!akazaIntro.active && akazaIntro.smoke.length <= 0) return; akazaIntro.smoke.forEach((s) => { ctx.save(); ctx.globalAlpha = s.alpha * akazaIntro.smokeAlpha * 0.55; ctx.fillStyle = "#1f2937"; ctx.shadowBlur = 20; ctx.shadowColor = "#020617"; ctx.beginPath(); ctx.arc(s.x - cameraX, s.y, s.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(148,163,184,0.28)"; ctx.beginPath(); ctx.arc(s.x - cameraX - s.radius * 0.25, s.y - s.radius * 0.18, s.radius * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }); }
function drawAkazaShockRings() { if (!akazaIntro.active) return; akazaIntro.shockRings.forEach((r) => { ctx.save(); ctx.globalAlpha = r.alpha; ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(r.x - cameraX, r.y, r.radius * 1.45, r.radius * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x - cameraX, r.y, r.radius * 1.15, r.radius * 0.16, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }); }
function drawAkazaLetterbox() { if (!akazaIntro.active && akazaIntro.letterbox <= 0) return; ctx.save(); const h = akazaIntro.letterbox; ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, canvas.width, h); ctx.fillRect(0, canvas.height - h, canvas.width, h); if (akazaIntro.dialogue) { ctx.textAlign = "center"; ctx.font = `bold 28px ${PIXEL_FONT}`; ctx.strokeStyle = "#000000"; ctx.lineWidth = 5; const dY = canvas.height - h / 2 + 10; ctx.strokeText(akazaIntro.dialogue, canvas.width / 2, dY); ctx.fillStyle = akazaIntro.dialogue.startsWith("akaza") ? "#f472b6" : "#38bdf8"; ctx.fillText(akazaIntro.dialogue, canvas.width / 2, dY); ctx.textAlign = "start"; } ctx.restore(); }

function showResultScreen() {
    if (endScreenShown) return;
    if (gameState !== "playing") return;
    if (!(gameOver || gameWon)) return;
    cancelPlayerActionState({ resetCooldowns: false, clearTrails: true });
    endScreenShown = true;

    const endScreen = document.getElementById("endScreen");
    const endTitle = document.getElementById("endTitle");
    const endSubtext = document.getElementById("endSubtext");
    const endBadge = document.getElementById("endResultBadge");
    const endMode = document.getElementById("endMode");
    const endScore = document.getElementById("endScore");
    const submitButton = document.getElementById("btnSubmitScore");
    const status = document.getElementById("endSaveStatus");

    if (!endScreen || !endTitle || !endScore) return;

    recordPlayerCurrentScore(currentMode, score, { updateHighest: false });

    endScreen.style.display = "flex";
    endScreen.style.pointerEvents = "auto";
    endScreen.classList.add("active");
    endTitle.innerText = gameWon ? "VICTORY" : "DEFEAT";
    endTitle.className = gameWon ? "victory" : "defeat";
    if (endSubtext) endSubtext.innerText = gameWon ? "Akaza defeated. Run complete." : "You fell in battle. Save your score?";
    if (endBadge) {
        endBadge.innerText = gameWon ? "BOSS CLEARED" : "RUN ENDED";
        endBadge.className = gameWon ? "result-badge victory" : "result-badge defeat";
    }
    if (endMode) endMode.innerText = `Mode: ${currentMode.toUpperCase()}`;
    endScore.innerText = `Final Score: ${score.toLocaleString()}`;
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = "SAVE SCORE"; }
    if (status) status.textContent = "Save your score or return to menu.";
    prefillResultName();
}

// =====================================================
// UPDATE PIPELINE
// =====================================================
function update() {
    if (gameState !== "playing") return;
    
    const realDt = globalDt; 
    let dt = timeScale * globalDt;
    
    if (gameOver || gameWon) {
        if (!endMusicStopped) {
            endMusicStopped = true;
            freezeRunAfterEnd();
        }
        endSequenceTimer += realDt;
        if (endSequenceTimer > 95) showResultScreen();
        return; 
    }

    updateBreathingSound();
    if (isCutsceneOrPopupActive()) resetInputState();
    if (!BOSS_TEST_MODE) { updateEnemyRevealPopup(); checkEnemyMilestones(); }

    if (akaza || akazaIntro.active) {
        if (akazaIntro.active) { updateAkazaIntro(realDt); dt = timeScale * globalDt; } else { updateAkazaBoss(realDt); }
    }

    if (akaza && !akazaIntro.active && akaza.health <= 0 && !gameWon) {
        finishAkazaVictory("health_check");
        return;
    }

    // G breathing no longer slows the whole game. It only restores breathing while leaving the player vulnerable.
    updateTimers(dt, realDt);

    if (!akazaIntro.active) { updatePlayerMovement(dt); updatePlayerAttack(dt); handlePlayerAttackAgainstBoss(); }
    if (gameOver || gameWon) return;
    updateParticlesAndTrails(dt); updateJumpBursts(dt); updateShockwaves(dt); updateHealTexts(dt); updateProjectiles(dt);
    if (gameOver || gameWon) return;
    updateDemons(dt); updateHealthDrops(dt); updateCamera(dt); updateBossSmoke(dt);
}

function updateTimers(dt, realDt = 1) {
    if (damageFlashTimer > 0) damageFlashTimer -= dt;
    if (player.invincibleTimer > 0) player.invincibleTimer -= dt; if (player.guardCooldown > 0) player.guardCooldown -= dt; if (player.jumpSquash > 0) player.jumpSquash -= dt; if (player.landingSquash > 0) player.landingSquash -= dt;
    if (player.dashCharges < player.maxDashCharges) { player.dashRechargeTimer -= dt; if (player.dashRechargeTimer <= 0) { player.dashCharges++; if (player.dashCharges < player.maxDashCharges) player.dashRechargeTimer = player.dashRechargeDelay; else player.dashRechargeTimer = 0; } }
    if (player.totalConcentrationActive) { player.totalConcentrationTimer -= realDt; if (player.totalConcentrationTimer <= 0) { player.totalConcentrationActive = false; player.totalConcentrationTimer = 0; } }
    if (player.totalConcentrationCooldown > 0) { player.totalConcentrationCooldown -= realDt; if (player.totalConcentrationCooldown < 0) player.totalConcentrationCooldown = 0; }
    if (player.isGuarding) player.guardFrame += dt; if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; } for (const key in formCooldowns) { if (formCooldowns[key] > 0) formCooldowns[key] -= dt; } if (player.isStunned) { player.stunTimer -= dt; if (player.stunTimer <= 0) player.isStunned = false; }
    if (impactFrameTimer > 0) impactFrameTimer -= dt;
    if (lightImpactFrameTimer > 0) lightImpactFrameTimer -= dt;
    if (player.formParryLock > 0) player.formParryLock -= dt;
}

function updatePlayerMovement(dt) {
    if (player.isDashing) { player.x += player.dashDir * 18 * dt; player.dashTimer -= dt; if (player.dashTimer <= 0) player.isDashing = false; player.x = clamp(player.x, 0, MAP_WIDTH - player.width); return; }
    
    // Total concentration regen
    if (player.totalConcentrationActive && !player.isAttacking && !player.isStunned) {
        player.breathing = Math.min(player.maxBreathing, player.breathing + 1.0 * dt);
    }
    
    // Active Breathing (G key)
    // Important: this is NOT guard. No damage reduction, no parry, no HP regen, and no global slow motion.
    if (keys.G && player.isGrounded && !player.isAttacking && !player.isGuarding && !player.isStunned) { 
        player.breathing = Math.min(player.maxBreathing, player.breathing + 1.2 * dt); 
        player.bodyRotation = Math.sin(Date.now() / 40) * 0.05; 
    }
    
    // True Passive Breathing (doing nothing special)
    if (!keys.G && !player.isAttacking && !player.isDashing && !player.isGuarding && !player.totalConcentrationActive && player.isGrounded) {
        player.breathing = Math.min(player.maxBreathing, player.breathing + 0.05 * dt); // MUCH SLOWER
    }
    
    if (!player.isStunned) {
        if (keys.W && player.isGrounded && !player.isAttacking && !player.isGuarding && !keys.G) { player.vy = -13.4; player.isGrounded = false; player.jumpSquash = 10; playSound(sfxJump); addFoamBurst(player.x + player.width / 2, player.y + player.height, 14); pushJumpBurst(player.x + player.width / 2, player.y + player.height, "jump"); }
        const moveSpeed = player.isGuarding ? player.speed * player.guardSpeedMultiplier : (keys.G ? player.speed * 0.38 : player.speed);
        if (keys.Left && !player.isAttacking) { player.x -= moveSpeed * dt; player.facing = "left"; player.bodyRotation = player.isGrounded ? -0.08 : -0.18; } else if (keys.Right && !player.isAttacking) { player.x += moveSpeed * dt; player.facing = "right"; player.bodyRotation = player.isGrounded ? 0.08 : 0.18; } else if (!player.isAttacking && !player.isGuarding && !keys.G) { player.bodyRotation *= 0.84; }
    }
    if (!player.isGrounded) { player.vy += 0.56 * dt; player.y += player.vy * dt; if (player.vy < 0) player.bodyRotation += (player.facing === "right" ? 0.01 : -0.01) * dt; else player.bodyRotation += (player.facing === "right" ? -0.008 : 0.008) * dt; if (player.y >= player.baseY) { player.y = player.baseY; player.isGrounded = true; player.vy = 0; player.landingSquash = 9; addFoamBurst(player.x + player.width / 2, player.y + player.height, 10); pushJumpBurst(player.x + player.width / 2, player.y + player.height, "land"); startCameraShake(4, 2.5); } }
    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);
}

function updateCamera(dt) {
    let targetCamX; if (akazaIntro.active && akaza) targetCamX = akazaIntro.cameraFocusX - canvas.width / 2; else targetCamX = player.x - canvas.width / 2;
    cameraX += (targetCamX - cameraX) * 0.08; cameraX = clamp(cameraX, 0, MAP_WIDTH - canvas.width);
    if (shakeTimer > 0) { shakeTimer -= dt; screenShakeX = (Math.random() - 0.5) * shakeStrength; screenShakeY = (Math.random() - 0.5) * shakeStrength; } else { screenShakeX = 0; screenShakeY = 0; }
}

function updatePlayerAttack(dt) {
    if (!player.isAttacking) return;
    if (gameState !== "playing" || gameOver || gameWon) {
        cancelPlayerActionState({ resetCooldowns: false, clearTrails: true });
        return;
    }

    player.attackFrame += dt;
    const f = player.attackFrame;
    const totalF = player.maxAttackFrames;
    const pct = clamp(f / totalF, 0, 1);
    const direction = player.facing === "right" ? 1 : -1;

    if (player.currentForm === 2 || player.currentForm === 3) {
        if (Math.floor(f) % 15 === 0) player.hitTargets.clear();
    } else if (player.currentForm === 4) {
        if (Math.floor(f) % 25 === 0) player.hitTargets.clear();
    } else if (player.currentForm === 5) {
        if (Math.floor(f) % 12 === 0) player.hitTargets.clear();
    }

    if (isWaterDefenseFormActive()) {
        player.invincibleTimer = Math.max(player.invincibleTimer, 5);
    }

    if (isSunDanceActive()) {
        // Sun Breathing 1st Form: SUN DANCE is the ultimate form: full protection while attacking.
        player.invincibleTimer = Math.max(player.invincibleTimer, 9);
        damageFlashTimer = Math.max(damageFlashTimer, 5);
    }

    if (player.currentForm === 1) { 
        player.x += direction * 4.2 * dt; 
        player.attackBox.width = 175; 
        player.attackBox.height = 175; 
        player.attackBox.y = player.y - 45; 
    } else if (player.currentForm === 2) {
        const arcH = Math.sin(pct * Math.PI) * 170;
        player.y = player.baseY - arcH;
        player.x += direction * 3.5 * dt;
        player.bodyRotation = pct * Math.PI * 2 * direction;
        player.attackBox.width = 175;
        player.attackBox.height = 175;
        player.attackBox.y = player.y - 48;
    } else if (player.currentForm === 3) {
        const leapHeight = 145;
        const leapIn = clamp(pct / 0.18, 0, 1);
        const hoverWave = Math.sin(f * 0.18) * 5;
        if (pct < 0.18) player.y = player.baseY - Math.sin(leapIn * Math.PI * 0.5) * leapHeight;
        else if (pct < 0.88) { player.y = player.baseY - leapHeight + hoverWave; player.vy = 0; }
        else { const fallPrep = clamp((pct - 0.88) / 0.12, 0, 1); player.y = player.baseY - leapHeight + hoverWave + fallPrep * 35; player.vy = 0; }
        player.isGrounded = false;
        player.bodyRotation = Math.sin(f * 0.16) * 0.16;
        player.attackBox.width = 370;
        player.attackBox.height = 370;
        player.attackBox.y = player.y + player.height / 2 - 185;
        if (Math.floor(f) % 18 === 0) addFoamBurst(player.x + player.width / 2, player.y + player.height / 2 + 45, 4);
    } else if (player.currentForm === 4) {
        updateFlowingDance(f, totalF, pct, direction, dt);
    } else if (player.currentForm === 5) {
        // Sun Dance: the original hot circular dash from the first Sun/Raging Sun build.
        const rise = Math.sin(pct * Math.PI) * 92;
        const spiral = Math.sin(pct * Math.PI * 4.2) * 16;
        player.x += direction * (7.4 + Math.sin(pct * Math.PI) * 5.2) * dt;
        player.y = player.baseY - rise + spiral;
        player.isGrounded = false;
        player.bodyRotation = direction * (pct * Math.PI * 2.65 - 0.4);
        player.attackBox.width = 470;
        player.attackBox.height = 315;
        player.attackBox.y = player.y + player.height / 2 - 185;
        if (Math.floor(f) % 2 === 0) {
            addSunFlareBurst(player.x + player.width / 2, player.y + player.height / 2, 2);
        }
        if (Math.floor(f) % 8 === 0) {
            pushParrySlash(player.x + player.width / 2 + direction * 45, player.y + player.height / 2);
        }
    } else {
        player.attackBox.width = 105;
        player.attackBox.height = 62;
        player.attackBox.y = player.y + 8;
    }

    if (player.currentForm === 3 || player.currentForm === 1 || player.currentForm === 5) {
        player.attackBox.x = player.x + player.width / 2 - player.attackBox.width / 2;
    } else {
        player.attackBox.x = player.facing === "right" ? player.x + player.width : player.x - player.attackBox.width;
    }

    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);

    if (player.currentForm !== 4 && f > 1 && Math.floor(f) % 3 === 0) {
        pushWaterTrail({ form: player.currentForm, x: player.attackBox.x, y: player.attackBox.y, w: player.attackBox.width, h: player.attackBox.height, facing: player.facing, frame: f, maxFrame: totalF, alpha: 1, playerX: player.x, playerY: player.y, m1Step: player.m1Step });
    }

    if (f >= totalF) endAttack();
}

function updateFlowingDance(frame, totalFrames, progress, direction, dt) {
    const forward = Math.sin(progress * Math.PI) * 5.5; const waveX = Math.sin(progress * Math.PI * 2.2) * 5; const waveY = Math.sin(progress * Math.PI * 4) * 24;
    player.x += (direction * forward + waveX) * dt; player.y = player.baseY + waveY; player.bodyRotation = Math.sin(progress * Math.PI * 4) * 0.38; player.attackBox.width = 330; player.attackBox.height = 165; player.attackBox.y = player.y - 48;
    if (Math.floor(frame) % 7 === 0) pushWaterTrail({ form: 4, x: player.x, y: player.y, w: player.attackBox.width, h: player.attackBox.height, facing: player.facing, frame, maxFrame: totalFrames, alpha: 1, playerX: player.x, playerY: player.y, m1Step: player.m1Step, ribbon: true }); if (Math.floor(frame) % 16 === 0) addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 3);
}

function endAttack() {
    const finishedForm = player.currentForm; if (player.currentForm > 0) formCooldowns[player.currentForm] = maxCooldowns[player.currentForm];
    player.isAttacking = false; player.attackFrame = 0; player.hitTargets.clear(); player.m1AlreadyHit = false;
    if (finishedForm === 3 || finishedForm === 5) { player.isGrounded = false; player.vy = 4.2; } else player.y = player.isGrounded ? player.baseY : player.y; player.bodyRotation = 0; player.sunSecondHitReset = false; player.sunImpactLock = false; player.formParryLock = 0; player.currentForm = 0; player.selectedForm = 0;
}

function updateParticlesAndTrails(dt) {
    for (let i = waterTrails.length - 1; i >= 0; i--) { const trail = waterTrails[i]; let fadeSpeed = 0.034; if (trail.form === 3) fadeSpeed = 0.022; if (trail.form === 4) fadeSpeed = 0.028; if (trail.form === 5) fadeSpeed = 0.018; trail.alpha -= fadeSpeed * dt; if (trail.alpha <= 0) waterTrails.splice(i, 1); }
    for (let i = foamParticles.length - 1; i >= 0; i--) { const p = foamParticles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.alpha -= p.decay * dt; if (p.alpha <= 0) foamParticles.splice(i, 1); }
    for (let i = clashSparks.length - 1; i >= 0; i--) { const s = clashSparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.92; s.vy *= 0.92; s.alpha -= 0.06 * dt; if (s.alpha <= 0) clashSparks.splice(i, 1); }
    for (let i = parrySlashes.length - 1; i >= 0; i--) { const p = parrySlashes[i]; p.radius += 9 * dt; p.alpha -= 0.055 * dt; if (p.alpha <= 0) parrySlashes.splice(i, 1); }
    for (let i = afterglowFistStreaks.length - 1; i >= 0; i--) { const s = afterglowFistStreaks[i]; s.alpha -= 0.105 * dt; s.length *= Math.pow(0.975, dt); if (s.alpha <= 0) afterglowFistStreaks.splice(i, 1); }
}
function updateJumpBursts(dt) { for (let i = jumpBursts.length - 1; i >= 0; i--) { const b = jumpBursts[i]; b.radius += b.type === "land" ? 5 * dt : 4 * dt; b.alpha -= 0.055 * dt; if (b.alpha <= 0) jumpBursts.splice(i, 1); } }
function updateShockwaves(dt) { 
    for (let i = shockwaves.length - 1; i >= 0; i--) { 
        const sw = shockwaves[i]; 
        sw.radius += sw.speed * dt; 
        sw.alpha -= 0.045 * dt; 
        const playerCenterX = player.x + player.width / 2; 
        const playerCenterY = player.y + player.height / 2; 
        const dist = distanceBetween(sw.x, sw.y, playerCenterX, playerCenterY);
        const formBox = getActiveFormDefenseBox();
        const formCenterX = formBox.x + formBox.width / 2;
        const formCenterY = formBox.y + formBox.height / 2;
        const formDist = distanceBetween(sw.x, sw.y, formCenterX, formCenterY);
        const hitPlayerWave = dist <= sw.radius + 14 && dist >= sw.radius - 40;
        const hitFormWave = isFormDefenseActive() && formDist <= sw.radius + Math.max(formBox.width, formBox.height) * 0.35 && formDist >= sw.radius - 70;
        if (!sw.hasHitPlayer && (hitPlayerWave || hitFormWave) && sw.damage > 0) { 
            sw.hasHitPlayer = true; 
            handleGuardOrParryAgainstPhysical(sw.owner, sw.damage); 
        } 
        if (sw.radius >= sw.maxRadius || sw.alpha <= 0) shockwaves.splice(i, 1); 
    } 
}
function updateHealTexts(dt) { for (let i = healTexts.length - 1; i >= 0; i--) { const h = healTexts[i]; h.y += h.vy * dt; h.life -= dt; h.alpha = h.life / (h.maxLife || 70); if (h.life <= 0) healTexts.splice(i, 1); } }

// =====================================================
// PROJECTILES
// =====================================================
function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i]; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        if (pr.duration) { pr.duration -= dt; if (pr.duration <= 0) { projectiles.splice(i, 1); continue; } }
        if (pr.x < 0 || pr.x > MAP_WIDTH) { projectiles.splice(i, 1); continue; }

        if (pr.deflected) {
            if (akaza) {
                if (pr.x > akaza.x && pr.x < akaza.x + akaza.width && pr.y > akaza.y && pr.y < akaza.y + akaza.height) {
                    akaza.health -= 5;
                    addFoamBurst(akaza.x + akaza.width / 2, akaza.y + akaza.height / 2, 8);
                    projectiles.splice(i, 1);
                    playSound(sfxProjectileHit);
                    playSound(sfxDemonHit);
                    if (akaza.health <= 0) finishAkazaVictory("deflected_projectile");
                    continue;
                }
            } else {
                for (let j = demons.length - 1; j >= 0; j--) { const d = demons[j]; if (pr.x > d.x && pr.x < d.x + d.width && pr.y > d.y && pr.y < d.y + d.height) { d.health -= 3; addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 8); projectiles.splice(i, 1); playSound(sfxProjectileHit); playSound(sfxDemonHit); if (d.health <= 0) killDemon(j, d); break; } }
            }
        } else {
            const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
            const hitPlayer = circleRectCollision(pr.x, pr.y, pr.radius, playerRect, player.isGuarding ? 42 : 6);
            const hitWaterWheel = isWaterWheelProjectileDeflectActive() && circleRectCollision(pr.x, pr.y, pr.radius, getWaterWheelDeflectBox(), 12);
            const hitAttack = isFormDefenseActive() && circleRectCollision(pr.x, pr.y, pr.radius, getActiveFormDefenseBox(), 12);

            if (hitWaterWheel) {
                deflectProjectileWithWaterWheel(pr);
                continue;
            }

            if (hitPlayer || hitAttack) {
                if (hitAttack || (hitPlayer && isFormDefenseActive())) {
                    if (isSunDanceActive()) {
                        pr.vx = -pr.vx * 1.85; pr.vy = (Math.random() - 0.5) * 4.5; pr.color = "#f97316"; pr.deflected = true;
                        addSunFlareBurst(pr.x, pr.y, 8); doFormParry(null, pr.x, pr.y);
                    } else {
                        playSound(sfxProjectileHit);
                        addFoamBurst(pr.x, pr.y, 12);
                        pushClashSparks(pr.x, pr.y, 24, "#38bdf8");
                        doFormDefense(null, pr.x, pr.y);
                        projectiles.splice(i, 1);
                    }
                } else if (player.isGuarding) { 
                    pr.vx = -pr.vx * 1.5; pr.vy = (Math.random() - 0.5) * 3; pr.color = "#38bdf8"; pr.deflected = true; addFoamBurst(pr.x, pr.y, 10); playSound(sfxParryClang); pushClashSparks(pr.x, pr.y, 20, "#fb923c"); 
                    if (isPerfectParryWindow()) { 
                        doPerfectParry(null, true); // True flag handled inside for +8 HP
                    } else { 
                        combo++; comboTimer = 240; score += 180; player.breathing = Math.min(player.maxBreathing, player.breathing + 10); 
                        // Normal guard handles 0 damage automatically via this path!
                    } 
                } else { 
                    playSound(sfxProjectileHit); handlePlayerDamage(pr.damage); projectiles.splice(i, 1); 
                }
            }
        }
    }
}

// =====================================================
// REGULAR DEMONS (Boss scales this down)
// =====================================================
function spawnDemonPool(isBossFight) {
    if (demons.length >= MAX_DEMONS) return;
    let seed = Math.random(); 
    if (isBossFight) seed = Math.random() * 0.37; // Force special demon spawns when Boss is out
    
    let type = "grunt"; let speed = 1.4 + Math.random() * 1.2; let hp = 1 + Math.floor(Math.random() * 3); let color = "#7f1d1d"; let width = 42; let height = 55;
    
    if (score >= 60000 && seed < 0.12) { type = "brute"; hp = 8; speed = 0.85; color = "#4c0519"; width = 58; height = 78; } else if (score >= 30000 && seed >= 0.12 && seed < 0.26) { type = "swift"; hp = 2; speed = 3.25; color = "#991b1b"; width = 36; height = 50; } else if (score >= 15000 && seed >= 0.26 && seed < 0.38) { type = "sniper"; hp = 1; speed = 1.45; color = "#311042"; width = 40; height = 58; }
    
    const spawnLeft = Math.random() < 0.5; const x = spawnLeft ? 0 : MAP_WIDTH - width;
    demons.push({ id: demonIdCounter++, x, y: GROUND_Y - height, width, height, type, speed, health: hp, maxHealth: hp, color, jumpTimer: 0, shootTimer: 0, stunnedTimer: 0, attackWindup: 0, attackCooldown: 75, attackFlash: 0, attackRange: type === "brute" ? 70 : type === "swift" ? 52 : 48, attackHasHit: false, dashTimer: 0, dashCooldown: 120 + Math.random() * 60, dashDir: 1, dashDamageBoxTimer: 0, slamWindup: 0, slamCooldown: 190, slamActive: false, frozen: false });
}

function updateDemons(dt) {
    if (akazaIntro.active) return; // ENTIRELY FREEZE ENEMIES DURING CUTSCENE
    
    const isBossFight = akaza !== null;

    // NO DEMON SPAWNS IN PURE BOSS RUSH MODE
    if (isBossFight && BOSS_TEST_MODE) return; 

    // Extreme slow spawn rate when Akaza is out in Arcade mode to just provide light support
    const spawnLimit = isBossFight ? 2500 : 90; 

    spawnTimer += dt; 
    if (spawnTimer >= spawnLimit) { spawnTimer = 0; spawnDemonPool(isBossFight); }
    
    for (let i = demons.length - 1; i >= 0; i--) { 
        const d = demons[i]; 
        const beforeCount = demons.length; 
        handlePlayerAttackAgainstDemon(i, d); 
        if (demons.length < beforeCount) continue; 
        
        if (d.frozen) continue; // Skip AI entirely if frozen
        
        if (d.stunnedTimer > 0) { d.stunnedTimer -= dt; d.attackWindup = 0; d.attackFlash = 0; continue; } 
        if (d.attackCooldown > 0) d.attackCooldown -= dt; 
        if (d.attackFlash > 0) d.attackFlash -= dt; 
        if (d.dashCooldown > 0) d.dashCooldown -= dt; 
        if (d.slamCooldown > 0) d.slamCooldown -= dt; 
        moveDemon(d, dt); updateDemonAttack(d, dt); 
    }
}
function moveDemon(d, dt) { const playerCenter = player.x + player.width / 2; const demonCenter = d.x + d.width / 2; const dist = Math.abs(playerCenter - demonCenter); const dir = demonCenter < playerCenter ? 1 : -1; if (d.type === "swift") { updateSwiftMovement(d, dt, dist, dir); return; } if (d.type === "brute") { updateBruteMovement(d, dt, dist, dir); return; } if (d.type === "sniper") { updateSniperMovement(d, dt, dist, dir); return; } updateGruntMovement(d, dt, dist, dir); }
function updateGruntMovement(d, dt, dist, dir) { if (d.attackWindup > 0) return; if (dist > d.attackRange) d.x += dir * d.speed * dt; else d.x -= dir * 0.25 * dt; d.x = clamp(d.x, 0, MAP_WIDTH - d.width); }
function updateSniperMovement(d, dt, dist, dir) { if (dist > 460) d.x += dir * d.speed * dt; else if (dist < 300) d.x -= dir * d.speed * dt; d.shootTimer += dt; if (d.shootTimer >= 210) { d.shootTimer = 0; pushProjectile({ x: d.x + d.width / 2, y: d.y + 18, vx: dir * 5.7, vy: 0, radius: 10, coreRadius: 5, color: "#c084fc", damage: 12, deflected: false }); playSound(sfxProjectileShoot); } d.x = clamp(d.x, 0, MAP_WIDTH - d.width); }
function updateSwiftMovement(d, dt, dist, dir) { if (d.attackWindup > 0) return; if (d.dashTimer > 0) { d.x += d.dashDir * 10.8 * dt; d.dashTimer -= dt; d.dashDamageBoxTimer = 7; addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 1); d.x = clamp(d.x, 0, MAP_WIDTH - d.width); return; } if (dist > 120) d.x += dir * d.speed * dt; else d.x -= dir * 1.5 * dt; if (d.dashCooldown <= 0 && dist < 330 && dist > 70) { d.dashCooldown = 180; d.dashTimer = 15; d.dashDir = dir; d.attackHasHit = false; playSound(sfxSwiftDash); addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 10); } d.x = clamp(d.x, 0, MAP_WIDTH - d.width); }
function updateBruteMovement(d, dt, dist, dir) { if (d.slamWindup > 0) { d.slamWindup -= dt; d.attackFlash = Math.max(d.attackFlash, 5); if (d.slamWindup <= 0) { d.slamCooldown = 260; d.attackCooldown = 145; playSound(sfxBruteSlam); startCameraShake(12, 9); addFoamBurst(d.x + d.width / 2, d.y + d.height, 24); pushShockwave(d.x + d.width / 2, d.y + d.height - 5, 185, 12, d, "#fb923c", 8, 8); } return; } if (d.attackWindup > 0) return; if (dist > 95) d.x += dir * d.speed * dt; else d.x -= dir * 0.2 * dt; if (d.slamCooldown <= 0 && dist < 210) { d.slamWindup = 48; d.attackFlash = 48; playSound(sfxBruteWindup); } d.x = clamp(d.x, 0, MAP_WIDTH - d.width); }

function updateDemonAttack(d, dt) { if (d.type === "sniper") return; const playerCenter = player.x + player.width / 2; const demonCenter = d.x + d.width / 2; const dist = Math.abs(playerCenter - demonCenter); if (d.type === "swift") { updateSwiftAttack(d, dist, dt); return; } if (d.type === "brute") { updateBruteAttack(d, dist, dt); return; } updateGruntAttack(d, dist, dt); }
function updateGruntAttack(d, dist, dt) { if (dist <= d.attackRange + 12 && d.attackCooldown <= 0 && d.attackWindup <= 0) { d.attackWindup = 26; d.attackFlash = d.attackWindup; d.attackHasHit = false; playSound(sfxGruntAttack); } if (d.attackWindup > 0) { d.attackWindup -= dt; if (d.attackWindup <= 0) { d.attackCooldown = 105; if (!d.attackHasHit && (rectsOverlap(getDemonAttackBox(d), getPlayerBox()) || (isFormDefenseActive() && rectsOverlap(getDemonAttackBox(d), getActiveFormParryBox())))) { d.attackHasHit = true; handleGuardOrParryAgainstPhysical(d, 5); } } } }
function updateSwiftAttack(d, dist, dt) { const swiftHitBox = { x: d.x - 10, y: d.y + 8, width: d.width + 20, height: d.height - 8 }; if (d.dashDamageBoxTimer > 0) { d.dashDamageBoxTimer -= dt; if (!d.attackHasHit && (rectsOverlap(swiftHitBox, getPlayerBox()) || (isFormDefenseActive() && rectsOverlap(swiftHitBox, getActiveFormParryBox())))) { d.attackHasHit = true; playSound(sfxSwiftAttack); handleGuardOrParryAgainstPhysical(d, 7); } } if (dist <= d.attackRange + 8 && d.attackCooldown <= 0 && d.attackWindup <= 0 && d.dashTimer <= 0) { d.attackWindup = 18; d.attackFlash = d.attackWindup; d.attackHasHit = false; playSound(sfxSwiftAttack); } if (d.attackWindup > 0) { d.attackWindup -= dt; if (d.attackWindup <= 0) { d.attackCooldown = 95; if (!d.attackHasHit && (rectsOverlap(getDemonAttackBox(d), getPlayerBox()) || (isFormDefenseActive() && rectsOverlap(getDemonAttackBox(d), getActiveFormParryBox())))) { d.attackHasHit = true; handleGuardOrParryAgainstPhysical(d, 6); } } } }
function updateBruteAttack(d, dist, dt) { if (d.slamWindup > 0) return; if (dist <= d.attackRange + 12 && d.attackCooldown <= 0 && d.attackWindup <= 0) { d.attackWindup = 38; d.attackFlash = d.attackWindup; d.attackHasHit = false; playSound(sfxBruteWindup); } if (d.attackWindup > 0) { d.attackWindup -= dt; if (d.attackWindup <= 0) { d.attackCooldown = 145; playSound(sfxBruteSlam); startCameraShake(7, 5); if (!d.attackHasHit && (rectsOverlap(getDemonAttackBox(d), getPlayerBox()) || (isFormDefenseActive() && rectsOverlap(getDemonAttackBox(d), getActiveFormParryBox())))) { d.attackHasHit = true; handleGuardOrParryAgainstPhysical(d, 10); } } } }
function getPlayerBox() { return { x: player.x, y: player.y, width: player.width, height: player.height }; }
function getDemonAttackBox(d) { const facingRight = d.x + d.width / 2 < player.x + player.width / 2; const range = d.type === "brute" ? 78 : d.type === "swift" ? 60 : 48; return { x: facingRight ? d.x + d.width : d.x - range, y: d.y + 10, width: range, height: d.height - 8 }; }
function handlePlayerAttackAgainstDemon(index, d) { 
    if (!player.isAttacking || player.attackFrame <= 1 || player.hitTargets.has(d.id) || (player.currentForm === 0 && player.m1AlreadyHit)) return; 
    const hitDemon = player.attackBox.x < d.x + d.width && player.attackBox.x + player.attackBox.width > d.x && player.attackBox.y < d.y + d.height && player.attackBox.y + player.attackBox.height > d.y; 
    if (!hitDemon) return; 
    
    if (d.type === "brute" && player.currentForm === 0) { 
        player.isAttacking = false; player.isStunned = true; player.stunTimer = 30; player.invincibleTimer = 22; playSound(sfxParryClang); pushClashSparks(d.x + d.width / 2, d.y + d.height / 2, 26, "#fb923c"); startCameraShake(7, 5); 
        return; 
    } 
    
    if (player.currentForm < 5) playSound(sfxDemonHit); 
    
    let damageValue = attackDamage[player.currentForm]; 
    if (player.currentForm === 1 && d.type === "swift") damageValue += 1; 
    if (player.currentForm === 2 && d.type === "swift") damageValue += 1; 
    if (player.currentForm === 3 && d.type === "brute") damageValue += 2; 
    if (player.currentForm === 4) damageValue += 1; 
    if (player.currentForm === 5 && d.type === "brute") damageValue += 14;
    d.health -= damageValue; player.hitTargets.add(d.id); 
    if (player.currentForm === 0) player.m1AlreadyHit = true; 
    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 8); 
    pushClashSparks(d.x + d.width / 2, d.y + d.height / 2, player.currentForm >= 5 ? 28 : 12, player.currentForm >= 5 ? "#fbbf24" : "#ffffff"); 
    if (player.currentForm === 5) { d.stunnedTimer = Math.max(d.stunnedTimer, 145); pushStunText(d.x + d.width / 2, d.y - 18); addSunFlareBurst(d.x + d.width / 2, d.y + d.height / 2, 20); }
    
    combo++; comboTimer = 240; score += player.currentForm >= 5 ? 45 : 20; 
    if (d.health <= 0) killDemon(index, d); 
}

function killDemon(index, d) { 
    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 14); demons.splice(index, 1); combo++; comboTimer = 240; 
    if (d.type === "brute") score += 600; else if (d.type === "swift") score += 400; else if (d.type === "sniper") score += 350; else score += 200; 
    if (combo % 10 === 0) { player.health = Math.min(player.maxHealth, player.health + 4); player.breathing = Math.min(player.maxBreathing, player.breathing + 18); } 
    
    // Very Rare Health Drops (2% chance now)
    if (!BOSS_TEST_MODE && !akazaIntro.active && !akaza && healthDrops.length < MAX_HEALTH_DROPS && Math.random() < 0.02) {
        healthDrops.push({ x: d.x + d.width / 2 - 10, y: GROUND_Y - 24, width: 20, height: 20, healValue: 6, bobOffset: Math.random() * 100 });
    }
}

// =====================================================
// DRAWING
// =====================================================
function draw() {
    resetCanvasContextState();
    if (gameState !== "playing") {
        if (gameState === "menu" || gameState === "splash") clearGameplayCanvas();
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(screenShakeX, screenShakeY); ctx.save();
    
    if (akazaIntro.active) { 
        akazaIntro.currentZoom += (akazaIntro.zoomTarget - akazaIntro.currentZoom) * 0.05; 
        const cx = canvas.width / 2; 
        const cy = canvas.height / 2; 
        ctx.translate(cx, cy); 
        ctx.scale(akazaIntro.currentZoom, akazaIntro.currentZoom); 
        ctx.translate(-cx, -cy); 
    }
    
    drawBackground(); drawAkazaCompass(); drawParticles(); drawJumpBursts(); drawShockwaves(); drawAkazaShockRings(); drawWaterTrails(); drawHealthDrops(); drawPlayer(); drawProjectiles(); drawEnemies(); drawAkaza(); drawAkazaSmoke(); drawBossSmoke(); drawAfterglowFistStreaks(); drawCombatSparks(); drawHealTexts();
    ctx.restore();
    if (!BOSS_TEST_MODE) drawEnemyProgressBar();
    drawHUD(); drawEnemyRevealPopup(); drawAkazaLetterbox();
    
    // ANIME IMPACT FRAME OVERLAY
    if (impactFrameTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "difference"; 
        ctx.fillStyle = (Math.floor(impactFrameTimer) % 3 === 0) ? "#ffffff" : "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    
    // LIGHT PARRY IMPACT FRAME OVERLAY
    if (lightImpactFrameTimer > 0) {
        ctx.save();
        const alpha = Math.min(0.28, lightImpactFrameTimer / 6 * 0.28);
        ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = alpha * 1.4;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        ctx.restore();
    }

    // DAMAGE FLASH OVERLAY
    if (damageFlashTimer > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(220, 38, 38, ${Math.min(0.45, damageFlashTimer/15)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // GAME OVER / WIN CINEMATIC FADE
    if (gameOver || gameWon) {
        ctx.save();
        const alpha = Math.min(0.85, endSequenceTimer / 100);
        ctx.fillStyle = gameWon ? `rgba(2, 132, 199, ${alpha})` : `rgba(153, 27, 27, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    
    ctx.restore();
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height); sky.addColorStop(0, "#09030a"); sky.addColorStop(0.35, "#1a0905"); sky.addColorStop(0.75, "#3a1608"); sky.addColorStop(1, "#08070a"); ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const glow = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.45, 30, canvas.width * 0.5, canvas.height * 0.45, canvas.width * 0.8); glow.addColorStop(0, "rgba(255, 150, 70, 0.22)"); glow.addColorStop(0.35, "rgba(190, 70, 25, 0.12)"); glow.addColorStop(1, "rgba(0, 0, 0, 0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(90, 20, 10, 0.18)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "rgba(5, 4, 6, 0.9)"; ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y); ctx.fillStyle = "#7c2d12"; ctx.fillRect(0, GROUND_Y, canvas.width, 4); ctx.fillStyle = "rgba(255, 120, 40, 0.35)"; ctx.fillRect(0, GROUND_Y + 4, canvas.width, 2);
}

function drawParticles() { foamParticles.forEach((p) => { ctx.save(); ctx.globalAlpha = p.alpha; ctx.shadowBlur = 14; ctx.shadowColor = p.shadow || "#38bdf8"; ctx.fillStyle = p.color || "#ffffff"; ctx.strokeStyle = p.shadow || "#1d4ed8"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }); }
function drawJumpBursts() { jumpBursts.forEach((b) => { ctx.save(); ctx.globalAlpha = b.alpha; ctx.strokeStyle = b.type === "land" ? "#e0f2fe" : "#38bdf8"; ctx.lineWidth = b.type === "land" ? 4 : 3; ctx.beginPath(); ctx.ellipse(b.x - cameraX, b.y, b.radius * 1.5, b.radius * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }); }

function drawShockwaves() { 
    shockwaves.forEach((sw) => { 
        ctx.save(); 
        ctx.globalAlpha = sw.alpha; 
        ctx.strokeStyle = sw.color; 
        ctx.lineWidth = sw.lineWidth; 
        ctx.beginPath(); 
        ctx.ellipse(sw.x - cameraX, sw.y, sw.radius * 1.35, sw.radius * 0.32, 0, 0, Math.PI * 2); 
        ctx.stroke(); 
        ctx.strokeStyle = "#ffffff"; 
        ctx.lineWidth = sw.lineWidth / 3; 
        ctx.beginPath(); 
        ctx.ellipse(sw.x - cameraX, sw.y, sw.radius * 0.85, sw.radius * 0.2, 0, 0, Math.PI * 2); 
        ctx.stroke(); 
        ctx.restore(); 
    }); 
}

function drawAfterglowFistStreaks() {
    afterglowFistStreaks.forEach((s) => {
        ctx.save();
        ctx.translate(s.x - cameraX, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 62;
        ctx.shadowColor = s.color;

        // thick blue-white punch trail, glow shell, then sharp white core
        ctx.strokeStyle = s.color === "#ffffff" ? "rgba(255,255,255,0.34)" : "rgba(14,165,233,0.34)";
        ctx.lineWidth = s.width * 2.35;
        ctx.beginPath();
        ctx.moveTo(-s.length * 0.08, s.curl * 0.1);
        ctx.quadraticCurveTo(s.length * 0.45, s.curl, s.length * 1.04, 0);
        ctx.stroke();

        ctx.strokeStyle = s.color === "#ffffff" ? "rgba(224,242,254,0.92)" : "rgba(56,189,248,0.94)";
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s.length * 0.45, s.curl, s.length, 0);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.lineWidth = Math.max(2, s.width * 0.28);
        ctx.beginPath();
        ctx.moveTo(s.length * 0.08, 0);
        ctx.quadraticCurveTo(s.length * 0.52, s.curl * 0.45, s.length * 0.92, 0);
        ctx.stroke();

        ctx.strokeStyle = "rgba(14,165,233,0.46)";
        ctx.lineWidth = Math.max(3, s.width * 0.45);
        ctx.beginPath();
        ctx.moveTo(-s.length * 0.22, s.curl * 0.18);
        ctx.lineTo(s.length * 0.45, s.curl * 0.55);
        ctx.stroke();
        ctx.restore();
    });
}

function drawCombatSparks() { parrySlashes.forEach((p) => { ctx.save(); ctx.translate(p.x - cameraX, p.y); ctx.rotate(p.rotation); ctx.globalAlpha = p.alpha; ctx.shadowBlur = 35; ctx.shadowColor = "#f97316"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-p.radius, -p.radius * 0.35); ctx.lineTo(p.radius, p.radius * 0.35); ctx.stroke(); ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-p.radius * 0.85, p.radius * 0.35); ctx.lineTo(p.radius * 0.85, -p.radius * 0.35); ctx.stroke(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-p.radius * 0.5, 0); ctx.lineTo(p.radius * 0.5, 0); ctx.stroke(); ctx.restore(); }); clashSparks.forEach((s) => { ctx.save(); ctx.globalAlpha = s.alpha; ctx.strokeStyle = s.color; ctx.shadowBlur = 15; ctx.shadowColor = s.color; ctx.lineWidth = 3; const angle = Math.atan2(s.vy, s.vx); ctx.beginPath(); ctx.moveTo(s.x - cameraX, s.y); ctx.lineTo(s.x - cameraX - Math.cos(angle) * s.length, s.y - Math.sin(angle) * s.length); ctx.stroke(); ctx.restore(); }); }
function drawWaveFoam(x, y, radius, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
function drawWaterTrails() { waterTrails.forEach((t) => { ctx.save(); ctx.globalAlpha = t.alpha; ctx.shadowBlur = 25; const centerHandX = t.facing === "right" ? t.playerX + player.width : t.playerX; const centerHandY = t.playerY + player.height / 2; if (t.form === 1) drawForm1Trail(t); else if (t.form === 2) drawForm2Trail(t, centerHandX, centerHandY); else if (t.form === 3) drawForm3Trail(t); else if (t.form === 4) drawForm4Trail(t); else if (t.form === 5) drawSunDanceTrail(t); else drawM1Trail(t, centerHandX, centerHandY); ctx.restore(); }); }

function drawForm1Trail(t) { 
    const progress = t.frame / t.maxFrame;
    const centerX = t.playerX + player.width/2 - cameraX;
    const centerY = t.playerY + player.height/2;
    const radius = 110;
    
    // Top to bottom fluid sweep calculation
    const startAngle = t.facing === "right" ? -Math.PI * 0.6 : Math.PI + Math.PI * 0.6;
    const sweep = (Math.PI * 1.2) * progress;
    const endAngle = t.facing === "right" ? startAngle + sweep : startAngle - sweep;

    ctx.strokeStyle = `rgba(30, 64, 175, ${t.alpha})`; 
    ctx.lineWidth = 35 + Math.sin(progress * Math.PI) * 15; // Swells in the middle of strike
    ctx.lineCap = "round";
    ctx.beginPath(); 
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, t.facing === "left"); 
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(56, 189, 248, ${t.alpha})`; 
    ctx.lineWidth = 14 + Math.sin(progress * Math.PI) * 8;
    ctx.beginPath(); 
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, t.facing === "left"); 
    ctx.stroke();
    
    // Spawn travelling foam bits
    for(let a = 0; a <= 1; a += 0.2) {
        if (a > progress) continue;
        const cur = t.facing === "right" ? startAngle + sweep * a : startAngle - sweep * a;
        drawWaveFoam(centerX + Math.cos(cur)*radius, centerY + Math.sin(cur)*radius, 6 + Math.random()*4, t.alpha);
    }
}

function drawForm2Trail(t, centerHandX, centerHandY) { ctx.shadowColor = "#06b6d4"; const pivotX = centerHandX + (t.facing === "right" ? 55 : -55); ctx.strokeStyle = "#1d4ed8"; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(pivotX - cameraX, centerHandY, 72, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(pivotX - cameraX, centerHandY, 72, 0, Math.PI * 2); ctx.stroke(); for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) { const fx = pivotX + Math.cos(a) * 72; const fy = centerHandY + Math.sin(a) * 72; drawWaveFoam(fx - cameraX, fy, 9, t.alpha); } }
function drawForm3Trail(t) { ctx.shadowColor = "#38bdf8"; const angle = (t.frame * 0.4) % (Math.PI * 2); const radius = 135; const centerX = t.playerX + player.width / 2 - cameraX; const centerY = t.playerY + player.height / 2; ctx.strokeStyle = "#1e40af"; ctx.lineWidth = 25; ctx.beginPath(); ctx.arc(centerX, centerY, radius, angle, angle + Math.PI, false); ctx.stroke(); ctx.strokeStyle = "#06b6d4"; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(centerX, centerY, radius, angle + Math.PI / 2, angle + Math.PI * 1.5, false); ctx.stroke(); for (let a = 0; a < Math.PI * 2; a += 0.55) { const r = radius + Math.sin(t.frame * 0.25 + a) * 14; const fx = centerX + Math.cos(a + angle) * r; const fy = centerY + Math.sin(a + angle) * r; drawWaveFoam(fx, fy, 7, t.alpha * 0.9); } }
function drawForm4Trail(t) { const dir = t.facing === "right" ? 1 : -1; const progress = t.frame / t.maxFrame; const startX = t.playerX + player.width / 2 - cameraX; const startY = t.playerY + player.height / 2; ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 28; ctx.lineCap = "round"; ctx.lineJoin = "round"; drawFlowingDanceRibbon(startX, startY, dir, progress, 30, `rgba(30, 64, 175, ${t.alpha * 0.65})`); drawFlowingDanceRibbon(startX, startY, dir, progress, 12, `rgba(56, 189, 248, ${t.alpha})`); drawFlowingDanceRibbon(startX, startY - 8, dir, progress, 4, `rgba(255, 255, 255, ${t.alpha * 0.85})`); for (let i = 0; i <= 1; i += 0.2) { const wave = Math.sin((i + progress) * Math.PI * 3.6); const curl = Math.sin((i + progress) * Math.PI * 1.8); const x = startX + dir * (i * 380 - 100); const y = startY + wave * 58 + curl * 22; drawWaveFoam(x, y, 5, t.alpha * 0.75); } }
function drawFlowingDanceRibbon(startX, startY, dir, progress, lineWidth, color) { ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath(); for (let i = 0; i <= 1.001; i += 0.075) { const wave = Math.sin((i + progress) * Math.PI * 3.6); const curl = Math.sin((i + progress) * Math.PI * 1.8); const x = startX + dir * (i * 380 - 100); const y = startY + wave * 58 + curl * 22; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
function drawSunDanceTrail(t) {
    const dir = t.facing === "right" ? 1 : -1;
    const progress = clamp(t.frame / t.maxFrame, 0, 1);
    const cx = t.playerX + player.width / 2 - cameraX;
    const cy = t.playerY + player.height / 2;
    const radius = 96 + Math.sin(progress * Math.PI) * 70;
    const start = dir === 1 ? -Math.PI * 0.9 : Math.PI * 0.1;
    const sweep = Math.PI * 2.25 * progress * dir;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 42;
    ctx.shadowColor = "#ef4444";

    ctx.strokeStyle = `rgba(127, 29, 29, ${t.alpha * 0.82})`;
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + sweep, dir < 0);
    ctx.stroke();

    ctx.strokeStyle = `rgba(249, 115, 22, ${t.alpha})`;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.92, start + 0.2 * dir, start + sweep + 0.2 * dir, dir < 0);
    ctx.stroke();

    ctx.strokeStyle = `rgba(254, 240, 138, ${t.alpha * 0.95})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, start + 0.35 * dir, start + sweep + 0.35 * dir, dir < 0);
    ctx.stroke();

    // Constant slash cuts inside the Sun Dance path.
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#fbbf24";
    for (let i = 0; i < 7; i++) {
        const q = i / 6;
        if (q > progress + 0.2) continue;
        const a = start + sweep * q + Math.sin(progress * 12 + i) * 0.16;
        const r = radius * (0.58 + 0.34 * ((i % 3) / 2));
        const sx = cx + Math.cos(a) * (r - 42);
        const sy = cy + Math.sin(a) * (r - 42);
        const ex = cx + Math.cos(a + 0.55 * dir) * (r + 54);
        const ey = cy + Math.sin(a + 0.55 * dir) * (r + 54);
        ctx.strokeStyle = `rgba(255, 247, 173, ${t.alpha * (0.72 - i * 0.045)})`;
        ctx.lineWidth = 5 + (i % 2) * 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = `rgba(239, 68, 68, ${t.alpha * 0.45})`;
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.moveTo(sx - 8 * dir, sy + 4);
        ctx.lineTo(ex - 8 * dir, ey + 4);
        ctx.stroke();
    }

    for (let i = 0; i < 5; i++) {
        const a = start + sweep * (i / 4) + Math.sin(progress * 10 + i) * 0.18;
        const r = radius + Math.sin(i + progress * Math.PI) * 24;
        ctx.fillStyle = `rgba(251, 191, 36, ${t.alpha * 0.65})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 8 + i * 1.2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawM1Trail(t, centerHandX, centerHandY) { ctx.shadowColor = "#ffffff"; ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"; ctx.lineWidth = 12; const sx = centerHandX - cameraX; const dir = t.facing === "right" ? 1 : -1; ctx.beginPath(); if (t.m1Step === 1) { ctx.moveTo(sx, centerHandY - 10); ctx.lineTo(sx + 80 * dir, centerHandY + 10); } else if (t.m1Step === 2) { ctx.moveTo(sx, centerHandY - 40); ctx.lineTo(sx + 80 * dir, centerHandY + 40); } else if (t.m1Step === 3) { ctx.moveTo(sx + 30 * dir, centerHandY - 50); ctx.lineTo(sx + 30 * dir, centerHandY + 50); } else if (t.m1Step === 4) { ctx.moveTo(sx, centerHandY + 40); ctx.lineTo(sx + 80 * dir, centerHandY - 40); } else { ctx.moveTo(sx, centerHandY - 10); ctx.lineTo(sx + 80 * dir, centerHandY + 10); } ctx.stroke(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.stroke(); }

function drawPlayer() {
    if (player.isDashing) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#38bdf8"; ctx.fillRect(player.x - cameraX - 22, player.y + 8, player.width + 44, player.height - 12); ctx.restore(); }
    if ((keys.G || player.totalConcentrationActive) && player.isGrounded && !player.isAttacking && !player.isGuarding) { ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = "#38bdf8"; ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 + Math.sin(Date.now() / 40) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x + player.width / 2 - cameraX, player.y + player.height / 2, 48, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.translate(player.x + player.width / 2 - cameraX, player.y + player.height / 2); let displayRot = player.bodyRotation; if (player.isGuarding) { displayRot = player.facing === "right" ? -0.08 : 0.08; } ctx.rotate(displayRot); let scaleX = 1; let scaleY = 1; if (player.jumpSquash > 0) { const t = player.jumpSquash / 10; scaleX = 1.12 - t * 0.05; scaleY = 0.88 + t * 0.12; } if (player.landingSquash > 0) { const t = player.landingSquash / 9; scaleX = 1.15; scaleY = 0.85 + (1 - t) * 0.15; } ctx.scale(scaleX, scaleY); if (player.isStunned && Math.floor(player.stunTimer) % 8 < 4) { ctx.globalAlpha = 0.3; } drawPlayerBody(); drawSword(); ctx.restore();
}
function drawPlayerBody() {
    ctx.fillStyle = "#2d1a1a"; ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height); const hW = player.width + 4; const hH = player.height - 22; const hX = -player.width / 2 - 2; const hY = -player.height / 2 + 12; ctx.save(); ctx.beginPath(); ctx.rect(hX, hY, hW, hH); ctx.clip(); const rows = 6; const cols = 4; const boxW = hW / cols; const boxH = hH / rows; for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) { ctx.fillStyle = (r + c) % 2 === 0 ? "#047857" : "#0f172a"; ctx.fillRect(hX + c * boxW, hY + r * boxH, boxW, boxH); } } ctx.restore(); ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 1.5; ctx.strokeRect(hX, hY, hW, hH); ctx.fillStyle = "#e2e8f0"; ctx.fillRect(-player.width / 2 + 2, player.height / 2 - 14, player.width - 4, 10);
}
function drawSword() {
    let handX = player.facing === "right" ? player.width / 2 : -player.width / 2; let handY = 5; let swordAngle = player.facing === "right" ? 0.6 : Math.PI - 0.6; const swordLength = 54;
    if (player.isGuarding) { swordAngle = -Math.PI / 2; handY = -2; handX = player.facing === "right" ? 14 : -14; }
    else if (player.isAttacking) { const progress = player.attackFrame / player.maxAttackFrames; if (player.currentForm === 0) { const p = progress * Math.PI; if (player.m1Step === 1) swordAngle = player.facing === "right" ? -Math.PI / 3 + p : Math.PI + Math.PI / 3 - p; else if (player.m1Step === 2) swordAngle = player.facing === "right" ? -Math.PI / 2 + p * 1.2 : Math.PI + Math.PI / 2 - p * 1.2; else if (player.m1Step === 3) swordAngle = player.facing === "right" ? -Math.PI / 1.5 + p : Math.PI + Math.PI / 1.5 - p; else if (player.m1Step === 4) swordAngle = player.facing === "right" ? Math.PI / 4 - p : Math.PI - Math.PI / 4 + p; } else if (player.currentForm === 1) { const p = progress * Math.PI * 1.5; swordAngle = player.facing === "right" ? -Math.PI*0.7 + p : Math.PI + Math.PI*0.7 - p; } else if (player.currentForm === 2) { swordAngle = player.facing === "right" ? progress * Math.PI * 2 : -progress * Math.PI * 2; } else if (player.currentForm === 3) { swordAngle = player.facing === "right" ? progress * Math.PI * 8 : -progress * Math.PI * 8; } else if (player.currentForm === 4) { swordAngle = (player.facing === "right" ? 0 : Math.PI) + Math.sin(player.attackFrame * 0.15) * 1.2; } else if (player.currentForm === 5) { const p = progress * Math.PI * 2.2; swordAngle = player.facing === "right" ? -Math.PI * 0.85 + p : Math.PI + Math.PI * 0.85 - p; handY = -2 + Math.sin(progress * Math.PI) * 8; } } else if (keys.G) { swordAngle = player.facing === "right" ? 1.15 : Math.PI - 1.15; handY = 8; }
    const tipX = handX + Math.cos(swordAngle) * swordLength; const tipY = handY + Math.sin(swordAngle) * swordLength; ctx.fillStyle = "#d97706"; ctx.beginPath(); ctx.arc(handX, handY, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#09090b"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke(); ctx.strokeStyle = player.currentForm >= 5 ? "#f97316" : "#38bdf8"; ctx.lineWidth = player.currentForm >= 5 ? 2 : 1; ctx.beginPath(); ctx.moveTo(handX + Math.cos(swordAngle) * 4, handY + Math.sin(swordAngle) * 4); ctx.lineTo(tipX, tipY); ctx.stroke();
}
function drawProjectiles() {
    projectiles.forEach((pr) => {
        const sx = pr.x - cameraX;
        const sy = pr.y;
        const angle = Math.atan2(pr.vy || 0, pr.vx || 1);
        const len = Math.max(46, (pr.radius || 14) * 4.6);
        const h = Math.max(14, (pr.radius || 14) * 1.45);
        const color = pr.deflected ? "#fb923c" : (pr.color || "#38bdf8");

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.globalAlpha = pr.alpha ?? 1;
        ctx.shadowBlur = 22;
        ctx.shadowColor = color;

        // Manga-style compressed shockwave / blue-metal-afterglow projectile.
        ctx.fillStyle = color;
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(len * 0.52, 0);
        ctx.quadraticCurveTo(len * 0.22, -h * 0.82, -len * 0.28, -h * 0.58);
        ctx.lineTo(-len * 0.52, -h * 0.22);
        ctx.lineTo(-len * 0.32, -h * 0.05);
        ctx.lineTo(-len * 0.58, h * 0.12);
        ctx.lineTo(-len * 0.22, h * 0.34);
        ctx.quadraticCurveTo(len * 0.18, h * 0.78, len * 0.52, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha *= 0.75;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(len * 0.35, 0);
        ctx.quadraticCurveTo(len * 0.06, -h * 0.35, -len * 0.24, -h * 0.18);
        ctx.quadraticCurveTo(len * 0.02, h * 0.22, len * 0.35, 0);
        ctx.fill();

        ctx.globalAlpha *= 0.55;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            const tailY = (i - 1) * h * 0.34;
            ctx.beginPath();
            ctx.moveTo(-len * (0.38 + i * 0.07), tailY);
            ctx.lineTo(-len * (0.78 + i * 0.05), tailY + (Math.random() - 0.5) * 7);
            ctx.stroke();
        }

        ctx.restore();
    });
}


function drawEnemies() {
    demons.forEach((d) => {
        if (d.attackFlash > 0) { const attackBox = getDemonAttackBox(d); ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(d.attackFlash * 0.35) * 0.15; ctx.fillStyle = d.type === "brute" ? "#fb923c" : "#ef4444"; ctx.fillRect(attackBox.x - cameraX, attackBox.y, attackBox.width, attackBox.height); ctx.restore(); }
        if (d.slamWindup > 0) { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(d.slamWindup * 0.35) * 0.2; ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(d.x + d.width / 2 - cameraX, d.y + d.height, 95, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        if (d.dashTimer > 0) { ctx.save(); ctx.globalAlpha = 0.32; ctx.fillStyle = "#fca5a5"; ctx.fillRect(d.x - cameraX - 25, d.y + 6, d.width + 50, d.height - 10); ctx.restore(); }
        const lean = d.attackWindup > 0 ? Math.sin(d.attackWindup * 0.25) * 0.12 : 0; ctx.save(); ctx.translate(d.x + d.width / 2 - cameraX, d.y + d.height / 2); ctx.rotate(lean); ctx.fillStyle = d.attackWindup > 0 || d.slamWindup > 0 ? "#dc2626" : d.color; ctx.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);
        if (d.type === "swift") { ctx.fillStyle = "#fecaca"; ctx.fillRect(-d.width / 2 - 6, -d.height / 2 + 10, 6, 22); ctx.fillRect(d.width / 2, -d.height / 2 + 10, 6, 22); }
        if (d.type === "brute") { ctx.fillStyle = "#fb923c"; ctx.fillRect(-d.width / 2 + 5, -d.height / 2 + 8, d.width - 10, 8); } ctx.restore(); drawEnemyHealthBar(d);
        ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = "#f43f5e"; ctx.fillStyle = d.stunnedTimer > 0 ? "#e2e8f0" : "#ef4444"; let eyeX = d.x - cameraX + 20; if (d.type === "swift") eyeX = d.x - cameraX + 8; if (d.type === "brute") eyeX = d.x - cameraX + 24; if (d.type === "sniper") eyeX = d.x - cameraX + 17; ctx.fillRect(eyeX, d.y + 12, 6, 6); ctx.restore();
    });
}

function drawEnemyHealthBar(d) { ctx.fillStyle = "#0f172a"; ctx.fillRect(d.x - cameraX, d.y - 16, d.width, 8); const pct = clamp(d.health / d.maxHealth, 0, 1); if (d.type === "brute") ctx.fillStyle = "#fb923c"; else if (d.type === "swift") ctx.fillStyle = "#f43f5e"; else if (d.type === "sniper") ctx.fillStyle = "#c084fc"; else ctx.fillStyle = "#ef4444"; ctx.fillRect(d.x - cameraX, d.y - 16, pct * d.width, 8); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.strokeRect(d.x - cameraX, d.y - 16, d.width, 8); }
function drawHealTexts() {
    healTexts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        const text = typeof h.amount === "number" ? `+${h.amount} HP` : `${h.amount}`;
        const isStun = text.includes("STUNNED");
        const isSun = text.includes("SUN");
        const fontSize = isStun ? 26 : isSun ? 24 : 22;
        const pulse = 1 + Math.sin((h.maxLife || 70) - h.life) * 0.04;
        ctx.translate(h.x - cameraX, h.y);
        ctx.scale(pulse, pulse);
        ctx.font = `bold ${fontSize}px ${PIXEL_FONT}`;
        ctx.lineWidth = isStun ? 5 : 4;
        ctx.strokeStyle = "#020617";
        ctx.fillStyle = h.color || "#22c55e";
        const textW = ctx.measureText(text).width;
        ctx.strokeText(text, -textW / 2, 0);
        ctx.fillText(text, -textW / 2, 0);
        ctx.restore();
    });
}

// =====================================================
// CLEAN HUD
// =====================================================
function drawHUD() { drawScoreText(); drawTopBars(); drawFormsMinimal(); }
function getHudScale() { return clamp(Math.min(canvas.width / 1600, canvas.height / 850), 0.56, 1); }
function px(n) { return Math.max(8, Math.round(n * getHudScale())); }

function drawScoreText() {
    const s = getHudScale();
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 4 * s);
    ctx.font = `bold ${Math.round(28 * s)}px ${PIXEL_FONT}`;
    ctx.strokeText(`SCORE: ${score.toLocaleString()}`, 24 * s, 42 * s);
    ctx.fillText(`SCORE: ${score.toLocaleString()}`, 24 * s, 42 * s);
    ctx.restore();
}

function drawTopBars() {
    const s = getHudScale();
    const barW = Math.min(520 * s, canvas.width * 0.46);
    const barH = Math.max(15, 24 * s);
    const x = canvas.width / 2 - barW / 2;
    const hpY = 90 * s;
    const breathY = hpY + 36 * s;
    const labelFont = Math.max(12, 20 * s);
    const valueFont = Math.max(11, 18 * s);

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.font = `bold ${labelFont}px ${PIXEL_FONT}`;
    ctx.strokeText("HP", x, hpY - 8 * s);
    ctx.fillText("HP", x, hpY - 8 * s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, hpY, barW, barH);
    const hpPct = clamp(player.health / player.maxHealth, 0, 1);
    ctx.fillStyle = player.health > player.maxHealth * 0.5 ? "#22c55e" : player.health > player.maxHealth * 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(x, hpY, barW * hpPct, barH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.strokeRect(x, hpY, barW, barH);
    ctx.font = `bold ${valueFont}px ${PIXEL_FONT}`;
    const hpText = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    const hpTextW = ctx.measureText(hpText).width;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.strokeText(hpText, x + barW / 2 - hpTextW / 2, hpY + barH * 0.75);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(hpText, x + barW / 2 - hpTextW / 2, hpY + barH * 0.75);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.font = `bold ${labelFont}px ${PIXEL_FONT}`;
    ctx.strokeText("BREATH", x, breathY - 8 * s);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("BREATH", x, breathY - 8 * s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, breathY, barW, barH);
    const breathPct = clamp(player.breathing / player.maxBreathing, 0, 1);
    const waterLimitPct = 150 / player.maxBreathing;
    const waterFillPct = Math.min(breathPct, waterLimitPct);
    const sunFillPct = Math.max(0, breathPct - waterLimitPct);
    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(x, breathY, barW * waterFillPct, barH);
    if (sunFillPct > 0) {
        const gradient = ctx.createLinearGradient(x + barW * waterLimitPct, breathY, x + barW, breathY);
        gradient.addColorStop(0, "#f97316");
        gradient.addColorStop(1, "#ef4444");
        ctx.fillStyle = gradient;
        ctx.fillRect(x + barW * waterLimitPct, breathY, barW * sunFillPct, barH);
    }
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath();
    ctx.moveTo(x + barW * waterLimitPct, breathY - 3 * s);
    ctx.lineTo(x + barW * waterLimitPct, breathY + barH + 3 * s);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.strokeRect(x, breathY, barW, barH);
    ctx.font = `bold ${valueFont}px ${PIXEL_FONT}`;
    const breathText = `${Math.floor(player.breathing)} / ${player.maxBreathing}`;
    const breathTextW = ctx.measureText(breathText).width;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.strokeText(breathText, x + barW / 2 - breathTextW / 2, breathY + barH * 0.75);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(breathText, x + barW / 2 - breathTextW / 2, breathY + barH * 0.75);
    ctx.restore();
}

function drawFormsMinimal() {
    const s = getHudScale();
    const panelW = 560 * s;
    const x = Math.max(12 * s, canvas.width - panelW);
    const y = 145 * s;
    const titleFont = Math.max(12, 20 * s);
    const rowFont = Math.max(9, 15 * s);
    const dashFont = Math.max(10, 18 * s);
    const rowGap = 23 * s;
    const rightOffset = 470 * s;
    const formsInfo = [
        { id: 1, key: "1", name: "1ST FORM: WATER SLASH", req: 40, sun: false },
        { id: 2, key: "2", name: "2ND FORM: WATER WHEEL", req: 80, sun: false },
        { id: 3, key: "3", name: "3RD FORM: WHIRLPOOL", req: 100, sun: false },
        { id: 4, key: "4", name: "4TH FORM: FLOW DANCE", req: 140, sun: false },
        { id: 5, key: "5", name: "SUN BREATHING 1ST FORM: SUN DANCE", req: 180, sun: true },
        { id: "F", key: "F", name: "TOTAL CONCENTRATION", req: 0, sun: false }
    ];

    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 4 * s);
    ctx.font = `bold ${titleFont}px ${PIXEL_FONT}`;
    ctx.strokeText("ABILITIES", x, y - 28 * s);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("ABILITIES", x, y - 28 * s);
    ctx.font = `bold ${rowFont}px ${PIXEL_FONT}`;

    for (let i = 0; i < formsInfo.length; i++) {
        const f = formsInfo[i];
        const rowY = y + i * rowGap;
        let color = f.sun ? "#fb923c" : "#ffffff";
        let rightText = "READY";

        if (f.id === "F") {
            if (player.totalConcentrationActive) { color = "#38bdf8"; rightText = `${Math.ceil(player.totalConcentrationTimer / 60)}s`; }
            else if (player.totalConcentrationCooldown > 0) { color = "#f87171"; rightText = `${Math.ceil(player.totalConcentrationCooldown / 60)}s`; }
            else { color = "#22c55e"; rightText = "READY"; }
        } else {
            const isLocked = player.breathing < f.req;
            const isSelected = player.selectedForm === f.id;
            const cd = formCooldowns[f.id];
            if (isSelected) color = f.sun ? "#fbbf24" : "#fbbf24";
            if (isLocked) { color = "#64748b"; rightText = `REQ ${f.req}`; }
            else if (cd > 0) { color = "#f87171"; rightText = `${Math.ceil(cd / 60)}s`; }
            else { rightText = "READY"; }
        }

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.strokeText(`${f.key}. ${f.name}`, x, rowY);
        ctx.fillStyle = color;
        ctx.fillText(`${f.key}. ${f.name}`, x, rowY);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.strokeText(rightText, x + rightOffset, rowY);
        ctx.fillStyle = rightText === "READY" ? "#22c55e" : color;
        ctx.fillText(rightText, x + rightOffset, rowY);
    }

    const baseY = y + formsInfo.length * rowGap + 2 * s;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 4 * s);
    ctx.font = `bold ${dashFont}px ${PIXEL_FONT}`;
    ctx.strokeText(`DASHES: ${player.dashCharges}/${player.maxDashCharges}`, x, baseY);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`DASHES: ${player.dashCharges}/${player.maxDashCharges}`, x, baseY);
    if (player.dashCharges < player.maxDashCharges) {
        ctx.strokeText(`RECHARGE: ${(player.dashRechargeTimer / 60).toFixed(1)}s`, x, baseY + 24 * s);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`RECHARGE: ${(player.dashRechargeTimer / 60).toFixed(1)}s`, x, baseY + 24 * s);
    }
    if (player.totalConcentrationActive) {
        ctx.strokeText("TOTAL CONCENTRATION ACTIVE", x, baseY + 72 * s);
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("TOTAL CONCENTRATION ACTIVE", x, baseY + 72 * s);
    }
    if (player.isGuarding) {
        ctx.strokeText("GUARDING", x, baseY + 96 * s);
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("GUARDING", x, baseY + 96 * s);
    }
    ctx.restore();
}

function drawEnemyProgressBar() {
    const s = getHudScale();
    const barW = Math.min(700 * s, canvas.width * 0.62);
    const barH = Math.max(9, 14 * s);
    const x = canvas.width / 2 - barW / 2;
    const y = 14 * s;
    const pct = clamp(score / MAX_PROGRESS_SCORE, 0, 1);
    const titleFont = Math.max(10, 18 * s);
    const skullFont = Math.max(12, 20 * s);
    const labelFont = Math.max(9, 14 * s);

    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, 4 * s);
    ctx.font = `bold ${titleFont}px ${PIXEL_FONT}`;
    const title = "DEMON THREAT PATH";
    const titleW = ctx.measureText(title).width;
    ctx.strokeText(title, x + barW / 2 - titleW / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, x + barW / 2 - titleW / 2, y);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, y + 13 * s, barW, barH);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x, y + 13 * s, barW * pct, barH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeRect(x, y + 13 * s, barW, barH);
    enemyMilestones.forEach((m) => {
        const mx = x + (m.score / MAX_PROGRESS_SCORE) * barW;
        const unlocked = score >= m.score;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(2, 4 * s);
        ctx.font = `bold ${skullFont}px ${PIXEL_FONT}`;
        ctx.strokeText("☠", mx - 10 * s, y + 9 * s);
        ctx.fillStyle = unlocked ? "#fbbf24" : "#cbd5e1";
        ctx.fillText("☠", mx - 10 * s, y + 9 * s);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(1, 3 * s);
        ctx.font = `bold ${labelFont}px ${PIXEL_FONT}`;
        const label = m.score >= 1000 ? `${m.score / 1000}K` : `${m.score}`;
        ctx.strokeText(label, mx - 15 * s, y + 47 * s);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, mx - 15 * s, y + 47 * s);
    });
    ctx.restore();
}

function drawEnemyRevealPopup() {
    if (!enemyRevealPopup.active) return;
    const remainingPct = enemyRevealPopup.timer / enemyRevealPopup.maxTimer;
    const overlayAlpha = 0.45 + Math.sin(Date.now() / 80) * 0.08;
    ctx.save();
    ctx.globalAlpha = overlayAlpha;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    const boxW = Math.min(940, canvas.width - 80);
    const boxH = 470;
    const x = canvas.width / 2 - boxW / 2;
    const y = canvas.height / 2 - boxH / 2;

    ctx.fillStyle = "#020617";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 7;
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 12, y + 12, boxW - 24, boxH - 24);

    const closeSize = 44;
    const closeX = x + boxW - closeSize - 26;
    const closeY = y + 24;
    enemyRevealCloseButton = { active: true, x: closeX, y: closeY, size: closeSize };

    ctx.fillStyle = "#450a0a";
    ctx.fillRect(closeX, closeY, closeSize, closeSize);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.strokeRect(closeX, closeY, closeSize, closeSize);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.font = `bold 24px ${PIXEL_FONT}`;
    ctx.strokeText("X", closeX + 11, closeY + 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("X", closeX + 11, closeY + 30);

    ctx.fillStyle = "#ef4444";
    ctx.font = `bold 28px ${PIXEL_FONT}`;
    ctx.fillText("NEW THREAT REVEALED", x + 42, y + 58);

    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold 20px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.alert, x + 42, y + 96, boxW - 84, 28);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 40px ${PIXEL_FONT}`;
    ctx.fillText(enemyRevealPopup.title, x + 42, y + 158);

    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold 24px ${PIXEL_FONT}`;
    ctx.fillText(`ENEMY HP: ${enemyRevealPopup.hp}`, x + 42, y + 205);

    ctx.fillStyle = "#22c55e";
    ctx.font = `bold 21px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.hpCapText, x + 42, y + 242, boxW - 84, 28);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold 21px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.description, x + 42, y + 295, boxW - 84, 30);

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold 21px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.tip, x + 42, y + 365, boxW - 84, 30);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x + 42, y + boxH - 38, boxW - 84, 18);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x + 42, y + boxH - 38, (boxW - 84) * remainingPct, 18);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 42, y + boxH - 38, boxW - 84, 18);
    ctx.restore();
}

function wrapPixelText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" "); let line = ""; let currentY = y;
    for (let n = 0; n < words.length; n++) { const testLine = line + words[n] + " "; const metrics = ctx.measureText(testLine); if (metrics.width > maxWidth && n > 0) { ctx.fillText(line, x, currentY); line = words[n] + " "; currentY += lineHeight; } else { line = testLine; } } ctx.fillText(line, x, currentY);
}

// =====================================================
// MAIN LOOP
// =====================================================
let lastTime = performance.now();
let globalDt = 1;
let lastLoopErrorLogTime = 0;

function drawEmergencyRecoveryFrame(error) {
    try {
        resetCanvasContextState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (gameState === "playing") {
            ctx.fillStyle = "#09030a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#050505";
            ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(player.x - cameraX, player.y, player.width, player.height);
            ctx.fillStyle = "#e0f2fe";
            ctx.font = `bold 14px ${PIXEL_FONT}`;
            ctx.fillText("RECOVERING FRAME...", 24, 42);
        }
    } catch (_) {}
}

function gameLoop(currentTime) {
    try {
        if (!currentTime) currentTime = performance.now();
        globalDt = (currentTime - lastTime) / 8.5;
        lastTime = currentTime;

        if (globalDt > 3) globalDt = 3;
        if (globalDt < 0) globalDt = 0;

        update();
        draw();
    } catch (error) {
        const now = performance.now();
        if (now - lastLoopErrorLogTime > 1000) {
            console.error("Game loop recovered from an error:", error);
            lastLoopErrorLogTime = now;
        }
        drawEmergencyRecoveryFrame(error);
    } finally {
        requestAnimationFrame(gameLoop);
    }
}
requestAnimationFrame((time) => { lastTime = time; gameLoop(time); });
