// 初始化 MediaPipe Hands
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const gameCanvas = document.getElementById('game-canvas');
const gameCtx = gameCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

// 設置遊戲畫布尺寸
gameCanvas.width = gameCanvas.offsetWidth;
gameCanvas.height = gameCanvas.offsetHeight;
canvasElement.width = 400;
canvasElement.height = 300;

// 遊戲狀態
let score = 0;
let currentQuestion = null;
let selectedOption = -1;
let lastGestureTime = 0;
const gestureDelay = 1000; // 手勢確認延遲（毫秒）

// 問題庫
const questions = [
    {
        question: "什麼是教育科技?",
        options: [
            "運用科技改善教學效果",
            "只是使用電腦上課",
            "玩遊戲學習",
            "線上考試系統"
        ],
        correct: 0,
        explanation: "教育科技是為了提升教學效果而運用各種科技工具和方法。"
    },
    {
        question: "下列哪個不是教育科技應用?",
        options: [
            "虛擬實境教學",
            "互動式白板",
            "純粹紙本講義",
            "線上學習平台"
        ],
        correct: 2,
        explanation: "純粹使用紙本講義，沒有結合任何科技輔助，不屬於教育科技應用。"
    },
    {
        question: "教育科技的目的是?",
        options: [
            "取代教師",
            "提升學習效果",
            "減少教學時間",
            "省錢"
        ],
        correct: 1,
        explanation: "教育科技的主要目的是提升學習效果，而不是取代教師或單純節省成本。"
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
    minDetectionConfidence: 0.7, // 提高檢測信心度
    minTrackingConfidence: 0.7  // 提高追踪信心度
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
                {color: '#00FF00', lineWidth: 3});
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
    width: 400,
    height: 300
});
camera.start();

// 遊戲邏輯處理
function handleGameLogic(results) {
    if (!currentQuestion) {
        currentQuestion = getRandomQuestion();
        drawQuestion();
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length >= 1) {
        // 檢測左手位置（如果有）
        const leftHandIndex = results.multiHandedness.findIndex(hand => hand.label === 'Left');
        if (leftHandIndex !== -1) {
            const leftHand = results.multiHandLandmarks[leftHandIndex];
            const leftHandY = leftHand[9].y * gameCanvas.height;
            const newSelectedOption = Math.floor((leftHandY - 150) / 100);
            
            if (newSelectedOption >= 0 && newSelectedOption < 4 && newSelectedOption !== selectedOption) {
                selectedOption = newSelectedOption;
            }
        }

        // 檢測右手手勢（如果有）
        const rightHandIndex = results.multiHandedness.findIndex(hand => hand.label === 'Right');
        if (rightHandIndex !== -1) {
            const rightHand = results.multiHandLandmarks[rightHandIndex];
            const rightHandGesture = detectGesture(rightHand);
            const currentTime = Date.now();
            
            if (rightHandGesture === 'pointing' && currentTime - lastGestureTime > gestureDelay) {
                lastGestureTime = currentTime;
                if (selectedOption >= 0 && selectedOption < 4) {
                    checkAnswer(selectedOption);
                }
            }
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
    gameCtx.font = 'bold 24px "Noto Sans TC"';
    gameCtx.textAlign = 'center';
    gameCtx.fillText(currentQuestion.question, gameCanvas.width/2, 80);

    // 繪製選項
    currentQuestion.options.forEach((option, index) => {
        const y = 150 + index * 100;
        const isSelected = selectedOption === index;
        
        // 選項背景
        gameCtx.fillStyle = isSelected ? '#3498db' : '#34495e';
        gameCtx.beginPath();
        gameCtx.roundRect(100, y - 30, gameCanvas.width - 200, 60, 10);
        gameCtx.fill();

        // 選項文字
        gameCtx.fillStyle = 'white';
        gameCtx.font = isSelected ? 'bold 20px "Noto Sans TC"' : '20px "Noto Sans TC"';
        gameCtx.fillText(option, gameCanvas.width/2, y + 10);
    });
}

// 檢查答案
function checkAnswer(selectedOption) {
    if (selectedOption === currentQuestion.correct) {
        score += 10;
        scoreElement.textContent = score;
        showFeedback(true);
    } else {
        showFeedback(false);
    }
    
    // 延遲後換下一題
    setTimeout(() => {
        currentQuestion = getRandomQuestion();
        drawQuestion();
    }, 2000);
}

// 顯示答題反饋
function showFeedback(isCorrect) {
    gameCtx.fillStyle = isCorrect ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    gameCtx.fillStyle = 'white';
    gameCtx.font = 'bold 32px "Noto Sans TC"';
    gameCtx.fillText(isCorrect ? '答對了！' : '答錯了！', gameCanvas.width/2, gameCanvas.height/2 - 40);
    
    gameCtx.font = '20px "Noto Sans TC"';
    const explanation = currentQuestion.explanation;
    const words = explanation.split('');
    let line = '';
    let y = gameCanvas.height/2 + 20;
    
    words.forEach(word => {
        const testLine = line + word;
        const metrics = gameCtx.measureText(testLine);
        if (metrics.width > gameCanvas.width - 100) {
            gameCtx.fillText(line, gameCanvas.width/2, y);
            line = word;
            y += 30;
        } else {
            line = testLine;
        }
    });
    gameCtx.fillText(line, gameCanvas.width/2, y);
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
    const middleTip = landmarks[12];
    
    // 確保食指是伸直的，且其他手指是彎曲的
    if (indexTip.y < indexDip.y && 
        indexDip.y < indexPip.y && 
        indexTip.y < middleTip.y) {
        return 'pointing';
    }
    return 'none';
} 
