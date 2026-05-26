// =====================================================
// SLAYER'S PATH - FULL GAME SCRIPT
// Clean HUD + Top Demon Path + 2 Dash Charges + Slower Enemies + Abilities + Total Concentration
//
// Controls:
// A / Left Arrow  = Move Left
// D / Right Arrow = Move Right
// W / Up Arrow    = Jump
// G               = Hold Normal Breathing / Charge Breath
// Space           = Guard
// Q               = Dash
// Mouse Left      = Attack
// 1-4             = Select Sword Abilities / Forms
// 5               = 5TH ABILITY: Total Concentration Breathing
// =====================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// =====================================================
// FONT
// =====================================================
const PIXEL_FONT = "'Courier New', monospace";

// =====================================================
// START SCREEN
// =====================================================
let gameState = "splash";
const splashEl = document.getElementById("splashScreen");

function startGameFromSplash() {
    if (gameState !== "splash") return;

    gameState = "playing";

    if (splashEl) {
        splashEl.classList.add("fade-out");

        setTimeout(() => {
            splashEl.style.display = "none";
        }, 1000);
    }
}

if (splashEl) {
    splashEl.addEventListener("click", startGameFromSplash);
}

// =====================================================
// AUDIO
// =====================================================
const m1Sounds = [
    new Audio("audio/combo1.mp3"),
    new Audio("audio/combo2.mp3"),
    new Audio("audio/combo3.mp3"),
    new Audio("audio/combo4.mp3")
];

const formSounds = {
    1: new Audio("audio/form1.mp3"),
    2: new Audio("audio/form2.mp3"),
    3: new Audio("audio/form3.mp3"),
    4: new Audio("audio/form4.mp3")
};

const sfxJump = new Audio("audio/jump.mp3");
const sfxDash = new Audio("audio/dash.mp3");
const sfxGuardPull = new Audio("audio/guard_pull.mp3");
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

// Breathing sound
const sfxBreathing = new Audio("audio/breathing.mp3");
sfxBreathing.loop = false;
sfxBreathing.volume = 0.55;
let wantsBreathingSound = false;

sfxBreathing.addEventListener("ended", () => {
    if (wantsBreathingSound && gameState === "playing" && !gameOver) {
        sfxBreathing.currentTime = 0;
        sfxBreathing.play().catch(() => {});
    }
});

function playSound(audioFile) {
    if (!audioFile) return;

    const s = audioFile.cloneNode();
    s.volume = audioFile.volume || 1;
    s.play().catch(() => {});
}

function startBreathingSound() {
    if (!sfxBreathing) return;

    wantsBreathingSound = true;

    if (sfxBreathing.paused || sfxBreathing.ended) {
        sfxBreathing.currentTime = 0;
        sfxBreathing.play().catch(() => {});
    }
}

function stopBreathingSoundAfterCurrentFile() {
    // Do not pause/reset. Just stop requesting another loop.
    // The currently playing breathing sound will naturally finish.
    wantsBreathingSound = false;
}

function updateBreathingSound() {
    const breathingStateActive = keys.G || player.totalConcentrationActive;


    if (gameState === "playing" && !gameOver && breathingStateActive) {
        startBreathingSound();
    } else {
        stopBreathingSoundAfterCurrentFile();
    }
}

function activateTotalConcentration() {
    if (player.totalConcentrationActive) return;
    if (player.totalConcentrationCooldown > 0) return;

    player.totalConcentrationActive = true;
    player.totalConcentrationTimer = player.totalConcentrationDuration;
    player.totalConcentrationCooldown = player.totalConcentrationCooldownMax;

    // 5TH ABILITY costs HP once, but will not instantly kill you.
    health = Math.max(1, health - 15);

    player.breathing = Math.min(player.maxBreathing, player.breathing + 50);


    pushHealText(player.x + player.width / 2, player.y - 18, "5TH ABILITY -15 HP");
    addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 26);
}

// =====================================================
// WORLD
// =====================================================
const MAP_WIDTH = 3000;
let GROUND_Y = 520;
let cameraX = 0;

let shakeTimer = 0;
let shakeStrength = 0;
let screenShakeX = 0;
let screenShakeY = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    GROUND_Y = Math.max(430, canvas.height - 160);

    player.baseY = GROUND_Y - player.height;

    if (player.isGrounded && !player.isAttacking) {
        player.y = player.baseY;
    }
}

window.addEventListener("resize", resizeCanvas);

// =====================================================
// GAME STATE
// =====================================================
let score = 0;
let combo = 0;
let comboTimer = 0;
let health = 100;
let gameOver = false;
let spawnTimer = 0;
let demonIdCounter = 1;
let timeScale = 1;

const demons = [];
const projectiles = [];
const waterTrails = [];
const foamParticles = [];
const jumpBursts = [];
const shockwaves = [];
const healTexts = [];
const clashSparks = [];
const parrySlashes = [];

const MAX_DEMONS = 11;
const MAX_PROJECTILES = 35;
const MAX_WATER_TRAILS = 70;
const MAX_FOAM = 140;
const MAX_JUMP_BURSTS = 10;
const MAX_SHOCKWAVES = 8;
const MAX_HEAL_TEXTS = 10;
const MAX_CLASH_SPARKS = 100;
const MAX_PARRY_SLASHES = 14;

// =====================================================
// ENEMY MILESTONES
// =====================================================
const MAX_PROGRESS_SCORE = 65000;

const enemyMilestones = [
    {
        score: 15000,
        enemy: "SNIPER DEMON",
        hp: "1 HP",
        description: "A ranged demon that keeps distance and fires blood projectiles.",
        tip: "TIP: Dash in, use forms, or deflect its projectile back.",
        revealed: false
    },
    {
        score: 30000,
        enemy: "SWIFT DEMON",
        hp: "2 HP",
        description: "A fast demon that dashes through you and attacks quickly.",
        tip: "TIP: Guard, parry, then punish after its dash.",
        revealed: false
    },
    {
        score: 60000,
        enemy: "BRUTE DEMON",
        hp: "8 HP",
        description: "A heavy demon with armor, brutal swings, and shockwaves.",
        tip: "TIP: M1 is weak. Use Whirlpool or stronger forms.",
        revealed: false
    },
    {
        score: 65000,
        enemy: "???",
        hp: "???",
        description: "A terrifying presence approaches...",
        tip: "TIP: Something powerful waits beyond this score.",
        revealed: false
    }
];

let enemyRevealPopup = {
    active: false,
    timer: 0,
    maxTimer: 420,
    title: "",
    description: "",
    tip: "",
    hp: "",
    scoreNeeded: 0
};

function checkEnemyMilestones() {
    for (let i = 0; i < enemyMilestones.length; i++) {
        const m = enemyMilestones[i];

        if (!m.revealed && score >= m.score) {
            m.revealed = true;
            startEnemyRevealPopup(m);
            break;
        }
    }
}

function startEnemyRevealPopup(milestone) {
    enemyRevealPopup.active = true;
    enemyRevealPopup.timer = enemyRevealPopup.maxTimer;
    enemyRevealPopup.title = milestone.enemy;
    enemyRevealPopup.description = milestone.description;
    enemyRevealPopup.tip = milestone.tip;
    enemyRevealPopup.hp = milestone.hp;
    enemyRevealPopup.scoreNeeded = milestone.score;

    timeScale = 0.15;

    playSound(sfxReveal);
    startCameraShake(20, 5);
}

function updateEnemyRevealPopup() {
    if (!enemyRevealPopup.active) {
        timeScale = 1;
        return;
    }

    enemyRevealPopup.timer--;

    if (enemyRevealPopup.timer <= 0) {
        enemyRevealPopup.active = false;
        timeScale = 1;
    }
}

// =====================================================
// PLAYER
// =====================================================
const keys = {
    Left: false,
    Right: false,
    G: false,
    W: false,
    Space: false
};

const player = {
    x: 400,
    y: GROUND_Y - 70,
    baseY: GROUND_Y - 70,
    vy: 0,
    isGrounded: true,

    width: 38,
    height: 70,
    speed: 6.5,
    guardSpeedMultiplier: 0.32,
    facing: "right",
    bodyRotation: 0,

    breathing: 60,
    maxBreathing: 150,

    totalConcentrationActive: false,
    totalConcentrationTimer: 0,
    totalConcentrationDuration: 480, // 8 seconds at around 60fps
    totalConcentrationCooldown: 0,
    totalConcentrationCooldownMax: 1200, // 20 seconds at around 60fps

    selectedForm: 0,
    currentForm: 0,

    isAttacking: false,
    attackFrame: 0,
    maxAttackFrames: 12,

    attackBox: {
        x: 0,
        y: 0,
        width: 90,
        height: 60
    },

    hitTargets: new Set(),
    m1AlreadyHit: false,

    isGuarding: false,
    guardFrame: 0,
    perfectParryFrames: 30,
    guardCooldown: 0,

    isStunned: false,
    stunTimer: 0,
    invincibleTimer: 0,

    isDashing: false,
    dashTimer: 0,
    dashDir: 1,

    dashCharges: 2,
    maxDashCharges: 2,
    dashRechargeTimer: 0,
    dashRechargeDelay: 120,

    jumpSquash: 0,
    landingSquash: 0,

    m1Step: 0
};

