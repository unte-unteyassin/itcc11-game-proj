// =====================================================
// SLAYER'S PATH - CLEAN OPTIMIZED VERSION
// Keeps cool attack/form visuals.
// Removes unnecessary boss/intros/Firebase/star/image systems.
// Fixes Flowing Dance lag.
// =====================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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

const sfxGuardPull = new Audio("audio/guard_pull.mp3");
const sfxParryClang = new Audio("audio/parry_clang.mp3");
const sfxHurt = new Audio("audio/player_hurt.mp3");
const sfxHit = new Audio("audio/demon_hit.mp3");

function playSound(audioFile) {
    if (!audioFile) return;
    audioFile.cloneNode().play().catch(() => {});
}

// =====================================================
// WORLD / CANVAS
// =====================================================
const MAP_WIDTH = 3000;
let GROUND_Y = 520;
let cameraX = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    GROUND_Y = Math.max(430, canvas.height - 85);

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

const demons = [];
const projectiles = [];
const waterTrails = [];
const foamParticles = [];

const MAX_DEMONS = 16;
const MAX_PROJECTILES = 45;
const MAX_WATER_TRAILS = 70;
const MAX_FOAM = 110;

// =====================================================
// PLAYER
// =====================================================
const keys = {
    Left: false,
    Right: false,
    G: false,
    W: false
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
    facing: "right",
    bodyRotation: 0,

    breathing: 60,
    maxBreathing: 150,

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

    isParrying: false,
    parryFrame: 0,
    maxParryFrames: 14,
    parryCooldown: 0,

    isStunned: false,
    stunTimer: 0,
    invincibleTimer: 0,

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

resizeCanvas();

// =====================================================
// INPUT
// =====================================================
window.addEventListener("keydown", (e) => {
    if (gameState !== "playing") return;
    if (gameOver || player.isStunned) return;

    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.Left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.Right = true;
    if (e.code === "KeyG") keys.G = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.W = true;

    if (
        e.code === "Space" &&
        player.parryCooldown <= 0 &&
        !player.isParrying &&
        !player.isAttacking
    ) {
        player.isParrying = true;
        player.parryFrame = 0;
        playSound(sfxGuardPull);
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
});

window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.Left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.Right = false;
    if (e.code === "KeyG") keys.G = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") keys.W = false;
});

