// DOM 元素
const videoElement = document.getElementById('input-video');
const handCanvas = document.getElementById('hand-canvas');
const gameCanvas = document.getElementById('game-canvas');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreDisplay = document.getElementById('score');
const healthDisplay = document.getElementById('health');
const loadingMessage = document.getElementById('loading-message');
const switchCameraButton = document.getElementById('switch-camera');
const toggleDebugButton = document.getElementById('toggle-debug');

// Canvas contexts
const handCtx = handCanvas.getContext('2d');
const gameCtx = gameCanvas.getContext('2d');

// 遊戲狀態
let gameState = {
    isPlaying: false,
    score: 0,
    health: 3,
    playerX: 100,
    playerY: 400,
    playerVelocityY: 0,
    isJumping: false,
    platforms: [],
    enemies: [],
    coins: [],
    gravity: 0.5,
    jumpForce: -12,
    gameSpeed: 3
};

// 遊戲物件尺寸和顏色
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const PLATFORM_HEIGHT = 20;
const COIN_SIZE = 20;
const ENEMY_SIZE = 40;

// 遊戲素材
const sprites = {
    player: {
        color: '#4CAF50',
        outline: '#45a049',
        shadow: 'rgba(76, 175, 80, 0.3)'
    },
    platform: {
        color: '#8B4513',
        outline: '#6B3410',
        pattern: '#9B5523'
    },
    coin: {
        color: '#FFD700',
        outline: '#FFA000',
        glow: 'rgba(255, 215, 0, 0.5)'
    },
    enemy: {
        color: '#FF4444',
        outline: '#CC0000',
        glow: 'rgba(255, 0, 0, 0.3)'
    }
};

// 粒子系統
let particles = [];

class Particle {
    constructor(x, y, color, type = 'normal') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.gravity = 0.1;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.type !== 'floating') {
            this.speedY += this.gravity;
        }
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 初始化手部檢測
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 相機設置
let currentCamera = 'user';
let camera = null;

// 切換相機
switchCameraButton.addEventListener('click', async () => {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    if (camera) {
        camera.stop();
    }
    await initializeCamera();
});

// 初始化相機
async function initializeCamera() {
    try {
        const constraints = {
            video: {
                width: 640,
                height: 480,
                facingMode: currentCamera
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        // 等待視頻元素加載完成
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });

        await videoElement.play();
        
        // 設置 canvas 尺寸
        handCanvas.width = videoElement.videoWidth;
        handCanvas.height = videoElement.videoHeight;
        gameCanvas.width = gameCanvas.offsetWidth;
        gameCanvas.height = gameCanvas.offsetHeight;

        // 初始化相機處理
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        loadingMessage.style.display = 'none';
        startScreen.style.display = 'flex';
    } catch (error) {
        console.error('Error accessing camera:', error);
        loadingMessage.textContent = '無法訪問相機，請確保已授予權限';
    }
}

// 手勢處理
hands.onResults((results) => {
    // 清除畫布
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    // 繪製手部標記
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(handCtx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 2
            });
            drawLandmarks(handCtx, landmarks, {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3
            });
        }
        
        // 處理手勢控制
        if (gameState.isPlaying) {
            handleHandGestures(results.multiHandLandmarks, results.multiHandedness);
        }
    }
});

// 手勢控制邏輯
function handleHandGestures(landmarks, handedness) {
    if (landmarks.length === 0) return;

    landmarks.forEach((hand, index) => {
        const handType = handedness[index].label;
        const palmY = hand[0].y;
        const indexFingerY = hand[8].y;
        
        // 左手控制左移
        if (handType === 'Left' && palmY < 0.7) {
            gameState.playerX -= 5;
        }
        
        // 右手控制右移
        if (handType === 'Right' && palmY < 0.7) {
            gameState.playerX += 5;
        }
        
        // 檢測跳躍手勢（雙手舉起）
        if (landmarks.length === 2 && !gameState.isJumping) {
            const bothHandsUp = landmarks.every(hand => hand[0].y < 0.5);
            if (bothHandsUp) {
                gameState.playerVelocityY = gameState.jumpForce;
                gameState.isJumping = true;
                // 添加跳躍特效
                addParticles(gameState.playerX + PLAYER_WIDTH/2, gameState.playerY + PLAYER_HEIGHT, '#ffffff', 10);
            }
        }
    });

    // 確保玩家不會超出畫面
    gameState.playerX = Math.max(0, Math.min(gameState.playerX, gameCanvas.width - PLAYER_WIDTH));
}