const formCooldowns = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
};

const maxCooldowns = {
    1: 140,
    2: 240,
    3: 360,
    4: 500
};

const attackDamage = {
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 5
};

resizeCanvas();

// =====================================================
// INPUT
// =====================================================
window.addEventListener("keydown", (e) => {
    if (gameState !== "playing") return;
    if (gameOver || player.isStunned) return;

    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.Left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.Right = true;
    if (e.code === "KeyG") {
        keys.G = true;
    }
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.W = true;

    if (e.code === "Space") {
        keys.Space = true;

        if (
            !player.isGuarding &&
            player.guardCooldown <= 0 &&
            !player.isAttacking &&
            !player.isDashing
        ) {
            player.isGuarding = true;
            player.guardFrame = 0;
            playSound(sfxGuardPull);
        }
    }

    if (
        e.code === "KeyQ" &&
        player.dashCharges > 0 &&
        !player.isAttacking &&
        !player.isGuarding &&
        !player.isDashing
    ) {
        player.isDashing = true;
        player.dashTimer = 10;
        player.invincibleTimer = 14;
        player.dashDir = player.facing === "right" ? 1 : -1;

        player.dashCharges--;

        if (player.dashRechargeTimer <= 0) {
            player.dashRechargeTimer = player.dashRechargeDelay;
        }

        playSound(sfxDash);
        addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 12);
    }

    if (e.code === "Digit1" && player.breathing >= 40 && formCooldowns[1] <= 0) {
        player.selectedForm = 1;
    }

    if (e.code === "Digit2" && player.breathing >= 80 && formCooldowns[2] <= 0) {
        player.selectedForm = 2;
    }

    if (e.code === "Digit3" && player.breathing >= 100 && formCooldowns[3] <= 0) {
        player.selectedForm = 3;
    }

    if (e.code === "Digit4" && player.breathing >= 140 && formCooldowns[4] <= 0) {
        player.selectedForm = 4;
    }

    if (e.code === "Digit5" && player.totalConcentrationCooldown <= 0 && !player.totalConcentrationActive) {
        if (!e.repeat) activateTotalConcentration();
    }
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
    if (gameState !== "playing") return;
    if (gameOver || player.isStunned || player.isGuarding || player.isDashing) return;
    if (e.button !== 0) return;
    if (player.isAttacking) return;
    if (keys.G) return;

    player.isAttacking = true;
    player.attackFrame = 0;
    player.currentForm = player.selectedForm;
    player.hitTargets.clear();
    player.m1AlreadyHit = false;

    if (player.currentForm === 0) {
        player.m1Step = player.m1Step ? (player.m1Step % 4) + 1 : 1;
        player.maxAttackFrames = 12;
    } else {
        player.m1Step = 0;
    }

    if (player.currentForm === 1) {
        player.maxAttackFrames = 62;
        player.breathing -= 40;
    } else if (player.currentForm === 2) {
        player.maxAttackFrames = 72;
        player.breathing -= 80;
     } else if (player.currentForm === 3) {
        player.maxAttackFrames = 120;
        player.breathing -= 100;

        // 3RD FORM: Whirlpool leap start.
        // Player launches upward, then the hover/vortex is handled in updatePlayerAttack().
        player.isGrounded = false;
        player.vy = 0;
        player.jumpSquash = 8;

        addFoamBurst(player.x + player.width / 2, player.y + player.height, 16);
        pushJumpBurst(player.x + player.width / 2, player.y + player.height, "jump");
        startCameraShake(6, 3.5);
    } else if (player.currentForm === 4) {
        player.maxAttackFrames = 130;
        player.breathing -= 140;
    }

    if (player.currentForm > 0) {
        playSound(formSounds[player.currentForm]);
    } else {
        playSound(m1Sounds[player.m1Step - 1]);
    }
});

// =====================================================
// HELPERS
// =====================================================
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function circleRectCollision(cx, cy, radius, rect, padding = 0) {
    const closestX = clamp(cx, rect.x - padding, rect.x + rect.width + padding);
    const closestY = clamp(cy, rect.y - padding, rect.y + rect.height + padding);

    const dx = cx - closestX;
    const dy = cy - closestY;

    return dx * dx + dy * dy <= radius * radius;
}

function distanceBetween(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

function pushWaterTrail(trail) {
    if (waterTrails.length >= MAX_WATER_TRAILS) {
        waterTrails.shift();
    }

    waterTrails.push(trail);
}

function pushProjectile(projectile) {
    if (projectiles.length >= MAX_PROJECTILES) {
        projectiles.shift();
    }

    projectiles.push(projectile);
}

function pushJumpBurst(x, y, type = "jump") {
    if (jumpBursts.length >= MAX_JUMP_BURSTS) {
        jumpBursts.shift();
    }

    jumpBursts.push({
        x,
        y,
        radius: type === "land" ? 34 : 24,
        alpha: 1,
        type
    });
}

function pushShockwave(x, y, maxRadius, damage, owner) {
    if (shockwaves.length >= MAX_SHOCKWAVES) {
        shockwaves.shift();
    }

    shockwaves.push({
        x,
        y,
        radius: 10,
        maxRadius,
        damage,
        alpha: 1,
        owner,
        hasHitPlayer: false
    });
}

function pushHealText(x, y, amount) {
    if (healTexts.length >= MAX_HEAL_TEXTS) {
        healTexts.shift();
    }

    healTexts.push({
        x,
        y,
        amount,
        alpha: 1,
        vy: -0.6,
        life: 70
    });
}

function pushClashSparks(x, y, amount = 20, color = "#fb923c") {
    for (let i = 0; i < amount; i++) {
        if (clashSparks.length >= MAX_CLASH_SPARKS) {
            clashSparks.shift();
        }

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3;

        clashSparks.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            length: Math.random() * 18 + 8,
            alpha: 1,
            color
        });
    }
}

function pushParrySlash(x, y) {
    if (parrySlashes.length >= MAX_PARRY_SLASHES) {
        parrySlashes.shift();
    }

    parrySlashes.push({
        x,
        y,
        alpha: 1,
        radius: 35,
        rotation: Math.random() * Math.PI
    });

    parrySlashes.push({
        x,
        y,
        alpha: 1,
        radius: 26,
        rotation: Math.random() * Math.PI
    });
}

function addFoamBurst(worldX, worldY, amount = 12) {
    for (let i = 0; i < amount; i++) {
        if (foamParticles.length >= MAX_FOAM) {
            foamParticles.shift();
        }

        foamParticles.push({
            x: worldX,
            y: worldY,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            radius: Math.random() * 6 + 2,
            alpha: 1,
            decay: Math.random() * 0.035 + 0.025
        });
    }
}

function startCameraShake(duration, strength) {
    shakeTimer = duration;
    shakeStrength = strength;
}

function saveHighScore(name, finalScore) {
    alert(`${name.toUpperCase()} SCORE: ${finalScore}`);
    location.reload();
}

function isPerfectParryWindow() {
    return player.isGuarding && player.guardFrame <= player.perfectParryFrames;
}

function handlePlayerDamage(amount) {
    if (player.invincibleTimer > 0) return;

    let finalDamage = amount;

    if (player.isGuarding) {
        finalDamage *= 0.35;
        player.breathing = Math.min(player.maxBreathing, player.breathing + 4);
        addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 6);
    }

    health -= finalDamage;
    combo = 0;
    comboTimer = 0;
    player.invincibleTimer = player.isGuarding ? 18 : 32;

    if (player.isGuarding) {
        playSound(sfxGuardDamage);
        playSound(sfxClash);

        pushClashSparks(
            player.x + player.width / 2,
            player.y + player.height / 2,
            24,
            "#fb923c"
        );

        pushClashSparks(
            player.x + player.width / 2,
            player.y + player.height / 2,
            10,
            "#ffffff"
        );
    } else {
        playSound(sfxPlayerHurt);
    }

    startCameraShake(player.isGuarding ? 6 : 10, player.isGuarding ? 4 : 8);

    if (health <= 0) {
        health = 0;
        gameOver = true;

        setTimeout(() => {
            const tag = prompt(`DIED IN BATTLE! Final Score: ${score}\nEnter your Name Tag:`) || "SLAYER";
            saveHighScore(tag, score);
        }, 50);
    }
}