window.addEventListener("mousedown", (e) => {
    if (gameState !== "playing") return;
    if (gameOver || player.isStunned || player.isParrying) return;
    if (e.button !== 0) return;
    if (player.isAttacking) return;
    if (keys.G) return;

    player.isAttacking = true;
    player.attackFrame = 0;
    player.currentForm = player.selectedForm;

    if (player.currentForm === 0) {
        player.m1Step = player.m1Step ? (player.m1Step % 4) + 1 : 1;
        player.maxAttackFrames = 12;
    } else {
        player.m1Step = 0;
    }

    if (player.currentForm === 1) {
        player.maxAttackFrames = 69;
        player.breathing -= 40;
    } else if (player.currentForm === 2) {
        player.maxAttackFrames = 77;
        player.breathing -= 80;
    } else if (player.currentForm === 3) {
        player.maxAttackFrames = 122;
        player.breathing -= 100;
    } else if (player.currentForm === 4) {
        player.maxAttackFrames = 145;
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

function saveHighScore(name, finalScore) {
    alert(`${name.toUpperCase()} SCORE: ${finalScore}`);
    location.reload();
}

function handlePlayerDamage(amount) {
    if (player.invincibleTimer > 0) return;

    health -= amount;
    combo = 0;
    comboTimer = 0;
    player.invincibleTimer = 40;

    playSound(sfxHurt);

    if (health <= 0) {
        health = 0;
        gameOver = true;

        setTimeout(() => {
            const tag = prompt(`DIED IN BATTLE! Final Score: ${score}\nEnter your Name Tag:`) || "SLAYER";
            saveHighScore(tag, score);
        }, 50);
    }
}

function processParryInteractions(targetObject) {
    if (!player.isParrying) return false;

    player.isParrying = false;
    player.parryFrame = 0;
    player.parryCooldown = 0;
    player.invincibleTimer = 35;

    combo += 5;
    comboTimer = 240;
    score += 1000;

    player.breathing = Math.min(player.maxBreathing, player.breathing + 50);

    targetObject.stunnedTimer = 120;

    addFoamBurst(player.x + player.width / 2, player.y + player.height / 2, 25);
    playSound(sfxParryClang);

    return true;
}

// =====================================================
// DEMON SPAWNING
// =====================================================
function spawnDemonPool() {
    if (demons.length >= MAX_DEMONS) return;

    const seed = Math.random();

    let type = "standard";
    let speed = 1.5 + Math.random() * 1.5;
    let hp = 1;
    let color = "#7f1d1d";
    let width = 42;
    let height = 55;

    if (score >= 60000 && seed < 0.25) {
        type = "brute";
        hp = 4;
        speed = 1;
        color = "#4c0519";
        width = 55;
        height = 75;
    } else if (score >= 30000 && seed > 0.25 && seed < 0.55) {
        type = "swift";
        hp = 1;
        speed = 4.5;
        color = "#991b1b";
        width = 36;
        height = 50;
    } else if (score >= 15000 && seed >= 0.55 && seed < 0.75) {
        type = "sniper";
        hp = 2;
        speed = 1.8;
        color = "#311042";
        width = 40;
        height = 58;
    }

    const spawnLeft = Math.random() < 0.5;

    const x = spawnLeft
        ? Math.max(0, player.x - 700)
        : Math.min(MAP_WIDTH - width, player.x + 700);

    demons.push({
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
        stunnedTimer: 0
    });
}

// =====================================================
// UPDATE
// =====================================================
function update() {
    if (gameState !== "playing") return;
    if (gameOver) return;

    let dt = 1;

    if (keys.G && player.isGrounded && !player.isAttacking && !player.isParrying && !player.isStunned) {
        dt = 0.2;
    } else if (player.isParrying) {
        dt = 0.25;
    }

    updateTimers();
    updatePlayerMovement();
    updatePlayerAttack();
    updateParticlesAndTrails(dt);
    updateProjectiles(dt);
    updateDemons(dt);
    updateCamera();
}

function updateTimers() {
    if (player.invincibleTimer > 0) player.invincibleTimer--;
    if (player.parryCooldown > 0) player.parryCooldown--;

    if (comboTimer > 0) {
        comboTimer--;

        if (comboTimer <= 0) {
            combo = 0;
        }
    }

    for (const key in formCooldowns) {
        if (formCooldowns[key] > 0) {
            formCooldowns[key]--;
        }
    }

    if (player.isStunned) {
        player.stunTimer--;

        if (player.stunTimer <= 0) {
            player.isStunned = false;
        }
    }

    if (player.isParrying) {
        player.parryFrame++;

        if (player.parryFrame > player.maxParryFrames) {
            player.isParrying = false;
            player.parryFrame = 0;
            player.parryCooldown = 180;
        }
    }
}

function updatePlayerMovement() {
    if (keys.G && player.isGrounded && !player.isAttacking && !player.isParrying && !player.isStunned) {
        player.breathing = Math.min(player.maxBreathing, player.breathing + 1.2);
        player.bodyRotation = Math.sin(Date.now() / 40) * 0.05;
    }

    if (!player.isStunned && !keys.G) {
        if (keys.W && player.isGrounded && !player.isAttacking && !player.isParrying) {
            player.vy = -12.5;
            player.isGrounded = false;
        }

        if (keys.Left && !player.isAttacking && !player.isParrying) {
            player.x -= player.speed;
            player.facing = "left";
            player.bodyRotation = player.isGrounded ? -0.08 : -0.15;
        } else if (keys.Right && !player.isAttacking && !player.isParrying) {
            player.x += player.speed;
            player.facing = "right";
            player.bodyRotation = player.isGrounded ? 0.08 : 0.15;
        } else if (!player.isAttacking && !player.isParrying) {
            player.bodyRotation = 0;
        }
    }

    if (!player.isGrounded) {
        player.vy += 0.55;
        player.y += player.vy;

        if (player.y >= player.baseY) {
            player.y = player.baseY;
            player.isGrounded = true;
            player.vy = 0;
        }
    }

    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);
}

function updateCamera() {
    const targetCamX = player.x - canvas.width / 2;
    cameraX += (targetCamX - cameraX) * 0.1;
    cameraX = clamp(cameraX, 0, MAP_WIDTH - canvas.width);
}

function updatePlayerAttack() {
    if (!player.isAttacking) return;

    player.attackFrame++;

    const f = player.attackFrame;
    const totalF = player.maxAttackFrames;
    const pct = f / totalF;
    const direction = player.facing === "right" ? 1 : -1;

    if (player.currentForm === 1) {
        player.x += direction * 3;

        player.attackBox.width = 220;
        player.attackBox.height = 50;
        player.attackBox.y = player.y + 10;
    } else if (player.currentForm === 2) {
        const arcH = Math.sin(pct * Math.PI) * 170;

        player.y = player.baseY - arcH;
        player.x += direction * 3.5;
        player.bodyRotation = pct * Math.PI * 2 * direction;

        player.attackBox.width = 170;
        player.attackBox.height = 170;
        player.attackBox.y = player.y - 45;
    } else if (player.currentForm === 3) {
        player.attackBox.width = 280;
        player.attackBox.height = 280;
        player.attackBox.y = player.y + player.height / 2 - 140;
    } else if (player.currentForm === 4) {
        updateFlowingDance(f, totalF, pct, direction);
    } else {
        player.attackBox.width = 100;
        player.attackBox.height = 60;
        player.attackBox.y = player.y + 10;
    }

    if (player.currentForm === 3) {
        player.attackBox.x = player.x + player.width / 2 - player.attackBox.width / 2;
    } else {
        player.attackBox.x = player.facing === "right"
            ? player.x + player.width
            : player.x - player.attackBox.width;
    }

    player.x = clamp(player.x, 0, MAP_WIDTH - player.width);

    // Normal trail spawn. For Form 4, skip this because it has its own optimized ribbon spawn.
    if (player.currentForm !== 4 && f > 1 && f % 3 === 0) {
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

function updateFlowingDance(frame, totalFrames, progress, direction) {
    const forward = Math.sin(progress * Math.PI) * 5.5;
    const waveX = Math.sin(progress * Math.PI * 2.2) * 5;
    const waveY = Math.sin(progress * Math.PI * 4) * 24;

    player.x += direction * forward + waveX;
    player.y = player.baseY + waveY;
    player.bodyRotation = Math.sin(progress * Math.PI * 4) * 0.38;

    player.attackBox.width = 330;
    player.attackBox.height = 165;
    player.attackBox.y = player.y - 48;

    // Main lag fix:
    // old version spawned Form 4 trail every 2 frames + normal trail every 3 frames.
    // this only spawns every 7 frames.
    if (frame % 7 === 0) {
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

    if (frame % 16 === 0) {
        addFoamBurst(
            player.x + player.width / 2,
            player.y + player.height / 2,
            3
        );
    }
}

function endAttack() {
    if (player.currentForm > 0) {
        formCooldowns[player.currentForm] = maxCooldowns[player.currentForm];
    }

    player.isAttacking = false;
    player.attackFrame = 0;
    player.y = player.isGrounded ? player.baseY : player.y;
    player.bodyRotation = 0;
    player.currentForm = 0;
    player.selectedForm = 0;
}

function updateParticlesAndTrails(dt) {
    for (let i = waterTrails.length - 1; i >= 0; i--) {
        waterTrails[i].alpha -= waterTrails[i].form === 4 ? 0.032 : 0.04;

        if (waterTrails[i].alpha <= 0) {
            waterTrails.splice(i, 1);
        }
    }

    for (let i = foamParticles.length - 1; i >= 0; i--) {
        const p = foamParticles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
            foamParticles.splice(i, 1);
        }
    }
}

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
                    playSound(sfxHit);

                    if (d.health <= 0) {
                        killDemon(j, d);
                    }

                    break;
                }
            }
        } else {
            const hitPlayer =
                pr.x > player.x &&
                pr.x < player.x + player.width &&
                pr.y > player.y &&
                pr.y < player.y + player.height;

            const hitAttack =
                player.isAttacking &&
                player.currentForm > 0 &&
                player.attackFrame > 1 &&
                pr.x > player.attackBox.x &&
                pr.x < player.attackBox.x + player.attackBox.width &&
                pr.y > player.attackBox.y &&
                pr.y < player.attackBox.y + player.attackBox.height;

            if (hitPlayer || hitAttack) {
                if (player.isParrying || hitAttack) {
                    pr.vx = -pr.vx * 1.5;
                    pr.vy = (Math.random() - 0.5) * 3;
                    pr.color = "#38bdf8";
                    pr.deflected = true;

                    addFoamBurst(pr.x, pr.y, 10);
                    playSound(sfxParryClang);

                    score += 150;
                    player.breathing = Math.min(player.maxBreathing, player.breathing + 10);
                } else {
                    handlePlayerDamage(pr.damage);
                    projectiles.splice(i, 1);
                }
            }
        }
    }
}