// 遊戲更新邏輯
function updateGame() {
    if (!gameState.isPlaying) return;

    // 更新玩家位置
    gameState.playerVelocityY += gameState.gravity;
    gameState.playerY += gameState.playerVelocityY;

    // 地面碰撞檢測
    if (gameState.playerY > gameCanvas.height - PLAYER_HEIGHT) {
        gameState.playerY = gameCanvas.height - PLAYER_HEIGHT;
        gameState.playerVelocityY = 0;
        gameState.isJumping = false;
    }

    // 更新平台
    updatePlatforms();
    
    // 更新敵人
    updateEnemies();
    
    // 更新金幣
    updateCoins();

    // 檢查遊戲結束條件
    if (gameState.health <= 0) {
        endGame();
    }
}

// 更新平台
function updatePlatforms() {
    // 移動現有平台
    gameState.platforms.forEach(platform => {
        platform.x -= gameState.gameSpeed;
    });

    // 移除超出畫面的平台
    gameState.platforms = gameState.platforms.filter(platform => platform.x + platform.width > 0);

    // 添加新平台
    if (gameState.platforms.length < 5) {
        const lastPlatform = gameState.platforms[gameState.platforms.length - 1];
        const x = lastPlatform ? lastPlatform.x + Math.random() * 300 + 100 : gameCanvas.width;
        const y = Math.random() * (gameCanvas.height - 200) + 100;
        
        gameState.platforms.push({
            x: x,
            y: y,
            width: Math.random() * 100 + 50,
            height: PLATFORM_HEIGHT
        });
    }

    // 平台碰撞檢測
    gameState.platforms.forEach(platform => {
        if (gameState.playerY + PLAYER_HEIGHT >= platform.y &&
            gameState.playerY + PLAYER_HEIGHT <= platform.y + platform.height &&
            gameState.playerX + PLAYER_WIDTH > platform.x &&
            gameState.playerX < platform.x + platform.width) {
            gameState.playerY = platform.y - PLAYER_HEIGHT;
            gameState.playerVelocityY = 0;
            gameState.isJumping = false;
        }
    });
}

// 更新敵人
function updateEnemies() {
    // 移動現有敵人
    gameState.enemies.forEach(enemy => {
        enemy.x -= gameState.gameSpeed + enemy.speed;
    });

    // 移除超出畫面的敵人
    gameState.enemies = gameState.enemies.filter(enemy => enemy.x + ENEMY_SIZE > 0);

    // 添加新敵人
    if (gameState.enemies.length < 3 && Math.random() < 0.02) {
        gameState.enemies.push({
            x: gameCanvas.width,
            y: Math.random() * (gameCanvas.height - ENEMY_SIZE),
            speed: Math.random() * 2 + 1
        });
    }

    // 敵人碰撞檢測
    gameState.enemies.forEach(enemy => {
        if (checkCollision(
            gameState.playerX, gameState.playerY, PLAYER_WIDTH, PLAYER_HEIGHT,
            enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE
        )) {
            gameState.health--;
            healthDisplay.textContent = gameState.health;
            // 添加受傷特效
            addParticles(gameState.playerX + PLAYER_WIDTH/2, gameState.playerY + PLAYER_HEIGHT/2, sprites.enemy.color, 20);
            enemy.x = -ENEMY_SIZE;
        }
    });
}

// 更新金幣
function updateCoins() {
    // 移動現有金幣
    gameState.coins.forEach(coin => {
        coin.x -= gameState.gameSpeed;
    });

    // 移除超出畫面的金幣
    gameState.coins = gameState.coins.filter(coin => coin.x + COIN_SIZE > 0);

    // 添加新金幣
    if (gameState.coins.length < 5 && Math.random() < 0.05) {
        gameState.coins.push({
            x: gameCanvas.width,
            y: Math.random() * (gameCanvas.height - COIN_SIZE)
        });
    }

    // 金幣碰撞檢測
    gameState.coins.forEach(coin => {
        if (checkCollision(
            gameState.playerX, gameState.playerY, PLAYER_WIDTH, PLAYER_HEIGHT,
            coin.x, coin.y, COIN_SIZE, COIN_SIZE
        )) {
            gameState.score += 10;
            scoreDisplay.textContent = gameState.score;
            // 添加金幣收集特效
            addParticles(coin.x + COIN_SIZE/2, coin.y + COIN_SIZE/2, sprites.coin.color, 15);
            coin.x = -COIN_SIZE;
        }
    });
}

// 碰撞檢測
function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
           x1 + w1 > x2 &&
           y1 < y2 + h2 &&
           y1 + h1 > y2;
}