function doPerfectParry(targetObject) {
    player.invincibleTimer = 35;
    player.guardCooldown = 0;

    combo += 6;
    comboTimer = 260;
    score += 1200;

    const healAmount = 8;
    health = Math.min(100, health + healAmount);
    player.breathing = Math.min(player.maxBreathing, player.breathing + 55);

    pushHealText(player.x + player.width / 2, player.y - 10, healAmount);

    if (targetObject) {
        targetObject.stunnedTimer = 130;
    }

    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    addFoamBurst(px, py, 28);
    pushClashSparks(px, py, 42, "#f97316");
    pushClashSparks(px, py, 28, "#ffffff");
    pushClashSparks(px, py, 18, "#38bdf8");
    pushParrySlash(px, py);
    stunNearbyEnemies(px, py, 150);
    startCameraShake(14, 10);

    playSound(sfxParryClang);
    playSound(sfxPerfectParry);

    return true;
}

function stunNearbyEnemies(x, y, radius) {
    demons.forEach((d) => {
        const dx = d.x + d.width / 2 - x;
        const dy = d.y + d.height / 2 - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
            d.stunnedTimer = Math.max(d.stunnedTimer, 70);
            d.health -= 0.5;
        }
    });
}

function handleGuardOrParryAgainstPhysical(targetObject, damageAmount) {
    if (!player.isGuarding) {
        handlePlayerDamage(damageAmount);
        return;
    }

    if (isPerfectParryWindow()) {
        doPerfectParry(targetObject);
        return;
    }

    handlePlayerDamage(damageAmount);
}

// =====================================================
// DEMON SPAWNING
// =====================================================
function spawnDemonPool() {
    if (demons.length >= MAX_DEMONS) return;

    const seed = Math.random();

    let type = "grunt";
    let speed = 1.4 + Math.random() * 1.2;
    let hp = 1 + Math.floor(Math.random() * 3);
    let color = "#7f1d1d";
    let width = 42;
    let height = 55;

    if (score >= 60000 && seed < 0.12) {
        type = "brute";
        hp = 8;
        speed = 0.85;
        color = "#4c0519";
        width = 58;
        height = 78;
    } else if (score >= 30000 && seed >= 0.12 && seed < 0.26) {
        type = "swift";
        hp = 2;
        speed = 3.25;
        color = "#991b1b";
        width = 36;
        height = 50;
    } else if (score >= 15000 && seed >= 0.26 && seed < 0.38) {
        type = "sniper";
        hp = 1;
        speed = 1.45;
        color = "#311042";
        width = 40;
        height = 58;
    }

    const spawnLeft = Math.random() < 0.5;

    // Spawn from the actual far left / far right of the whole map,
    // so enemies do not teleport close to the player.
    const x = spawnLeft
        ? 0
        : MAP_WIDTH - width;

    demons.push({
        id: demonIdCounter++,

        x,
        y: GROUND_Y - height,
        width,
        height,
        type,
        speed,
        health: hp,
        maxHealth: hp,
        color,

        jumpTimer: 0,
        shootTimer: 0,
        stunnedTimer: 0,

        attackWindup: 0,
        attackCooldown: 75,
        attackFlash: 0,
        attackRange: type === "brute" ? 70 : type === "swift" ? 52 : 48,
        attackHasHit: false,

        dashTimer: 0,
        dashCooldown: 120 + Math.random() * 60,
        dashDir: 1,
        dashDamageBoxTimer: 0,

        slamWindup: 0,
        slamCooldown: 190,
        slamActive: false
    });
}

// =====================================================
// UPDATE
// =====================================================
function update() {
    if (gameState !== "playing") return;
    if (gameOver) return;

    updateEnemyRevealPopup();
    updateBreathingSound();
    checkEnemyMilestones();

    const realDt = 1; // UI cooldowns / ability timers use this so they never speed up or slow down.
    let dt = timeScale;

    if (keys.G && player.isGrounded && !player.isAttacking && !player.isGuarding && !player.isStunned) {
        dt = 0.2 * timeScale;
    }

    updateTimers(dt, realDt);
    updatePlayerMovement(dt);
    updatePlayerAttack(dt);
    updateParticlesAndTrails(dt);
    updateJumpBursts(dt);
    updateShockwaves(dt);
    updateHealTexts(dt);
    updateProjectiles(dt);
    updateDemons(dt);
    updateCamera(dt);
}

function updateTimers(dt, realDt = 1) {
    if (player.invincibleTimer > 0) player.invincibleTimer -= dt;
    if (player.guardCooldown > 0) player.guardCooldown -= dt;
    if (player.jumpSquash > 0) player.jumpSquash -= dt;
    if (player.landingSquash > 0) player.landingSquash -= dt;

    if (player.dashCharges < player.maxDashCharges) {
        player.dashRechargeTimer -= dt;

        if (player.dashRechargeTimer <= 0) {
            player.dashCharges++;

            if (player.dashCharges < player.maxDashCharges) {
                player.dashRechargeTimer = player.dashRechargeDelay;
            } else {
                player.dashRechargeTimer = 0;
            }
        }
    }

    if (player.totalConcentrationActive) {
        player.totalConcentrationTimer -= realDt;

        if (player.totalConcentrationTimer <= 0) {
            player.totalConcentrationActive = false;
            player.totalConcentrationTimer = 0;
        }
    }

    if (player.totalConcentrationCooldown > 0) {
        player.totalConcentrationCooldown -= realDt;

        if (player.totalConcentrationCooldown < 0) {
            player.totalConcentrationCooldown = 0;
        }
    }

    if (player.isGuarding) {
        player.guardFrame += dt;
    }

    if (comboTimer > 0) {
        comboTimer -= dt;

        if (comboTimer <= 0) {
            combo = 0;
        }
    }

    for (const key in formCooldowns) {
        if (formCooldowns[key] > 0) {
            formCooldowns[key] -= dt;
        }
    }

    if (player.isStunned) {
        player.stunTimer -= dt;

        if (player.stunTimer <= 0) {
            player.isStunned = false;
        }
    }
}

function updatePlayerMovement(dt) {
    if (player.isDashing) {
        player.x += player.dashDir * 18 * dt;
        player.dashTimer -= dt;

        if (player.dashTimer <= 0) {
            player.isDashing = false;
        }

        player.x = clamp(player.x, 0, MAP_WIDTH - player.width);
        return;
    }

    if (player.totalConcentrationActive && !player.isAttacking && !player.isStunned) {
        player.breathing = Math.min(player.maxBreathing, player.breathing + 0.75 * dt);
    }

    if (keys.G && player.isGrounded && !player.isAttacking && !player.isGuarding && !player.isStunned) {
        player.breathing = Math.min(player.maxBreathing, player.breathing + 1.2 * dt);
        player.bodyRotation = Math.sin(Date.now() / 40) * 0.05;
    }

    if (!player.isStunned && !keys.G) {
        if (keys.W && player.isGrounded && !player.isAttacking && !player.isGuarding) {
            player.vy = -13.4;
            player.isGrounded = false;
            player.jumpSquash = 10;

            playSound(sfxJump);
            addFoamBurst(player.x + player.width / 2, player.y + player.height, 14);
            pushJumpBurst(player.x + player.width / 2, player.y + player.height, "jump");
        }

        const moveSpeed = player.isGuarding
            ? player.speed * player.guardSpeedMultiplier
            : player.speed;

        if (keys.Left && !player.isAttacking) {
            player.x -= moveSpeed * dt;
            player.facing = "left";
            player.bodyRotation = player.isGrounded ? -0.08 : -0.18;
        } else if (keys.Right && !player.isAttacking) {
            player.x += moveSpeed * dt;
            player.facing = "right";
            player.bodyRotation = player.isGrounded ? 0.08 : 0.18;
        } else if (!player.isAttacking && !player.isGuarding) {
            player.bodyRotation *= 0.84;
        }
    }

    if (!player.isGrounded) {
        player.vy += 0.56 * dt;
        player.y += player.vy * dt;

        if (player.vy < 0) {
            player.bodyRotation += (player.facing === "right" ? 0.01 : -0.01) * dt;
        } else {
            player.bodyRotation += (player.facing === "right" ? -0.008 : 0.008) * dt;
        }

        if (player.y >= player.baseY) {
            player.y = player.baseY;
            player.isGrounded = true;
            player.vy = 0;
            player.landingSquash = 9;

            addFoamBurst(player.x + player.width / 2, player.y + player.height, 10);
            pushJumpBurst(player.x + player.width / 2, player.y + player.height, "land");
            startCameraShake(4, 2.5);
        }
    }

    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);
}

function updateCamera(dt) {
    const targetCamX = player.x - canvas.width / 2;
    cameraX += (targetCamX - cameraX) * 0.1;
    cameraX = clamp(cameraX, 0, MAP_WIDTH - canvas.width);

    if (shakeTimer > 0) {
        shakeTimer -= dt;
        screenShakeX = (Math.random() - 0.5) * shakeStrength;
        screenShakeY = (Math.random() - 0.5) * shakeStrength;
    } else {
        screenShakeX = 0;
        screenShakeY = 0;
    }
}