function updateDemons(dt) {
    spawnTimer += dt;

    if (spawnTimer >= 45) {
        spawnTimer = 0;
        spawnDemonPool();
    }

    for (let i = demons.length - 1; i >= 0; i--) {
        const d = demons[i];

        if (d.stunnedTimer > 0) {
            d.stunnedTimer -= dt;
            continue;
        }

        moveDemon(d, dt);
        handleDemonAttackCollision(i, d);
        handleDemonPlayerCollision(d);
    }
}

function moveDemon(d, dt) {
    if (d.type === "standard" || d.type === "brute") {
        d.x += d.x < player.x ? d.speed * dt : -d.speed * dt;
    } else if (d.type === "swift") {
        d.x += d.x < player.x ? d.speed * dt : -d.speed * dt;

        d.jumpTimer += dt;

        if (d.jumpTimer >= 70 && Math.abs(player.x - d.x) < 250) {
            d.jumpTimer = 0;
            d.x += d.x < player.x ? 90 : -90;
            addFoamBurst(d.x, d.y, 4);
        }
    } else if (d.type === "sniper") {
        const dist = Math.abs(player.x - d.x);

        if (dist > 400) {
            d.x += d.x < player.x ? d.speed * dt : -d.speed * dt;
        } else if (dist < 250) {
            d.x += d.x < player.x ? -d.speed * dt : d.speed * dt;
        }

        d.shootTimer += dt;

        if (d.shootTimer >= 110) {
            d.shootTimer = 0;

            pushProjectile({
                x: d.x + d.width / 2,
                y: d.y + 15,
                vx: d.x < player.x ? 6.5 : -6.5,
                vy: 0,
                radius: 5,
                color: "#c084fc",
                damage: 12,
                deflected: false
            });
        }
    }
}

