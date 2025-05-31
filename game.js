// 初始化 MediaPipe Hands
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const gameCanvas = document.getElementById('game-canvas');
const gameCtx = gameCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

// 設置遊戲畫布尺寸
gameCanvas.width = 800;
gameCanvas.height = 600;
canvasElement.width = 320;
canvasElement.height = 240;

// 遊戲狀態
let score = 0;
let currentQuestion = null;
let questions = [
    {
        question: "什麼是教育科技?",
        options: [
            "運用科技改善教學效果",
            "只是使用電腦上課",
            "玩遊戲學習",
            "線上考試系統"
        ],
        correct: 0
    },
    {
        question: "下列哪個不是教育科技應用?",
        options: [
            "虛擬實境教學",
            "互動式白板",
            "純粹紙本講義",
            "線上學習平台"
        ],
        correct: 2
    },
    {
        question: "教育科技的目的是?",
        options: [
            "取代教師",
            "提升學習效果",
            "減少教學時間",
            "省錢"
        ],
        correct: 1
    }
];

// 初始化手勢識別
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

// 處理手勢識別結果
hands.onResults(results => {
    // 繪製攝影機畫面
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // 繪製手部標記
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                {color: '#00FF00', lineWidth: 5});
            drawLandmarks(canvasCtx, landmarks, 
                {color: '#FF0000', lineWidth: 2});
        }
    }
    canvasCtx.restore();

    // 處理遊戲邏輯
    handleGameLogic(results);
});

// 設置攝影機
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 320,
    height: 240
});
camera.start();

// 遊戲邏輯處理
function handleGameLogic(results) {
    if (!currentQuestion) {
        currentQuestion = getRandomQuestion();
        drawQuestion();
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
        const leftHand = results.multiHandLandmarks[0];
        const rightHand = results.multiHandLandmarks[1];

        // 檢測左手位置來選擇選項
        const leftHandY = leftHand[9].y * gameCanvas.height;
        const selectedOption = Math.floor(leftHandY / (gameCanvas.height / 4));

        // 檢測右手手勢來確認選擇
        const rightHandGesture = detectGesture(rightHand);
        
        if (rightHandGesture === 'pointing') {
            checkAnswer(selectedOption);
        }

        // 更新畫面
        drawQuestion(selectedOption);
    }
}

// 繪製問題和選項
function drawQuestion(selectedOption = -1) {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // 繪製問題
    gameCtx.fillStyle = '#2c3e50';
    gameCtx.font = '24px Arial';
    gameCtx.textAlign = 'center';
    gameCtx.fillText(currentQuestion.question, gameCanvas.width/2, 100);

    // 繪製選項
    currentQuestion.options.forEach((option, index) => {
        const y = 200 + index * 100;
        gameCtx.fillStyle = selectedOption === index ? '#3498db' : '#34495e';
        gameCtx.fillRect(200, y - 30, gameCanvas.width - 400, 60);
        gameCtx.fillStyle = 'white';
        gameCtx.fillText(option, gameCanvas.width/2, y);
    });
}

// 檢查答案
function checkAnswer(selectedOption) {
    if (selectedOption === currentQuestion.correct) {
        score += 10;
        scoreElement.textContent = score;
        // 顯示正確提示
        showFeedback(true);
    } else {
        showFeedback(false);
    }
    
    // 延遲後換下一題
    setTimeout(() => {
        currentQuestion = getRandomQuestion();
        drawQuestion();
    }, 1500);
}

// 顯示答題反饋
function showFeedback(isCorrect) {
    gameCtx.fillStyle = isCorrect ? 'rgba(46, 204, 113, 0.8)' : 'rgba(231, 76, 60, 0.8)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = 'white';
    gameCtx.font = '48px Arial';
    gameCtx.fillText(isCorrect ? '答對了！' : '答錯了！', gameCanvas.width/2, gameCanvas.height/2);
}

// 取得隨機問題
function getRandomQuestion() {
    return questions[Math.floor(Math.random() * questions.length)];
}

// 檢測手勢
function detectGesture(landmarks) {
    // 檢測食指指向手勢
    const indexTip = landmarks[8];
    const indexDip = landmarks[7];
    const indexPip = landmarks[6];
    
    if (indexTip.y < indexDip.y && indexDip.y < indexPip.y) {
        return 'pointing';
    }
    return 'none';
} 