function updatePlayerAttack(dt) {
    if (!player.isAttacking) return;

    player.attackFrame += dt;

    const f = player.attackFrame;
    const totalF = player.maxAttackFrames;
    const pct = f / totalF;
    const direction = player.facing === "right" ? 1 : -1;

    if (player.currentForm === 1) {
        player.x += direction * 3.2 * dt;

        player.attackBox.width = 220;
        player.attackBox.height = 58;
        player.attackBox.y = player.y + 8;
    } else if (player.currentForm === 2) {
        const arcH = Math.sin(pct * Math.PI) * 170;

        player.y = player.baseY - arcH;
        player.x += direction * 3.5 * dt;
        player.bodyRotation = pct * Math.PI * 2 * direction;

        player.attackBox.width = 175;
        player.attackBox.height = 175;
        player.attackBox.y = player.y - 48;
        } else if (player.currentForm === 3) {
        // 3RD FORM: Whirlpool / Water Vortex
        // The player leaps, hangs in the air, and the vortex becomes the defensive hit radius.
        const leapHeight = 145;
        const leapIn = clamp(pct / 0.18, 0, 1);
        const hoverWave = Math.sin(f * 0.18) * 5;

        if (pct < 0.18) {
            player.y = player.baseY - Math.sin(leapIn * Math.PI * 0.5) * leapHeight;
        } else if (pct < 0.88) {
            player.y = player.baseY - leapHeight + hoverWave;
            player.vy = 0;
        } else {
            const fallPrep = clamp((pct - 0.88) / 0.12, 0, 1);
            player.y = player.baseY - leapHeight + hoverWave + fallPrep * 35;
            player.vy = 0;
        }

        player.isGrounded = false;
        player.bodyRotation = Math.sin(f * 0.16) * 0.16;

        player.attackBox.width = 370;
        player.attackBox.height = 370;
        player.attackBox.y = player.y + player.height / 2 - 185;

        if (Math.floor(f) % 18 === 0) {
            addFoamBurst(player.x + player.width / 2, player.y + player.height / 2 + 45, 4);
        }
    } else if (player.currentForm === 4) {
        updateFlowingDance(f, totalF, pct, direction, dt);
    } else {
        player.attackBox.width = 105;
        player.attackBox.height = 62;
        player.attackBox.y = player.y + 8;
    }

    if (player.currentForm === 3) {
        player.attackBox.x = player.x + player.width / 2 - player.attackBox.width / 2;
    } else {
        player.attackBox.x = player.facing === "right"
            ? player.x + player.width
            : player.x - player.attackBox.width;
    }

    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);

    if (player.currentForm !== 4 && f > 1 && Math.floor(f) % 3 === 0) {
        pushWaterTrail({
            form: player.currentForm,
            x: player.attackBox.x,
            y: player.attackBox.y,
            w: player.attackBox.width,
            h: player.attackBox.height,
            facing: player.facing,
            frame: f,
            maxFrame: totalF,
            alpha: 1,
            playerX: player.x,
            playerY: player.y,
            m1Step: player.m1Step
        });
    }

    if (f >= totalF) {
        endAttack();
    }
}

function updateFlowingDance(frame, totalFrames, progress, direction, dt) {
    const forward = Math.sin(progress * Math.PI) * 5.5;
    const waveX = Math.sin(progress * Math.PI * 2.2) * 5;
    const waveY = Math.sin(progress * Math.PI * 4) * 24;

    player.x += (direction * forward + waveX) * dt;
    player.y = player.baseY + waveY;
    player.bodyRotation = Math.sin(progress * Math.PI * 4) * 0.38;

    player.attackBox.width = 330;
    player.attackBox.height = 165;
    player.attackBox.y = player.y - 48;

    if (Math.floor(frame) % 7 === 0) {
        pushWaterTrail({
            form: 4,
            x: player.x,
            y: player.y,
            w: player.attackBox.width,
            h: player.attackBox.height,
            facing: player.facing,
            frame,
            maxFrame: totalFrames,
            alpha: 1,
            playerX: player.x,
            playerY: player.y,
            m1Step: player.m1Step,
            ribbon: true
        });
    }

    if (Math.floor(frame) % 16 === 0) {
        addFoamBurst(
            player.x + player.width / 2,
            player.y + player.height / 2,
            3
        );
    }
}

function endAttack() {
    const finishedForm = player.currentForm;

    if (player.currentForm > 0) {
        formCooldowns[player.currentForm] = maxCooldowns[player.currentForm];
    }

    player.isAttacking = false;
    player.attackFrame = 0;
    player.hitTargets.clear();
    player.m1AlreadyHit = false;

    if (finishedForm === 3) {
        // Let the player naturally fall after Whirlpool ends.
        player.isGrounded = false;
        player.vy = 4.2;
    } else {
        player.y = player.isGrounded ? player.baseY : player.y;
    }

    player.bodyRotation = 0;
    player.currentForm = 0;
    player.selectedForm = 0;
}

function updateParticlesAndTrails(dt) {
    for (let i = waterTrails.length - 1; i >= 0; i--) {
        const trail = waterTrails[i];

        // Smoother fade for all forms so water visuals do not pop away suddenly.
        let fadeSpeed = 0.034;
        if (trail.form === 3) fadeSpeed = 0.022;
        if (trail.form === 4) fadeSpeed = 0.028;

        trail.alpha -= fadeSpeed * dt;

        if (trail.alpha <= 0) {
            waterTrails.splice(i, 1);
        }
    }

    for (let i = foamParticles.length - 1; i >= 0; i--) {
        const p = foamParticles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= p.decay * dt;

        if (p.alpha <= 0) {
            foamParticles.splice(i, 1);
        }
    }

    for (let i = clashSparks.length - 1; i >= 0; i--) {
        const s = clashSparks[i];

        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.alpha -= 0.06 * dt;

        if (s.alpha <= 0) {
            clashSparks.splice(i, 1);
        }
    }

    for (let i = parrySlashes.length - 1; i >= 0; i--) {
        const p = parrySlashes[i];

        p.radius += 9 * dt;
        p.alpha -= 0.055 * dt;

        if (p.alpha <= 0) {
            parrySlashes.splice(i, 1);
        }
    }
}

function updateJumpBursts(dt) {
    for (let i = jumpBursts.length - 1; i >= 0; i--) {
        const b = jumpBursts[i];

        b.radius += b.type === "land" ? 5 * dt : 4 * dt;
        b.alpha -= 0.055 * dt;

        if (b.alpha <= 0) {
            jumpBursts.splice(i, 1);
        }
    }
}

function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];

        sw.radius += 8 * dt;
        sw.alpha -= 0.045 * dt;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;

        const dist = distanceBetween(sw.x, sw.y, playerCenterX, playerCenterY);

        if (!sw.hasHitPlayer && dist <= sw.radius + 14 && dist >= sw.radius - 40) {
            sw.hasHitPlayer = true;
            handleGuardOrParryAgainstPhysical(sw.owner, sw.damage);
        }

        if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
            shockwaves.splice(i, 1);
        }
    }
}

function updateHealTexts(dt) {
    for (let i = healTexts.length - 1; i >= 0; i--) {
        const h = healTexts[i];

        h.y += h.vy * dt;
        h.life -= dt;
        h.alpha = h.life / 70;

        if (h.life <= 0) {
            healTexts.splice(i, 1);
        }
    }
}

// =====================================================
// PROJECTILES
// =====================================================
function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];

        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;

        if (pr.duration) {
            pr.duration -= dt;

            if (pr.duration <= 0) {
                projectiles.splice(i, 1);
                continue;
            }
        }

        if (pr.x < 0 || pr.x > MAP_WIDTH) {
            projectiles.splice(i, 1);
            continue;
        }

        if (pr.deflected) {
            for (let j = demons.length - 1; j >= 0; j--) {
                const d = demons[j];

                if (
                    pr.x > d.x &&
                    pr.x < d.x + d.width &&
                    pr.y > d.y &&
                    pr.y < d.y + d.height
                ) {
                    d.health -= 3;
                    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 8);
                    projectiles.splice(i, 1);
                    playSound(sfxProjectileHit);
                    playSound(sfxDemonHit);

                    if (d.health <= 0) {
                        killDemon(j, d);
                    }

                    break;
                }
            }
        } else {
            const playerRect = {
                x: player.x,
                y: player.y,
                width: player.width,
                height: player.height
            };

            const hitPlayer = circleRectCollision(
                pr.x,
                pr.y,
                pr.radius,
                playerRect,
                player.isGuarding ? 42 : 6
            );

            const hitAttack =
                player.isAttacking &&
                player.currentForm > 0 &&
                player.attackFrame > 1 &&
                circleRectCollision(
                    pr.x,
                    pr.y,
                    pr.radius,
                    player.attackBox,
                    12
                );

            if (hitPlayer || hitAttack) {
                if (player.isGuarding || hitAttack) {
                    pr.vx = -pr.vx * 1.5;
                    pr.vy = (Math.random() - 0.5) * 3;
                    pr.color = "#38bdf8";
                    pr.deflected = true;

                    addFoamBurst(pr.x, pr.y, 10);
                    playSound(sfxParryClang);
                    pushClashSparks(pr.x, pr.y, 20, "#fb923c");

                    if (isPerfectParryWindow()) {
                        doPerfectParry(null);
                    } else {
                        combo++;
                        comboTimer = 240;
                        score += 180;
                        player.breathing = Math.min(player.maxBreathing, player.breathing + 10);
                    }
                } else {
                    playSound(sfxProjectileHit);
                    handlePlayerDamage(pr.damage);
                    projectiles.splice(i, 1);
                }
            }
        }
    }
}