function handleDemonAttackCollision(index, d) {
    if (!player.isAttacking || player.attackFrame <= 1) return;

    const hitDemon =
        player.attackBox.x < d.x + d.width &&
        player.attackBox.x + player.attackBox.width > d.x &&
        player.attackBox.y < d.y + d.height &&
        player.attackBox.y + player.attackBox.height > d.y;

    if (!hitDemon) return;

    if (d.type === "brute" && player.currentForm === 0) {
        player.isAttacking = false;
        player.isStunned = true;
        player.stunTimer = 40;
        playSound(sfxParryClang);
        return;
    }

    const damageValue = player.currentForm > 0 ? 2 : 1;
    d.health -= damageValue;

    playSound(sfxHit);

    if (d.health <= 0) {
        killDemon(index, d);
    }
}

function handleDemonPlayerCollision(d) {
    const touchingPlayer =
        player.x < d.x + d.width &&
        player.x + player.width > d.x &&
        player.y < d.y + d.height &&
        player.y + player.height > d.y;

    if (!touchingPlayer) return;

    if (!processParryInteractions(d)) {
        handlePlayerDamage(d.type === "brute" ? 1 : 0.5);
    }
}

function killDemon(index, d) {
    addFoamBurst(d.x + d.width / 2, d.y + d.height / 2, 12);

    demons.splice(index, 1);

    combo++;
    comboTimer = 240;

    score += d.type === "brute" ? 500 : 200;
}