// 繪製遊戲
function drawGame() {
    // 清除畫布
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 繪製背景
    const gradient = gameCtx.createLinearGradient(0, 0, 0, gameCanvas.height);
    gradient.addColorStop(0, '#1a2a6c');
    gradient.addColorStop(0.5, '#b21f1f');
    gradient.addColorStop(1, '#fdbb2d');
    gameCtx.fillStyle = gradient;
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 繪製平台
    gameState.platforms.forEach(platform => {
        // 平台主體
        gameCtx.fillStyle = sprites.platform.color;
        gameCtx.strokeStyle = sprites.platform.outline;
        gameCtx.lineWidth = 2;
        
        gameCtx.beginPath();
        gameCtx.roundRect(platform.x, platform.y, platform.width, platform.height, 5);
        gameCtx.fill();
        gameCtx.stroke();

        // 平台花紋
        for (let i = 0; i < platform.width; i += 20) {
            gameCtx.fillStyle = sprites.platform.pattern;
            gameCtx.fillRect(platform.x + i, platform.y + 2, 10, 2);
        }
    });

    // 繪製玩家
    gameCtx.save();
    // 玩家陰影
    gameCtx.shadowColor = sprites.player.shadow;
    gameCtx.shadowBlur = 20;
    gameCtx.fillStyle = sprites.player.color;
    gameCtx.strokeStyle = sprites.player.outline;
    gameCtx.lineWidth = 2;
    
    gameCtx.beginPath();
    gameCtx.roundRect(gameState.playerX, gameState.playerY, PLAYER_WIDTH, PLAYER_HEIGHT, 10);
    gameCtx.fill();
    gameCtx.stroke();
    gameCtx.restore();

    // 繪製敵人
    gameState.enemies.forEach(enemy => {
        gameCtx.save();
        gameCtx.shadowColor = sprites.enemy.glow;
        gameCtx.shadowBlur = 15;
        gameCtx.fillStyle = sprites.enemy.color;
        gameCtx.strokeStyle = sprites.enemy.outline;
        gameCtx.lineWidth = 2;

        gameCtx.beginPath();
        gameCtx.roundRect(enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE, 8);
        gameCtx.fill();
        gameCtx.stroke();
        gameCtx.restore();
    });

    // 繪製金幣
    gameState.coins.forEach(coin => {
        gameCtx.save();
        gameCtx.shadowColor = sprites.coin.glow;
        gameCtx.shadowBlur = 15;
        gameCtx.fillStyle = sprites.coin.color;
        gameCtx.strokeStyle = sprites.coin.outline;
        gameCtx.lineWidth = 2;

        gameCtx.beginPath();
        gameCtx.arc(coin.x + COIN_SIZE/2, coin.y + COIN_SIZE/2, COIN_SIZE/2, 0, Math.PI * 2);
        gameCtx.fill();
        gameCtx.stroke();

        // 金幣閃光效果
        gameCtx.beginPath();
        gameCtx.arc(coin.x + COIN_SIZE/2, coin.y + COIN_SIZE/2, COIN_SIZE/4, 0, Math.PI * 2);
        gameCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        gameCtx.fill();
        gameCtx.restore();
    });

    // 更新和繪製粒子
    particles = particles.filter(particle => particle.life > 0);
    particles.forEach(particle => {
        particle.update();
        particle.draw(gameCtx);
    });
}

// 遊戲循環
function gameLoop() {
    if (gameState.isPlaying) {
        updateGame();
        drawGame();
    }
    requestAnimationFrame(gameLoop);
}

// 開始遊戲
function startGame() {
    gameState = {
        isPlaying: true,
        score: 0,
        health: 3,
        playerX: 100,
        playerY: 400,
        playerVelocityY: 0,
        isJumping: false,
        platforms: [{
            x: 0,
            y: gameCanvas.height - 50,
            width: gameCanvas.width,
            height: PLATFORM_HEIGHT
        }],
        enemies: [],
        coins: [],
        gravity: 0.5,
        jumpForce: -12,
        gameSpeed: 3
    };

    scoreDisplay.textContent = '0';
    healthDisplay.textContent = '3';
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameLoop();
}

// 結束遊戲
function endGame() {
    gameState.isPlaying = false;
    gameOverScreen.style.display = 'flex';
    gameOverScreen.querySelector('#final-score span').textContent = gameState.score;
}

// 事件監聽器
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

// 初始化遊戲
initializeCamera();

// 添加特效函數
function addParticles(x, y, color, count, type = 'normal') {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, type));
    }
} 