// =====================================================
// DEMONS
// =====================================================
function updateDemons(dt) {
    spawnTimer += dt;

    if (spawnTimer >= 90) {
        spawnTimer = 0;
        spawnDemonPool();
    }

    for (let i = demons.length - 1; i >= 0; i--) {
        const d = demons[i];

        const beforeCount = demons.length;
        handlePlayerAttackAgainstDemon(i, d);

        if (demons.length < beforeCount) {
            continue;
        }

        if (d.stunnedTimer > 0) {
            d.stunnedTimer -= dt;
            d.attackWindup = 0;
            d.attackFlash = 0;
            continue;
        }

        if (d.attackCooldown > 0) d.attackCooldown -= dt;
        if (d.attackFlash > 0) d.attackFlash -= dt;
        if (d.dashCooldown > 0) d.dashCooldown -= dt;
        if (d.slamCooldown > 0) d.slamCooldown -= dt;

        moveDemon(d, dt);
        updateDemonAttack(d, dt);
    }
}

function moveDemon(d, dt) {
    const playerCenter = player.x + player.width / 2;
    const demonCenter = d.x + d.width / 2;
    const dist = Math.abs(playerCenter - demonCenter);
    const dir = demonCenter < playerCenter ? 1 : -1;

    if (d.type === "swift") {
        updateSwiftMovement(d, dt, dist, dir);
        return;
    }

    if (d.type === "brute") {
        updateBruteMovement(d, dt, dist, dir);
        return;
    }

    if (d.type === "sniper") {
        updateSniperMovement(d, dt, dist, dir);
        return;
    }

    updateGruntMovement(d, dt, dist, dir);
}

function updateGruntMovement(d, dt, dist, dir) {
    if (d.attackWindup > 0) return;

    if (dist > d.attackRange) {
        d.x += dir * d.speed * dt;
    } else {
        d.x -= dir * 0.25 * dt;
    }

    d.x = clamp(d.x, 0, MAP_WIDTH - d.width);
}

function updateSniperMovement(d, dt, dist, dir) {
    if (dist > 460) {
        d.x += dir * d.speed * dt;
    } else if (dist < 300) {
        d.x -= dir * d.speed * dt;
    }

    d.shootTimer += dt;

    if (d.shootTimer >= 210) {
        d.shootTimer = 0;

        pushProjectile({
            x: d.x + d.width / 2,
            y: d.y + 18,
            vx: dir * 5.7,
            vy: 0,
            radius: 10,
            coreRadius: 5,
            color: "#c084fc",
            damage: 12,
            deflected: false
        });

        playSound(sfxProjectileShoot);
    }

    d.x = clamp(d.x, 0, MAP_WIDTH - d.width);
}

function updateSwiftMovement(d, dt, dist, dir) {
    if (d.attackWindup > 0) return;

    if (d.dashTimer > 0) {
        d.x += d.dashDir * 10.8 * dt;
        d.dashTimer -= dt;
        d.dashDamageBoxTimer = 7;

        addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 1);

        d.x = clamp(d.x, 0, MAP_WIDTH - d.width);
        return;
    }

    if (dist > 120) {
        d.x += dir * d.speed * dt;
    } else {
        d.x -= dir * 1.5 * dt;
    }

    if (d.dashCooldown <= 0 && dist < 330 && dist > 70) {
        d.dashCooldown = 180;
        d.dashTimer = 15;
        d.dashDir = dir;
        d.attackHasHit = false;

        playSound(sfxSwiftDash);
        addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 10);
    }

    d.x = clamp(d.x, 0, MAP_WIDTH - d.width);
}

function updateBruteMovement(d, dt, dist, dir) {
    if (d.slamWindup > 0) {
        d.slamWindup -= dt;
        d.attackFlash = Math.max(d.attackFlash, 5);

        if (d.slamWindup <= 0) {
            d.slamCooldown = 260;
            d.attackCooldown = 145;

            playSound(sfxBruteSlam);
            startCameraShake(12, 9);
            addFoamBurst(d.x + d.width / 2, d.y + d.height, 24);
            pushShockwave(d.x + d.width / 2, d.y + d.height - 5, 185, 12, d);
        }

        return;
    }

    if (d.attackWindup > 0) return;

    if (dist > 95) {
        d.x += dir * d.speed * dt;
    } else {
        d.x -= dir * 0.2 * dt;
    }

    if (d.slamCooldown <= 0 && dist < 210) {
        d.slamWindup = 48;
        d.attackFlash = 48;
        playSound(sfxBruteWindup);
    }

    d.x = clamp(d.x, 0, MAP_WIDTH - d.width);
}

function updateDemonAttack(d, dt) {
    if (d.type === "sniper") return;

    const playerCenter = player.x + player.width / 2;
    const demonCenter = d.x + d.width / 2;
    const dist = Math.abs(playerCenter - demonCenter);

    if (d.type === "swift") {
        updateSwiftAttack(d, dist, dt);
        return;
    }

    if (d.type === "brute") {
        updateBruteAttack(d, dist, dt);
        return;
    }

    updateGruntAttack(d, dist, dt);
}

function updateGruntAttack(d, dist, dt) {
    if (dist <= d.attackRange + 12 && d.attackCooldown <= 0 && d.attackWindup <= 0) {
        d.attackWindup = 26;
        d.attackFlash = d.attackWindup;
        d.attackHasHit = false;
        playSound(sfxGruntAttack);
    }

    if (d.attackWindup > 0) {
        d.attackWindup -= dt;

        if (d.attackWindup <= 0) {
            d.attackCooldown = 105;

            const attackBox = getDemonAttackBox(d);
            const playerBox = getPlayerBox();

            if (!d.attackHasHit && rectsOverlap(attackBox, playerBox)) {
                d.attackHasHit = true;
                handleGuardOrParryAgainstPhysical(d, 5);
            }
        }
    }
}

function updateSwiftAttack(d, dist, dt) {
    const swiftHitBox = {
        x: d.x - 10,
        y: d.y + 8,
        width: d.width + 20,
        height: d.height - 8
    };

    if (d.dashDamageBoxTimer > 0) {
        d.dashDamageBoxTimer -= dt;

        if (!d.attackHasHit && rectsOverlap(swiftHitBox, getPlayerBox())) {
            d.attackHasHit = true;
            playSound(sfxSwiftAttack);
            handleGuardOrParryAgainstPhysical(d, 7);
        }
    }

    if (dist <= d.attackRange + 8 && d.attackCooldown <= 0 && d.attackWindup <= 0 && d.dashTimer <= 0) {
        d.attackWindup = 18;
        d.attackFlash = d.attackWindup;
        d.attackHasHit = false;
        playSound(sfxSwiftAttack);
    }

    if (d.attackWindup > 0) {
        d.attackWindup -= dt;

        if (d.attackWindup <= 0) {
            d.attackCooldown = 95;

            const attackBox = getDemonAttackBox(d);
            const playerBox = getPlayerBox();

            if (!d.attackHasHit && rectsOverlap(attackBox, playerBox)) {
                d.attackHasHit = true;
                handleGuardOrParryAgainstPhysical(d, 6);
            }
        }
    }
}

function updateBruteAttack(d, dist, dt) {
    if (d.slamWindup > 0) return;

    if (dist <= d.attackRange + 12 && d.attackCooldown <= 0 && d.attackWindup <= 0) {
        d.attackWindup = 38;
        d.attackFlash = d.attackWindup;
        d.attackHasHit = false;
        playSound(sfxBruteWindup);
    }

    if (d.attackWindup > 0) {
        d.attackWindup -= dt;

        if (d.attackWindup <= 0) {
            d.attackCooldown = 145;

            const attackBox = getDemonAttackBox(d);
            const playerBox = getPlayerBox();

            playSound(sfxBruteSlam);
            startCameraShake(7, 5);

            if (!d.attackHasHit && rectsOverlap(attackBox, playerBox)) {
                d.attackHasHit = true;
                handleGuardOrParryAgainstPhysical(d, 10);
            }
        }
    }
}

function getPlayerBox() {
    return {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    };
}