// =====================================================
// DRAWING
// =====================================================
function draw() {
    if (gameState !== "playing") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawParticles();
    drawWaterTrails();
    drawPlayer();
    drawProjectiles();
    drawEnemies();
    drawHUD();
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

    // No Math.random here. Random inside draw causes visual jitter and FPS drops.
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

    // Deterministic foam dots. No random inside draw.
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

    // Fewer points than before. Still smooth, way less lag.
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
    if (player.isParrying) {
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#e2e8f0";
        ctx.strokeStyle = "rgba(226, 232, 240, 0.85)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2 - cameraX, player.y + player.height / 2, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    if (keys.G && player.isGrounded && !player.isAttacking && !player.isParrying) {
        ctx.save();
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#38bdf8";
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 + Math.sin(Date.now() / 40) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2 - cameraX, player.y + player.height / 2, 55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.translate(player.x + player.width / 2 - cameraX, player.y + player.height / 2);

    let displayRot = player.bodyRotation;

    if (player.isParrying) {
        displayRot = player.facing === "right" ? -0.15 : 0.15;
    }

    ctx.rotate(displayRot);

    if (player.isStunned && player.stunTimer % 8 < 4) {
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

    if (player.isParrying) {
        swordAngle = player.facing === "right" ? -Math.PI / 1.3 : Math.PI + Math.PI / 1.3;
        handY = -15;
        handX = player.facing === "right" ? -5 : 5;
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = pr.color;
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x - cameraX, pr.y, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawEnemies() {
    demons.forEach((d) => {
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x - cameraX, d.y, d.width, d.height);

        if (d.maxHealth > 1) {
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(d.x - cameraX, d.y - 10, d.width, 5);

            ctx.fillStyle = "#ef4444";
            ctx.fillRect(d.x - cameraX, d.y - 10, (d.health / d.maxHealth) * d.width, 5);
        }

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#f43f5e";
        ctx.fillStyle = d.stunnedTimer > 0 ? "#e2e8f0" : "#ef4444";
        ctx.fillRect(d.x - cameraX + (d.speed > 2 ? 8 : 22), d.y + 12, 6, 6);
        ctx.restore();
    });
}

function drawHUD() {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px 'Courier New'";
    ctx.fillText(`SCORE: ${score}`, 25, 35);

    const formLabels = [
        "Basic M1 Strike Active",
        "Staged: 1st Form (Water Surface Slash)",
        "Staged: 2nd Form (Water Wheel)",
        "Staged: 3rd Form (Whirlpool)",
        "Staged: 4th Form (Flowing Dance)"
    ];

    ctx.fillStyle = player.selectedForm > 0 ? "#f59e0b" : "#38bdf8";
    ctx.fillText(`STANCE: ${formLabels[player.selectedForm]}`, 25, 60);

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(25, 80, 200, 14);

    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(25, 80, (player.breathing / player.maxBreathing) * 200, 14);

    ctx.strokeStyle = "#334155";
    ctx.strokeRect(25, 80, 200, 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "9px sans-serif";
    ctx.fillText(`BREATH METRIC: ${Math.floor(player.breathing)} / ${player.maxBreathing}`, 30, 91);

    if (combo > 0) {
        ctx.fillStyle = combo >= 50 ? "#22d3ee" : "#f59e0b";
        ctx.font = "italic bold 22px Arial";
        ctx.fillText(`${combo}x COMBO`, 25, 145);

        ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
        ctx.fillRect(25, 155, 120, 4);

        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(25, 155, (comboTimer / 240) * 120, 4);
    }

    if (player.isStunned) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(`GUARD BROKEN STUN: ${Math.ceil(player.stunTimer / 60)}s`, 25, 120);
    }

    if (player.parryCooldown > 0) {
        ctx.fillStyle = "#f43f5e";
        ctx.font = "bold 14px 'Courier New'";
        ctx.fillText(`PARRY COOLDOWN: ${(player.parryCooldown / 60).toFixed(1)}s`, 25, player.isStunned ? 138 : 120);
    }

    drawFormCooldowns();
    drawHealthBar();
}

function drawFormCooldowns() {
    ctx.font = "bold 11px 'Courier New'";

    const formsInfo = [
        { id: 1, name: "1st Form CD:", req: 40 },
        { id: 2, name: "2nd Form CD:", req: 80 },
        { id: 3, name: "3rd Form CD:", req: 100 },
        { id: 4, name: "4th Form CD:", req: 140 }
    ];

    formsInfo.forEach((info, index) => {
        const barY = 180 + index * 22;
        const isLocked = player.breathing < info.req;

        if (isLocked) {
            ctx.fillStyle = "#4b5563";
            ctx.fillText(`${info.name} LOCKED (Req: ${info.req})`, 25, barY + 10);
        } else {
            ctx.fillStyle = formCooldowns[info.id] > 0 ? "#f43f5e" : "#10b981";
            ctx.fillText(info.name, 25, barY + 10);

            ctx.fillStyle = "#1e293b";
            ctx.fillRect(145, barY, 95, 12);

            if (formCooldowns[info.id] > 0) {
                const cdPct = formCooldowns[info.id] / maxCooldowns[info.id];

                ctx.fillStyle = "#f43f5e";
                ctx.fillRect(145, barY, cdPct * 95, 12);
            } else {
                ctx.fillStyle = "#10b981";
                ctx.fillRect(145, barY, 95, 12);
            }

            ctx.strokeStyle = "#334155";
            ctx.strokeRect(145, barY, 95, 12);
        }
    });
}

function drawHealthBar() {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(canvas.width - 235, 20, 200, 16);

    ctx.fillStyle = health > 35 ? "#10b981" : "#f43f5e";
    ctx.fillRect(canvas.width - 235, 20, health * 2, 16);

    ctx.strokeStyle = "#334155";
    ctx.strokeRect(canvas.width - 235, 20, 200, 16);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("VITALITY RESILIENCE", canvas.width - 225, 32);
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