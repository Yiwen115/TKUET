// DOM 元素
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('hand-canvas');
const canvasCtx = canvasElement.getContext('2d');
const handStatus = document.getElementById('hand-status');
const scoreElement = document.getElementById('score');
const loadingMessage = document.getElementById('loading-message');
const switchCameraButton = document.getElementById('switch-camera');
const toggleDebugButton = document.getElementById('toggle-debug');

// 遊戲狀態
let score = 0;
let isDebugMode = false;
let currentStream = null;
let cameras = [];
let currentCameraIndex = 0;

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

// 處理手部檢測結果
hands.onResults(onResults);

// 初始化相機
async function initializeCamera() {
    try {
        // 獲取所有可用的相機
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');

        // 設置相機
        await setupCamera();
        loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('Error initializing camera:', error);
        loadingMessage.textContent = '無法訪問相機，請確保已授予權限';
    }
}

// 設置相機
async function setupCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            width: 1280,
            height: 720,
            deviceId: cameras[currentCameraIndex]?.deviceId
        }
    };

    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = currentStream;
        await videoElement.play();

        // 設置 canvas 尺寸
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // 初始化相機處理
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 1280,
            height: 720
        });
        camera.start();
    } catch (error) {
        console.error('Error accessing camera:', error);
        loadingMessage.textContent = '無法訪問相機';
    }
}

// 切換相機
switchCameraButton.onclick = () => {
    if (cameras.length > 1) {
        currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
        setupCamera();
    }
};

// 切換除錯模式
toggleDebugButton.onclick = () => {
    isDebugMode = !isDebugMode;
};

// 處理手部檢測結果
function onResults(results) {
    // 清除 canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 如果在除錯模式下，繪製相機畫面
    if (isDebugMode) {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }

    // 更新手部狀態
    if (results.multiHandLandmarks) {
        handStatus.textContent = `偵測到 ${results.multiHandLandmarks.length} 隻手`;

        // 為每隻手繪製輪廓
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const handedness = results.multiHandedness[index].label;
            
            // 繪製手部輪廓
            drawHandOutline(canvasCtx, landmarks, handedness);
            
            // 在除錯模式下顯示更多細節
            if (isDebugMode) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                    color: handedness === 'Left' ? '#00FF00' : '#FF0000',
                    lineWidth: 2
                });
                drawLandmarks(canvasCtx, landmarks, {
                    color: handedness === 'Left' ? '#00FF00' : '#FF0000',
                    lineWidth: 1
                });
            }
        });
    } else {
        handStatus.textContent = '未偵測到手部';
    }

    canvasCtx.restore();
}

// 繪製手部輪廓
function drawHandOutline(ctx, landmarks, handedness) {
    const points = landmarks.map(landmark => ({
        x: landmark.x * canvasElement.width,
        y: landmark.y * canvasElement.height
    }));

    // 設置樣式
    ctx.strokeStyle = handedness === 'Left' ? '#00FF00' : '#FF0000';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 開始繪製路徑
    ctx.beginPath();

    // 繪製拇指輪廓
    drawFingerOutline(ctx, [points[0], points[1], points[2], points[3], points[4]]);

    // 繪製食指輪廓
    drawFingerOutline(ctx, [points[0], points[5], points[6], points[7], points[8]]);

    // 繪製中指輪廓
    drawFingerOutline(ctx, [points[0], points[9], points[10], points[11], points[12]]);

    // 繪製無名指輪廓
    drawFingerOutline(ctx, [points[0], points[13], points[14], points[15], points[16]]);

    // 繪製小指輪廓
    drawFingerOutline(ctx, [points[0], points[17], points[18], points[19], points[20]]);

    // 繪製手掌輪廓
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[5].x, points[5].y);
    ctx.lineTo(points[9].x, points[9].y);
    ctx.lineTo(points[13].x, points[13].y);
    ctx.lineTo(points[17].x, points[17].y);
    ctx.closePath();

    // 完成繪製
    ctx.stroke();
}

// 繪製手指輪廓
function drawFingerOutline(ctx, points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
}

// 初始化應用
initializeCamera(); 