function getDemonAttackBox(d) {
    const facingRight = d.x + d.width / 2 < player.x + player.width / 2;
    const range = d.type === "brute" ? 78 : d.type === "swift" ? 60 : 48;

    return {
        x: facingRight ? d.x + d.width : d.x - range,
        y: d.y + 10,
        width: range,
        height: d.height - 8
    };
}

function handlePlayerAttackAgainstDemon(index, d) {
    if (!player.isAttacking || player.attackFrame <= 1) return;

    if (player.hitTargets.has(d.id)) return;

    if (player.currentForm === 0 && player.m1AlreadyHit) return;

    const hitDemon =
        player.attackBox.x < d.x + d.width &&
        player.attackBox.x + player.attackBox.width > d.x &&
        player.attackBox.y < d.y + d.height &&
        player.attackBox.y + player.attackBox.height > d.y;

    if (!hitDemon) return;

    if (d.type === "brute" && player.currentForm === 0) {
        player.isAttacking = false;
        player.isStunned = true;
        player.stunTimer = 30;
        player.invincibleTimer = 22;
        playSound(sfxParryClang);
        pushClashSparks(d.x + d.width / 2, d.y + d.height / 2, 26, "#fb923c");
        startCameraShake(7, 5);
        return;
    }

    let damageValue = attackDamage[player.currentForm];

    if (player.currentForm === 1 && d.type === "swift") {
        damageValue += 1;
    }

    if (player.currentForm === 2 && d.type === "swift") {
        damageValue += 1;
    }

    if (player.currentForm === 3 && d.type === "brute") {
        damageValue += 2;
    }

    if (player.currentForm === 4) {
        damageValue += 1;
    }

    d.health -= damageValue;
    player.hitTargets.add(d.id);

    if (player.currentForm === 0) {
        player.m1AlreadyHit = true;
    }

    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 8);
    pushClashSparks(d.x + d.width / 2, d.y + d.height / 2, 12, "#ffffff");
    playSound(sfxDemonHit);

    combo++;
    comboTimer = 240;
    score += 20;

    if (d.health <= 0) {
        killDemon(index, d);
    }
}

function killDemon(index, d) {
    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 14);

    demons.splice(index, 1);

    combo++;
    comboTimer = 240;

    if (d.type === "brute") {
        score += 600;
    } else if (d.type === "swift") {
        score += 400;
    } else if (d.type === "sniper") {
        score += 350;
    } else {
        score += 200;
    }

    if (combo % 10 === 0) {
        health = Math.min(100, health + 4);
        player.breathing = Math.min(player.maxBreathing, player.breathing + 18);
    }
}

// =====================================================
// DRAWING
// =====================================================
function draw() {
    if (gameState !== "playing") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(screenShakeX, screenShakeY);

    drawBackground();
    drawParticles();
    drawJumpBursts();
    drawShockwaves();
    drawWaterTrails();
    drawPlayer();
    drawProjectiles();
    drawEnemies();
    drawCombatSparks();
    drawHealTexts();
    drawEnemyProgressBar();
    drawHUD();
    drawEnemyRevealPopup();

    ctx.restore();
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#09030a");
    sky.addColorStop(0.35, "#1a0905");
    sky.addColorStop(0.75, "#3a1608");
    sky.addColorStop(1, "#08070a");

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.45,
        30,
        canvas.width * 0.5,
        canvas.height * 0.45,
        canvas.width * 0.8
    );

    glow.addColorStop(0, "rgba(255, 150, 70, 0.22)");
    glow.addColorStop(0.35, "rgba(190, 70, 25, 0.12)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(90, 20, 10, 0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(5, 4, 6, 0.9)";
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(0, GROUND_Y, canvas.width, 4);

    ctx.fillStyle = "rgba(255, 120, 40, 0.35)";
    ctx.fillRect(0, GROUND_Y + 4, canvas.width, 2);
}

function drawParticles() {
    foamParticles.forEach((p) => {
        drawWaveFoam(p.x - cameraX, p.y, p.radius, p.alpha);
    });
}

function drawJumpBursts() {
    jumpBursts.forEach((b) => {
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = b.type === "land" ? "#e0f2fe" : "#38bdf8";
        ctx.lineWidth = b.type === "land" ? 4 : 3;
        ctx.beginPath();
        ctx.ellipse(
            b.x - cameraX,
            b.y,
            b.radius * 1.5,
            b.radius * 0.35,
            0,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
    });
}

function drawShockwaves() {
    shockwaves.forEach((sw) => {
        ctx.save();
        ctx.globalAlpha = sw.alpha;
        ctx.strokeStyle = "#fb923c";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.ellipse(sw.x - cameraX, sw.y, sw.radius * 1.35, sw.radius * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sw.x - cameraX, sw.y, sw.radius * 0.85, sw.radius * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
}

function drawCombatSparks() {
    parrySlashes.forEach((p) => {
        ctx.save();
        ctx.translate(p.x - cameraX, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;

        ctx.shadowBlur = 35;
        ctx.shadowColor = "#f97316";

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-p.radius, -p.radius * 0.35);
        ctx.lineTo(p.radius, p.radius * 0.35);
        ctx.stroke();

        ctx.strokeStyle = "#fb923c";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-p.radius * 0.85, p.radius * 0.35);
        ctx.lineTo(p.radius * 0.85, -p.radius * 0.35);
        ctx.stroke();

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-p.radius * 0.5, 0);
        ctx.lineTo(p.radius * 0.5, 0);
        ctx.stroke();

        ctx.restore();
    });

    clashSparks.forEach((s) => {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = s.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = s.color;
        ctx.lineWidth = 3;

        const angle = Math.atan2(s.vy, s.vx);

        ctx.beginPath();
        ctx.moveTo(s.x - cameraX, s.y);
        ctx.lineTo(
            s.x - cameraX - Math.cos(angle) * s.length,
            s.y - Math.sin(angle) * s.length
        );
        ctx.stroke();

        ctx.restore();
    });
}

function drawWaveFoam(x, y, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawWaterTrails() {
    waterTrails.forEach((t) => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.shadowBlur = 25;

        const centerHandX = t.facing === "right" ? t.playerX + player.width : t.playerX;
        const centerHandY = t.playerY + player.height / 2;

        if (t.form === 1) {
            drawForm1Trail(t);
        } else if (t.form === 2) {
            drawForm2Trail(t, centerHandX, centerHandY);
        } else if (t.form === 3) {
            drawForm3Trail(t);
        } else if (t.form === 4) {
            drawForm4Trail(t);
        } else {
            drawM1Trail(t, centerHandX, centerHandY);
        }

        ctx.restore();
    });
}

function drawForm1Trail(t) {
    ctx.shadowColor = "#38bdf8";

    ctx.fillStyle = "#1e40af";
    ctx.fillRect(t.x - cameraX, t.y - 4, t.w, t.h + 8);

    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(t.x - cameraX, t.y + 4, t.w * 0.9, t.h - 8);

    for (let i = 0; i < t.w; i += 25) {
        drawWaveFoam(
            t.x - cameraX + i,
            t.y + (i % 3 === 0 ? 0 : t.h),
            7 + (i % 4),
            t.alpha
        );
    }
}

function drawForm2Trail(t, centerHandX, centerHandY) {
    ctx.shadowColor = "#06b6d4";

    const pivotX = centerHandX + (t.facing === "right" ? 55 : -55);

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(pivotX - cameraX, centerHandY, 72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(pivotX - cameraX, centerHandY, 72, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const fx = pivotX + Math.cos(a) * 72;
        const fy = centerHandY + Math.sin(a) * 72;
        drawWaveFoam(fx - cameraX, fy, 9, t.alpha);
    }
}

function drawForm3Trail(t) {
    ctx.shadowColor = "#38bdf8";

    const angle = (t.frame * 0.4) % (Math.PI * 2);
    const radius = 135;
    const centerX = t.playerX + player.width / 2 - cameraX;
    const centerY = t.playerY + player.height / 2;

    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 25;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + Math.PI, false);
    ctx.stroke();

    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle + Math.PI / 2, angle + Math.PI * 1.5, false);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += 0.55) {
        const r = radius + Math.sin(t.frame * 0.25 + a) * 14;
        const fx = centerX + Math.cos(a + angle) * r;
        const fy = centerY + Math.sin(a + angle) * r;

        drawWaveFoam(fx, fy, 7, t.alpha * 0.9);
    }
}

function drawForm4Trail(t) {
    const dir = t.facing === "right" ? 1 : -1;
    const progress = t.frame / t.maxFrame;

    const startX = t.playerX + player.width / 2 - cameraX;
    const startY = t.playerY + player.height / 2;

    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 28;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawFlowingDanceRibbon(
        startX,
        startY,
        dir,
        progress,
        30,
        `rgba(30, 64, 175, ${t.alpha * 0.65})`
    );

    drawFlowingDanceRibbon(
        startX,
        startY,
        dir,
        progress,
        12,
        `rgba(56, 189, 248, ${t.alpha})`
    );

    drawFlowingDanceRibbon(
        startX,
        startY - 8,
        dir,
        progress,
        4,
        `rgba(255, 255, 255, ${t.alpha * 0.85})`
    );

    for (let i = 0; i <= 1; i += 0.2) {
        const wave = Math.sin((i + progress) * Math.PI * 3.6);
        const curl = Math.sin((i + progress) * Math.PI * 1.8);

        const x = startX + dir * (i * 380 - 100);
        const y = startY + wave * 58 + curl * 22;

        drawWaveFoam(x, y, 5, t.alpha * 0.75);
    }
}

function drawFlowingDanceRibbon(startX, startY, dir, progress, lineWidth, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();

    for (let i = 0; i <= 1.001; i += 0.075) {
        const wave = Math.sin((i + progress) * Math.PI * 3.6);
        const curl = Math.sin((i + progress) * Math.PI * 1.8);

        const x = startX + dir * (i * 380 - 100);
        const y = startY + wave * 58 + curl * 22;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
}

function drawM1Trail(t, centerHandX, centerHandY) {
    ctx.shadowColor = "#ffffff";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 12;

    const sx = centerHandX - cameraX;
    const dir = t.facing === "right" ? 1 : -1;

    ctx.beginPath();

    if (t.m1Step === 1) {
        ctx.moveTo(sx, centerHandY - 10);
        ctx.lineTo(sx + 80 * dir, centerHandY + 10);
    } else if (t.m1Step === 2) {
        ctx.moveTo(sx, centerHandY - 40);
        ctx.lineTo(sx + 80 * dir, centerHandY + 40);
    } else if (t.m1Step === 3) {
        ctx.moveTo(sx + 30 * dir, centerHandY - 50);
        ctx.lineTo(sx + 30 * dir, centerHandY + 50);
    } else if (t.m1Step === 4) {
        ctx.moveTo(sx, centerHandY + 40);
        ctx.lineTo(sx + 80 * dir, centerHandY - 40);
    } else {
        ctx.moveTo(sx, centerHandY - 10);
        ctx.lineTo(sx + 80 * dir, centerHandY + 10);
    }

    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawPlayer() {
    if (player.isDashing) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(player.x - cameraX - 22, player.y + 8, player.width + 44, player.height - 12);
        ctx.restore();
    }

    if ((keys.G || player.totalConcentrationActive) && player.isGrounded && !player.isAttacking && !player.isGuarding) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#38bdf8";
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 + Math.sin(Date.now() / 40) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2 - cameraX, player.y + player.height / 2, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x + player.width / 2 - cameraX, player.y + player.height / 2);

    let displayRot = player.bodyRotation;

    if (player.isGuarding) {
        displayRot = player.facing === "right" ? -0.08 : 0.08;
    }

    ctx.rotate(displayRot);

    let scaleX = 1;
    let scaleY = 1;

    if (player.jumpSquash > 0) {
        const t = player.jumpSquash / 10;
        scaleX = 1.12 - t * 0.05;
        scaleY = 0.88 + t * 0.12;
    }

    if (player.landingSquash > 0) {
        const t = player.landingSquash / 9;
        scaleX = 1.15;
        scaleY = 0.85 + (1 - t) * 0.15;
    }

    ctx.scale(scaleX, scaleY);

    if (player.isStunned && Math.floor(player.stunTimer) % 8 < 4) {
        ctx.globalAlpha = 0.3;
    }

    drawPlayerBody();
    drawSword();

    ctx.restore();
}

function drawPlayerBody() {
    ctx.fillStyle = "#2d1a1a";
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    const hW = player.width + 4;
    const hH = player.height - 22;
    const hX = -player.width / 2 - 2;
    const hY = -player.height / 2 + 12;

    ctx.save();
    ctx.beginPath();
    ctx.rect(hX, hY, hW, hH);
    ctx.clip();

    const rows = 6;
    const cols = 4;
    const boxW = hW / cols;
    const boxH = hH / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? "#047857" : "#0f172a";
            ctx.fillRect(hX + c * boxW, hY + r * boxH, boxW, boxH);
        }
    }

    ctx.restore();

    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hX, hY, hW, hH);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(-player.width / 2 + 2, player.height / 2 - 14, player.width - 4, 10);
}

function drawSword() {
    let handX = player.facing === "right" ? player.width / 2 : -player.width / 2;
    let handY = 5;
    let swordAngle = player.facing === "right" ? 0.6 : Math.PI - 0.6;
    const swordLength = 54;

    if (player.isGuarding) {
        swordAngle = -Math.PI / 2;
        handY = -2;
        handX = player.facing === "right" ? 14 : -14;
    } else if (player.isAttacking) {
        const progress = player.attackFrame / player.maxAttackFrames;

        if (player.currentForm === 0) {
            const p = progress * Math.PI;

            if (player.m1Step === 1) {
                swordAngle = player.facing === "right" ? -Math.PI / 3 + p : Math.PI + Math.PI / 3 - p;
            } else if (player.m1Step === 2) {
                swordAngle = player.facing === "right" ? -Math.PI / 2 + p * 1.2 : Math.PI + Math.PI / 2 - p * 1.2;
            } else if (player.m1Step === 3) {
                swordAngle = player.facing === "right" ? -Math.PI / 1.5 + p : Math.PI + Math.PI / 1.5 - p;
            } else if (player.m1Step === 4) {
                swordAngle = player.facing === "right" ? Math.PI / 4 - p : Math.PI - Math.PI / 4 + p;
            }
        } else if (player.currentForm === 1) {
            swordAngle = player.facing === "right" ? 0 : Math.PI;
        } else if (player.currentForm === 2) {
            swordAngle = player.facing === "right" ? progress * Math.PI * 2 : -progress * Math.PI * 2;
        } else if (player.currentForm === 3) {
            swordAngle = player.facing === "right" ? progress * Math.PI * 8 : -progress * Math.PI * 8;
        } else if (player.currentForm === 4) {
            swordAngle = (player.facing === "right" ? 0 : Math.PI) + Math.sin(player.attackFrame * 0.15) * 1.2;
        }
    } else if (keys.G) {
        swordAngle = -Math.PI / 2;
    }

    const tipX = handX + Math.cos(swordAngle) * swordLength;
    const tipY = handY + Math.sin(swordAngle) * swordLength;

    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(handX, handY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#09090b";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(handX + Math.cos(swordAngle) * 4, handY + Math.sin(swordAngle) * 4);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
}

function drawProjectiles() {
    projectiles.forEach((pr) => {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = pr.color;

        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x - cameraX, pr.y, pr.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(pr.x - cameraX, pr.y, pr.coreRadius || 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function drawEnemies() {
    demons.forEach((d) => {
        if (d.attackFlash > 0) {
            const attackBox = getDemonAttackBox(d);

            ctx.save();
            ctx.globalAlpha = 0.25 + Math.sin(d.attackFlash * 0.35) * 0.15;
            ctx.fillStyle = d.type === "brute" ? "#fb923c" : "#ef4444";
            ctx.fillRect(
                attackBox.x - cameraX,
                attackBox.y,
                attackBox.width,
                attackBox.height
            );
            ctx.restore();
        }

        if (d.slamWindup > 0) {
            ctx.save();
            ctx.globalAlpha = 0.35 + Math.sin(d.slamWindup * 0.35) * 0.2;
            ctx.strokeStyle = "#fb923c";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(d.x + d.width / 2 - cameraX, d.y + d.height, 95, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (d.dashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.32;
            ctx.fillStyle = "#fca5a5";
            ctx.fillRect(d.x - cameraX - 25, d.y + 6, d.width + 50, d.height - 10);
            ctx.restore();
        }

        const lean = d.attackWindup > 0 ? Math.sin(d.attackWindup * 0.25) * 0.12 : 0;

        ctx.save();
        ctx.translate(d.x + d.width / 2 - cameraX, d.y + d.height / 2);
        ctx.rotate(lean);

        ctx.fillStyle = d.attackWindup > 0 || d.slamWindup > 0 ? "#dc2626" : d.color;
        ctx.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);

        if (d.type === "swift") {
            ctx.fillStyle = "#fecaca";
            ctx.fillRect(-d.width / 2 - 6, -d.height / 2 + 10, 6, 22);
            ctx.fillRect(d.width / 2, -d.height / 2 + 10, 6, 22);
        }

        if (d.type === "brute") {
            ctx.fillStyle = "#fb923c";
            ctx.fillRect(-d.width / 2 + 5, -d.height / 2 + 8, d.width - 10, 8);
        }

        ctx.restore();

        drawEnemyHealthBar(d);

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#f43f5e";
        ctx.fillStyle = d.stunnedTimer > 0 ? "#e2e8f0" : "#ef4444";

        let eyeX = d.x - cameraX + 20;

        if (d.type === "swift") eyeX = d.x - cameraX + 8;
        if (d.type === "brute") eyeX = d.x - cameraX + 24;
        if (d.type === "sniper") eyeX = d.x - cameraX + 17;

        ctx.fillRect(eyeX, d.y + 12, 6, 6);
        ctx.restore();
    });
}

function drawEnemyHealthBar(d) {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(d.x - cameraX, d.y - 16, d.width, 8);

    const pct = clamp(d.health / d.maxHealth, 0, 1);

    if (d.type === "brute") {
        ctx.fillStyle = "#fb923c";
    } else if (d.type === "swift") {
        ctx.fillStyle = "#f43f5e";
    } else if (d.type === "sniper") {
        ctx.fillStyle = "#c084fc";
    } else {
        ctx.fillStyle = "#ef4444";
    }

    ctx.fillRect(d.x - cameraX, d.y - 16, pct * d.width, 8);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x - cameraX, d.y - 16, d.width, 8);
}

function drawHealTexts() {
    healTexts.forEach((h) => {
        ctx.save();
        ctx.globalAlpha = h.alpha;
        ctx.fillStyle = "#22c55e";
        ctx.font = `bold 22px ${PIXEL_FONT}`;
        const text = typeof h.amount === "number" ? `+${h.amount} HP` : `${h.amount}`;
        ctx.fillText(text, h.x - cameraX - 30, h.y);
        ctx.restore();
    });
}

// =====================================================
// CLEAN HUD
// =====================================================
function drawHUD() {
    drawScoreText();
    drawTopBars();
    drawFormsMinimal();
}

function drawScoreText() {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.font = `bold 28px ${PIXEL_FONT}`;
    ctx.strokeText(`SCORE: ${score}`, 24, 42);
    ctx.fillText(`SCORE: ${score}`, 24, 42);
    ctx.restore();
}

function drawTopBars() {
    const barW = 520;
    const barH = 24;
    const x = canvas.width / 2 - barW / 2;
    const hpY = 54;
    const breathY = 90;

    ctx.save();

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.font = `bold 20px ${PIXEL_FONT}`;
    ctx.strokeText("HP", x, hpY - 8);
    ctx.fillText("HP", x, hpY - 8);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, hpY, barW, barH);

    const hpPct = clamp(health / 100, 0, 1);
    ctx.fillStyle = health > 50 ? "#22c55e" : health > 25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(x, hpY, barW * hpPct, barH);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, hpY, barW, barH);

    ctx.font = `bold 18px ${PIXEL_FONT}`;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeText(`${Math.ceil(health)} / 100`, x + barW / 2 - 55, hpY + 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.ceil(health)} / 100`, x + barW / 2 - 55, hpY + 18);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.font = `bold 20px ${PIXEL_FONT}`;
    ctx.strokeText("BREATH", x, breathY - 8);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("BREATH", x, breathY - 8);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, breathY, barW, barH);

    const breathPct = clamp(player.breathing / player.maxBreathing, 0, 1);
    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(x, breathY, barW * breathPct, barH);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, breathY, barW, barH);

    ctx.font = `bold 18px ${PIXEL_FONT}`;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeText(`${Math.floor(player.breathing)} / ${player.maxBreathing}`, x + barW / 2 - 70, breathY + 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.floor(player.breathing)} / ${player.maxBreathing}`, x + barW / 2 - 70, breathY + 18);

    ctx.restore();
}

function drawFormsMinimal() {
    const x = canvas.width - 500;
    const y = 145;

    const formsInfo = [
        { id: 1, key: "1", name: "1ST FORM: WATER SLASH", req: 40 },
        { id: 2, key: "2", name: "2ND FORM: WATER WHEEL", req: 80 },
        { id: 3, key: "3", name: "3RD FORM: WHIRLPOOL", req: 100 },
        { id: 4, key: "4", name: "4TH FORM: FLOW DANCE", req: 140 },
        { id: 5, key: "5", name: "5TH ABILITY: TOTAL CONCENTRATION", req: 0 }
    ];

    ctx.save();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.font = `bold 20px ${PIXEL_FONT}`;
    ctx.strokeText("ABILITIES", x, y - 28);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("ABILITIES", x, y - 28);

    ctx.font = `bold 16px ${PIXEL_FONT}`;

    for (let i = 0; i < formsInfo.length; i++) {
        const f = formsInfo[i];
        const rowY = y + i * 24;

        let color = "#ffffff";
        let rightText = "READY";

        if (f.id === 5) {
            if (player.totalConcentrationActive) {
                color = "#38bdf8";
                rightText = `${Math.ceil(player.totalConcentrationTimer / 60)}s`;
            } else if (player.totalConcentrationCooldown > 0) {
                color = "#f87171";
                rightText = `${Math.ceil(player.totalConcentrationCooldown / 60)}s`;
            } else {
                color = "#22c55e";
                rightText = "READY";
            }
        } else {
            const isLocked = player.breathing < f.req;
            const isSelected = player.selectedForm === f.id;
            const cd = formCooldowns[f.id];

            if (isSelected) color = "#fbbf24";

            if (isLocked) {
                color = "#64748b";
                rightText = `REQ ${f.req}`;
            } else if (cd > 0) {
                color = "#f87171";
                rightText = `${Math.ceil(cd / 60)}s`;
            } else {
                rightText = "READY";
            }
        }

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.strokeText(`${f.key}. ${f.name}`, x, rowY);
        ctx.fillStyle = color;
        ctx.fillText(`${f.key}. ${f.name}`, x, rowY);

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.strokeText(rightText, x + 430, rowY);
        ctx.fillStyle = rightText === "READY" ? "#22c55e" : color;
        ctx.fillText(rightText, x + 430, rowY);
    }

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.font = `bold 18px ${PIXEL_FONT}`;
    ctx.strokeText(`DASHES: ${player.dashCharges}/${player.maxDashCharges}`, x, y + 118);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`DASHES: ${player.dashCharges}/${player.maxDashCharges}`, x, y + 118);

    if (player.dashCharges < player.maxDashCharges) {
        ctx.strokeText(`RECHARGE: ${(player.dashRechargeTimer / 60).toFixed(1)}s`, x, y + 142);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`RECHARGE: ${(player.dashRechargeTimer / 60).toFixed(1)}s`, x, y + 142);
    }

    if (player.totalConcentrationActive) {
        ctx.strokeText("TOTAL CONCENTRATION ACTIVE", x, y + 190);
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("TOTAL CONCENTRATION ACTIVE", x, y + 190);
    }

    if (player.isGuarding) {
        ctx.strokeText("GUARDING", x, y + 214);
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("GUARDING", x, y + 214);
    }

    ctx.restore();
}

function drawEnemyProgressBar() {
    const barW = 700;
    const barH = 14;
    const x = canvas.width / 2 - barW / 2;
    const y = 14;

    const pct = clamp(score / MAX_PROGRESS_SCORE, 0, 1);

    ctx.save();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.font = `bold 18px ${PIXEL_FONT}`;
    ctx.strokeText("DEMON THREAT PATH", x + 200, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DEMON THREAT PATH", x + 200, y);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, y + 13, barW, barH);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x, y + 13, barW * pct, barH);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 13, barW, barH);

    enemyMilestones.forEach((m) => {
        const mx = x + (m.score / MAX_PROGRESS_SCORE) * barW;
        const unlocked = score >= m.score;

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.font = `bold 20px ${PIXEL_FONT}`;
        ctx.strokeText("☠", mx - 10, y + 9);
        ctx.fillStyle = unlocked ? "#fbbf24" : "#cbd5e1";
        ctx.fillText("☠", mx - 10, y + 9);

        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.font = `bold 14px ${PIXEL_FONT}`;

        const label = m.score >= 1000 ? `${m.score / 1000}K` : `${m.score}`;
        ctx.strokeText(label, mx - 15, y + 47);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, mx - 15, y + 47);
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

    const boxW = Math.min(900, canvas.width - 80);
    const boxH = 380;
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

    ctx.fillStyle = "#ef4444";
    ctx.font = `bold 30px ${PIXEL_FONT}`;
    ctx.fillText("NEW THREAT REVEALED", x + 42, y + 64);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 42px ${PIXEL_FONT}`;
    ctx.fillText(enemyRevealPopup.title, x + 42, y + 130);

    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold 28px ${PIXEL_FONT}`;
    ctx.fillText(`HP: ${enemyRevealPopup.hp}`, x + 42, y + 180);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold 23px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.description, x + 42, y + 225, boxW - 84, 32);

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold 23px ${PIXEL_FONT}`;
    wrapPixelText(enemyRevealPopup.tip, x + 42, y + 300, boxW - 84, 32);

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
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + " ";
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }

    ctx.fillText(line, x, currentY);
}

// =====================================================
// MAIN LOOP
// =====================================================
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
