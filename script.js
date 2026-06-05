const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const offCanvas = document.createElement('canvas');
offCanvas.width = 600;
offCanvas.height = 600;
const offCtx = offCanvas.getContext('2d');

const CANVAS_SIZE = 600;
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

const fwCanvas = document.getElementById('fireworksCanvas');
const fwCtx = fwCanvas.getContext('2d');
if (fwCanvas) {
    fwCanvas.width = CANVAS_SIZE;
    fwCanvas.height = CANVAS_SIZE;
}

// UI Elements
const uiLevel = document.getElementById('level-display');
const uiTargetCount = document.getElementById('target-display');
const uiTime = document.getElementById('time-display');
const uiSteps = document.getElementById('steps-display');
const clearTimeDisplay = document.getElementById('clear-time-display');
const btnNewMap = document.getElementById('btn-new-map');
const btnRestart = document.getElementById('btn-restart');
const btnStartOver = document.getElementById('btn-start-over');
const btnPause = document.getElementById('btn-pause');
const btnHint = document.getElementById('btn-hint');
const btnChangeColor = document.getElementById('btn-change-color');
const clearOverlay = document.getElementById('clear-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const clearStepsDisplay = document.getElementById('clear-steps-display');

const PAGE_LOAD_TIME = Date.now();

// Game State
let level = 1;
// Difficulty is now steps-based
let cols = 15;
let rows = 15;
let grid = [];
let player = { x: 0, y: 0 };
let endPos = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };
let cellSize = CANVAS_SIZE / cols;
let pathHistory = []; // Tracks player exact path for continuous drawing
let lastWallBumpDir = '';
let wallBumpCount = 0;

// Timer State
let startTime = 0;
let elapsedTime = 0; // ms accumulated when paused
let timerInterval = null;
let isPaused = false;
let isCleared = false;
let hasStartedMoving = false;

// Trail State
let trailAnimInterval = null;
let trailStartTime = 0;
let lastMoveDir = {dx: 0, dy: 0};

// Hint State
let hintUsed = false;
let hintActive = false;
let hintPath = null;
let hintEndTime = 0;

// Audio System
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playCoinSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square';
    // B5 to E6 shift
    osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); 
    osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
}

function playYoshiMountSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

let starmanInterval = null;
let starmanNoteStep = 0;

let tickingInterval = null;

function startTickingSound() {
    initAudio();
    if (tickingInterval) return;
    


    let tickCount = 0;
    tickingInterval = setInterval(() => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        
        // 滴答音效：交替高低音
        osc.type = 'sine';
        osc.frequency.value = (tickCount % 2 === 0) ? 800 : 600;
        tickCount++;
        
        // 音量比 BGM (0.3) 大 1.5 倍 = 0.45
        gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }, 500); // 每 0.5 秒滴答一次
}

function stopTickingSound() {
    if (tickingInterval) {
        clearInterval(tickingInterval);
        tickingInterval = null;
    }

}

// Removed stopStarmanMusic correctly handled by stopTickingSound rename

let victoryGain = null;
function playVictorySound() {
    initAudio();
    stopTickingSound(); // Ensure no overlap
    
    // SMW Course Clear melody approx
    const fanfareNotes = [
        {f: 587.33, d: 0.15}, // D5
        {f: 493.88, d: 0.15}, // B4
        {f: 392.00, d: 0.15}, // G4
        {f: 493.88, d: 0.15}, // B4
        {f: 659.25, d: 0.15}, // E5
        {f: 523.25, d: 0.15}, // C5
        {f: 392.00, d: 0.15}, // G4
        {f: 523.25, d: 0.15}, // C5
        {f: 783.99, d: 0.40}, // G5
        {f: 523.25, d: 0.15}, // C5
        {f: 783.99, d: 0.80}, // G5
    ];
    let time = audioCtx.currentTime;
    
    victoryGain = audioCtx.createGain();
    victoryGain.gain.value = 0.2;
    victoryGain.connect(audioCtx.destination);
    
    fanfareNotes.forEach(note => {
        let osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = note.f;
        
        let nodeGain = audioCtx.createGain();
        nodeGain.gain.setValueAtTime(0, time);
        nodeGain.gain.linearRampToValueAtTime(1, time + 0.02);
        nodeGain.gain.setValueAtTime(1, time + note.d - 0.05);
        nodeGain.gain.linearRampToValueAtTime(0, time + note.d);
        
        osc.connect(nodeGain);
        nodeGain.connect(victoryGain);
        
        osc.start(time);
        osc.stop(time + note.d);
        
        time += note.d + 0.02; 
    });
}

function stopVictorySound() {
    if (victoryGain && audioCtx) {
        victoryGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        setTimeout(() => {
            if(victoryGain) {
                victoryGain.disconnect();
                victoryGain = null;
            }
        }, 150);
    }
}

// Colors
let COLOR_WALL = 'rgba(88, 166, 255, 0.8)';
let COLOR_START = 'rgba(76, 175, 80, 0.4)';
let COLOR_END = '#ffeb3b';
let COLOR_PATH_NEW = '#009688';     // Used solid colors to hide overlap dot
let COLOR_PATH_REPEAT = '#E91E63';  // Used solid colors to hide overlap dot
let COLOR_PLAYER = '#4caf50'; // Green filled

const palettes = [
    { // Default Dark
        wall: 'rgba(88, 166, 255, 0.8)',
        pathNew: '#009688',
        pathRepeat: '#E91E63',
        player: '#4caf50',
        bg1: '#151e2e', bg2: '#0d1117',
        canvasBg: '#090a0f',
        textPrimary: '#f0f6fc',
        panelBg: 'rgba(22, 27, 34, 0.7)',
        panelBorder: 'rgba(255, 255, 255, 0.1)'
    },
    { // Joyful Pink/Purple
        wall: '#ff69b4', 
        pathNew: '#9370db', 
        pathRepeat: '#ffa500', 
        player: '#ffeb3b',
        bg1: '#ffe4e1', bg2: '#ffb6c1', 
        canvasBg: '#fff0f5', 
        textPrimary: '#333333',
        panelBg: 'rgba(255, 255, 255, 0.6)',
        panelBorder: 'rgba(255, 255, 255, 0.9)'
    },
    { // Colorful Spring
        wall: '#3cb371', 
        pathNew: '#ff7f50', 
        pathRepeat: '#1e90ff', 
        player: '#ffd700',
        bg1: '#e0ffff', bg2: '#87cefa', 
        canvasBg: '#f0ffff',
        textPrimary: '#333333',
        panelBg: 'rgba(255, 255, 255, 0.6)',
        panelBorder: 'rgba(255, 255, 255, 0.9)'
    },
    { // Sunny Morning
        wall: '#ff8c00', 
        pathNew: '#32cd32', 
        pathRepeat: '#8a2be2', 
        player: '#1e90ff',
        bg1: '#ffffe0', bg2: '#ffdab9', 
        canvasBg: '#fffacd',
        textPrimary: '#333333',
        panelBg: 'rgba(255, 255, 255, 0.6)',
        panelBorder: 'rgba(255, 255, 255, 0.9)'
    },
    { // Neon Party
        wall: '#00ffff', 
        pathNew: '#ff1493', 
        pathRepeat: '#adff2f', 
        player: '#ff4500',
        bg1: '#2b00ff', bg2: '#000000', 
        canvasBg: '#111111', 
        textPrimary: '#f0f6fc',
        panelBg: 'rgba(22, 27, 34, 0.7)',
        panelBorder: 'rgba(255, 255, 255, 0.3)'
    }
];
let currentPaletteIdx = 0;

function initList() {
    btnNewMap.addEventListener('click', () => loadLevel(level, true));
    btnRestart.addEventListener('click', () => restartMap());
    btnStartOver.addEventListener('click', () => {
        // Show dropdown and hide static display when starting over
        const levelSelect = document.getElementById('level-select');
        const levelDisplay = document.getElementById('level-display');
        if (levelSelect) levelSelect.style.display = 'inline-block';
        if (levelDisplay) levelDisplay.style.display = 'none';
        
        loadLevel(1, true);
    });
    btnPause.addEventListener('click', togglePause);
    btnHint.addEventListener('click', activateHint);
    btnChangeColor.addEventListener('click', changeColorPalette);
    clearOverlay.addEventListener('click', nextLevel);
    window.addEventListener('keydown', handleKeyDown);
    


    // Level selection dropdown
    const levelSelect = document.getElementById('level-select');
    if (levelSelect) {
        levelSelect.addEventListener('change', (e) => {
            const selectedLevel = parseInt(e.target.value);
            if (!isNaN(selectedLevel)) {
                loadLevel(selectedLevel, true);
                
                // Automatically hide dropdown and show static text after selection
                const levelDisplay = document.getElementById('level-display');
                if (levelSelect) levelSelect.style.display = 'none';
                if (levelDisplay) levelDisplay.style.display = 'inline-block';
            }
        });
    }
}

function changeColorPalette() {
    let newIdx = currentPaletteIdx;
    while(newIdx === currentPaletteIdx) {
        newIdx = Math.floor(Math.random() * palettes.length);
    }
    currentPaletteIdx = newIdx;
    let p = palettes[currentPaletteIdx];
    
    COLOR_WALL = p.wall;
    COLOR_PATH_NEW = p.pathNew;
    COLOR_PATH_REPEAT = p.pathRepeat;
    COLOR_PLAYER = p.player;
    
    document.documentElement.style.setProperty('--bg-grad-1', p.bg1);
    document.documentElement.style.setProperty('--bg-grad-2', p.bg2);
    document.documentElement.style.setProperty('--canvas-bg', p.canvasBg);
    document.documentElement.style.setProperty('--text-primary', p.textPrimary);
    document.documentElement.style.setProperty('--panel-bg', p.panelBg);
    document.documentElement.style.setProperty('--panel-border', p.panelBorder);
    
    // Some buttons need to match UI change
    draw();
}

function calcTargetSteps(lvl) {
    let steps = 10;
    for (let i = 1; i < lvl; i++) {
        steps = Math.floor(steps * 1.1);
    }
    return steps;
}

function cloneMaze() {
    let cloned = new Array(cols).fill(0).map((_, x) => new Array(rows).fill(0).map((_, y) => new Cell(x, y)));
    for(let c=0; c<cols; c++) {
        for(let r=0; r<rows; r++) {
            cloned[c][r].walls = { ...grid[c][r].walls };
            cloned[c][r].genVisited = grid[c][r].genVisited;
            cloned[c][r].visitedCount = grid[c][r].visitedCount;
        }
    }
    return cloned;
}

function generateTargetMaze(targetSteps) {
    let bestGrid = null;
    let bestStart = null;
    let bestEnd = null;
    let bestCols = 0;
    let bestRows = 0;
    let bestError = Infinity;
    
    // For level >= 51, aspect ratio is 1.5:1 (Landscape)
    // Area = cols * rows. If rows = cols / 1.5, Area = cols^2 / 1.5
    // Area for targetSteps is approx targetSteps * 1.5 (grid density)
    // cols^2 / 1.5 = targetSteps * 1.5  => cols = 1.5 * sqrt(targetSteps)
    let ratio = (level >= 51) ? (1 / 1.5) : 1.0;
    let currentCols = Math.max(5, Math.floor(Math.sqrt(targetSteps * 1.5 / ratio)));
    if (currentCols > 50) currentCols = 50; // Increased limit for landscape width
    
    for (let attempt = 0; attempt < 100; attempt++) {
        cols = currentCols;
        rows = Math.max(5, Math.floor(currentCols * ratio));
        
        generateMaze(); 
        let path = bfsPath(startPos, endPos);
        let pathLen = Math.max(0, path.length - 1); 
        
        let error = Math.abs(pathLen - targetSteps);
        if (error < bestError) {
            bestError = error;
            bestGrid = cloneMaze();
            bestStart = { ...startPos };
            bestEnd = { ...endPos };
            bestCols = cols;
            bestRows = rows;
            if (error === 0) break;
        }
        
        // Adjust search
        if (pathLen < targetSteps && currentCols < 50) {
            currentCols += Math.random() < 0.6 ? 1 : 0;
        } else if (pathLen > targetSteps && currentCols > 5) {
            currentCols -= Math.random() < 0.6 ? 1 : 0;
        }
    }
    
    grid = bestGrid;
    startPos = bestStart;
    endPos = bestEnd;
    cols = bestCols;
    rows = bestRows;
    
    // Calculate cellSize to fit the canvas dimensions
    cellSize = Math.min(canvas.width / cols, canvas.height / rows);
}

function loadLevel(l, isNewMapButton = false) {
    level = l;
    uiLevel.innerText = level;

    // Adjust canvas dimensions for Level 51+ (1.5:1 Landscape)
    if (level >= 51) {
        canvas.width = 600;
        canvas.height = 400;
    } else {
        canvas.width = 600;
        canvas.height = 600;
    }
    // Sync offscreen and fireworks canvas
    if (offCanvas) { offCanvas.width = canvas.width; offCanvas.height = canvas.height; }
    if (fwCanvas) { fwCanvas.width = canvas.width; fwCanvas.height = canvas.height; }
    
    // Sync level-select dropdown
    const levelSelect = document.getElementById('level-select');
    const levelDisplay = document.getElementById('level-display');
    if (levelSelect) {
        // If level > 1, the dropdown should be hidden
        if (level > 1) {
            levelSelect.style.display = 'none';
            if (levelDisplay) levelDisplay.style.display = 'inline-block';
        }

        // Check if current level is in the list
        const options = Array.from(levelSelect.options).map(o => o.value);
        if (options.includes(level.toString())) {
            levelSelect.value = level;
            document.getElementById('level-current-option').style.display = 'none';
        } else {
            // Show as a temporary option if not in the list
            const currentOpt = document.getElementById('level-current-option');
            currentOpt.value = level;
            currentOpt.innerText = level;
            currentOpt.style.display = 'block';
            levelSelect.value = level;
        }
    }

    let targetSteps = calcTargetSteps(level);
    uiTargetCount.innerText = targetSteps;
    


    generateTargetMaze(targetSteps);
    
    resetPlayer();
    uiTime.innerText = "00-00-000";
    if (uiSteps) uiSteps.innerText = "000";
    draw();
}

function restartMap() {
    resetPlayer();
    
    // clear visited states
    for(let c = 0; c < cols; c++) {
        for(let r = 0; r < rows; r++) {
            grid[c][r].visitedCount = 0;
        }
    }
    
    grid[player.x][player.y].visitedCount = 1;
    uiTime.innerText = "00-00-000";
    if (uiSteps) uiSteps.innerText = "000";
    draw();
}

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.walls = { top: true, right: true, bottom: true, left: true };
        this.genVisited = false;
        this.visitedCount = 0;
    }
}

function generateMaze() {
    grid = new Array(cols).fill(0).map((_, x) => new Array(rows).fill(0).map((_, y) => new Cell(x, y)));
    
    // DFS Maze Gen
    let stack = [];
    let current = grid[0][0];
    current.genVisited = true;
    
    while(true) {
        let next = getUnvisitedNeighbor(current);
        if (next) {
            next.genVisited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }
    
    // Random Start and End
    startPos.x = 0;
    startPos.y = Math.floor(Math.random() * rows);
    
    endPos.x = cols - 1;
    endPos.y = Math.floor(Math.random() * rows);
}

function getUnvisitedNeighbor(cell) {
    let neighbors = [];
    let x = cell.x, y = cell.y;
    
    if (y > 0 && !grid[x][y - 1].genVisited) neighbors.push({cell: grid[x][y - 1], dir: 'top'});
    if (x < cols - 1 && !grid[x + 1][y].genVisited) neighbors.push({cell: grid[x + 1][y], dir: 'right'});
    if (y < rows - 1 && !grid[x][y + 1].genVisited) neighbors.push({cell: grid[x][y + 1], dir: 'bottom'});
    if (x > 0 && !grid[x - 1][y].genVisited) neighbors.push({cell: grid[x - 1][y], dir: 'left'});
    
    if (neighbors.length > 0) {
        let r = Math.floor(Math.random() * neighbors.length);
        return neighbors[r].cell;
    } else {
        return undefined;
    }
}

function removeWalls(a, b) {
    let dx = a.x - b.x;
    if (dx === 1) { a.walls.left = false; b.walls.right = false; }
    else if (dx === -1) { a.walls.right = false; b.walls.left = false; }
    
    let dy = a.y - b.y;
    if (dy === 1) { a.walls.top = false; b.walls.bottom = false; }
    else if (dy === -1) { a.walls.bottom = false; b.walls.top = false; }
}

function resetPlayer() {
    stopTickingSound();
    stopVictorySound();
    stopFireworks();
    player.x = startPos.x;
    player.y = startPos.y;
    lastWallBumpDir = '';
    wallBumpCount = 0;
    grid[player.x][player.y].visitedCount = 1;
    pathHistory = [{x: player.x, y: player.y, isNew: true}];
    isCleared = false;
    isPaused = false;
    hintUsed = false;
    hintActive = false;
    btnHint.classList.add('hidden-ui');
    pauseOverlay.classList.add('hidden');
    clearOverlay.classList.add('hidden');
    btnPause.innerText = "暫停";
    btnHint.innerText = "提示路線";
    btnHint.style.pointerEvents = 'auto';
    
    stopTimer();
    elapsedTime = 0;
    hasStartedMoving = false;
    uiTime.innerText = "00-00-000";
    if (uiSteps) uiSteps.innerText = "000";
    
    if (trailAnimInterval) {
        clearInterval(trailAnimInterval);
        trailAnimInterval = null;
    }
    trailStartTime = 0;
    lastMoveDir = {dx: 0, dy: 0};
}

function startTimer() {
    stopTimer();
    elapsedTime = 0;
    startTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 33);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function togglePause() {
    if (isCleared || !hasStartedMoving) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        // Pause
        stopTimer();
        elapsedTime += (Date.now() - startTime);
        btnPause.innerText = "繼續";
        pauseOverlay.classList.remove('hidden');
    } else {
        // Resume
        startTime = Date.now();
        timerInterval = setInterval(updateTimerDisplay, 33);
        btnPause.innerText = "暫停";
        pauseOverlay.classList.add('hidden');
    }
}

function formatTime(ms) {
    let minutes = Math.floor(ms / 60000);
    let seconds = Math.floor((ms % 60000) / 1000);
    let milliseconds = ms % 1000;
    
    if (minutes > 99) minutes = 99;
    
    return [
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0'),
        milliseconds.toString().padStart(3, '0')
    ].join('-');
}

function updateTimerDisplay() {
    let currentMs = elapsedTime + (isPaused ? 0 : (Date.now() - startTime));
    uiTime.innerText = formatTime(currentMs);
    
    // Check Hint availability
    let currentSec = Math.floor(currentMs / 1000);
    let targetSteps = calcTargetSteps(level);
    if (!hintUsed && !isCleared && (pathHistory.length - 1 >= targetSteps * 1.5 || currentSec >= 30)) {
        btnHint.classList.remove('hidden-ui');
    }
    
}

function handleKeyDown(e) {
    if (isCleared) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // prevent scrolling with Space
            nextLevel();
        }
        return;
    }
    if (isPaused) return;
    
    let direction = '';
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') direction = 'top';
    else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') direction = 'right';
    else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') direction = 'bottom';
    else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') direction = 'left';
    
    if (direction) {
        moveInDirection(direction);
    }
}

function moveInDirection(direction) {
    if (isCleared || isPaused) return;
    
    let moved = false;
    const cell = grid[player.x][player.y];
    
    let dx = 0;
    let dy = 0;
    if (direction === 'top' && !cell.walls.top) { player.y--; dy = -1; moved = true; }
    else if (direction === 'right' && !cell.walls.right) { player.x++; dx = 1; moved = true; }
    else if (direction === 'bottom' && !cell.walls.bottom) { player.y++; dy = 1; moved = true; }
    else if (direction === 'left' && !cell.walls.left) { player.x--; dx = -1; moved = true; }
    
    if (moved) {
        if (!hasStartedMoving) {
            hasStartedMoving = true;
            startTimer();
        }
        
        trailStartTime = Date.now();
        lastMoveDir = { dx: dx, dy: dy };
        
        if (trailAnimInterval) clearInterval(trailAnimInterval);
        trailAnimInterval = setInterval(() => {
            if (Date.now() - trailStartTime >= 250) {
                clearInterval(trailAnimInterval);
                trailAnimInterval = null;
                draw();
            } else {
                draw();
            }
        }, 16);


        
        lastWallBumpDir = '';
        wallBumpCount = 0;
        
        playCoinSound();
        grid[player.x][player.y].visitedCount++;
        let isNew = grid[player.x][player.y].visitedCount === 1;
        pathHistory.push({x: player.x, y: player.y, isNew: isNew});
        if (uiSteps) uiSteps.innerText = Math.min(999, pathHistory.length - 1).toString().padStart(3, '0');
        checkWin();
        draw();
    } else {
        if (direction === lastWallBumpDir) {
            wallBumpCount++;
        } else {
            lastWallBumpDir = direction;
            wallBumpCount = 1;
        }
        
        if (wallBumpCount > 2) {
            playYoshiMountSound();
        }
    }
}

function checkWin() {
    if (player.x === endPos.x && player.y === endPos.y) {
        isCleared = true;
        stopTickingSound(); // In case they win with hint active
        stopTimer();
        elapsedTime += (Date.now() - startTime);
        
        // Hide dropdown and show static display upon clearing level
        const levelSelect = document.getElementById('level-select');
        const levelDisplay = document.getElementById('level-display');
        if (levelSelect) levelSelect.style.display = 'none';
        if (levelDisplay) levelDisplay.style.display = 'inline-block';

        // Show clear overlay
        clearTimeDisplay.innerText = formatTime(elapsedTime);
        if (clearStepsDisplay) {
            clearStepsDisplay.innerText = Math.max(0, pathHistory.length - 1);
        }
        clearOverlay.classList.remove('hidden');
        
        playVictorySound();
        startFireworks();
    }
}

function nextLevel() {
    if (!isCleared) return;
    loadLevel(level + 1);
}

// =======================
// Fireworks Effect
// =======================
let fireworks = [];
let fwAnimationFrame = null;

function startFireworks() {
    fireworks = [];
    if (fwAnimationFrame) cancelAnimationFrame(fwAnimationFrame);
    animateFireworks();
}

function stopFireworks() {
    if (fwAnimationFrame) cancelAnimationFrame(fwAnimationFrame);
    if (fwCtx) fwCtx.clearRect(0,0,fwCanvas.width,fwCanvas.height);
    fireworks = [];
}

function animateFireworks() {
    if (!isCleared || !fwCtx) {
        stopFireworks();
        return;
    }
    
    // Fade out previous frames to create long particle trails on a transparent canvas
    fwCtx.globalCompositeOperation = 'destination-out';
    fwCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    fwCtx.fillRect(0, 0, fwCanvas.width, fwCanvas.height);
    fwCtx.globalCompositeOperation = 'source-over';
    
    if (fireworks.length < 4 && Math.random() < 0.05) {
        let x = Math.random() * fwCanvas.width;
        let y = Math.random() * (fwCanvas.height / 2);
        let particles = [];
        let colors = ['#ff0044', '#00ff44', '#0044ff', '#ff8800', '#ff00ff', '#00ffff', '#ffff00'];
        let c = colors[Math.floor(Math.random() * colors.length)];
        
        let count = 40 + Math.random() * 20;
        for(let i=0; i<count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 4 + 1;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: c
            });
        }
        fireworks.push(particles);
    }
    
    for (let f = fireworks.length - 1; f >= 0; f--) {
        let pArray = fireworks[f];
        let allDead = true;
        
        for (let i = 0; i < pArray.length; i++) {
            let p = pArray[i];
            if (p.life > 0) {
                allDead = false;
                fwCtx.fillStyle = p.color;
                fwCtx.globalAlpha = Math.max(0, p.life);
                fwCtx.beginPath();
                fwCtx.arc(p.x, p.y, 2, 0, Math.PI*2);
                fwCtx.fill();
                
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.08; 
                p.life -= 0.02; 
            }
        }
        
        if (allDead) fireworks.splice(f, 1);
    }
    fwCtx.globalAlpha = 1.0;
    
    fwAnimationFrame = requestAnimationFrame(animateFireworks);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let offsetX = (canvas.width - cols * cellSize) / 2;
    let offsetY = (canvas.height - rows * cellSize) / 2;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    
    // Draw cells
    for(let c = 0; c < cols; c++) {
        for(let r = 0; r < rows; r++) {
            let cx = c * cellSize;
            let cy = r * cellSize;
            
            // Do not draw rect paths here anymore. Replaced by pathHistory lines.
            
            // Draw End (Pulsing Grey Sphere)
            if (c === endPos.x && r === endPos.y) {
                let centerX = cx + cellSize/2;
                let centerY = cy + cellSize/2;
                
                // 動態放大縮小
                let scaleFactor = 0.35 + Math.sin(Date.now() / 300) * 0.08;
                let radius = cellSize * scaleFactor;
                
                let gradient = ctx.createRadialGradient(
                    centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.1, 
                    centerX, centerY, radius
                );
                
                // 灰色球體漸層
                gradient.addColorStop(0, '#eee');
                gradient.addColorStop(0.4, '#bbb');
                gradient.addColorStop(1, '#777');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw Start highlight
            if (c === startPos.x && r === startPos.y) {
                ctx.fillStyle = COLOR_START;
                ctx.fillRect(cx, cy, cellSize, cellSize);
            }
            
            // Draw walls
            ctx.strokeStyle = COLOR_WALL;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            
            if (grid[c][r].walls.top) {
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + cellSize, cy);
            }
            if (grid[c][r].walls.right) {
                ctx.moveTo(cx + cellSize, cy);
                ctx.lineTo(cx + cellSize, cy + cellSize);
            }
            if (grid[c][r].walls.bottom) {
                ctx.moveTo(cx, cy + cellSize);
                ctx.lineTo(cx + cellSize, cy + cellSize);
            }
            if (grid[c][r].walls.left) {
                ctx.moveTo(cx, cy + cellSize);
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }
    }
    
    // Draw Hint Overlay (Moved here to be below player)
    if (hintActive && hintPath && hintPath.length > 1) {
        offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
        offCtx.lineCap = 'round';
        offCtx.lineJoin = 'round';
        offCtx.lineWidth = Math.max(12, cellSize * 0.4);
        
        let pathDist = 0;
        
        for (let i = 1; i < hintPath.length; i++) {
            let p0 = hintPath[i-1];
            let p1 = hintPath[i];
            
            let hcx0 = p0.x * cellSize + cellSize / 2;
            let hcy0 = p0.y * cellSize + cellSize / 2;
            let hcx1 = p1.x * cellSize + cellSize / 2;
            let hcy1 = p1.y * cellSize + cellSize / 2;
            
            let dx = hcx1 - hcx0;
            let dy = hcy1 - hcy0;
            let dist = Math.hypot(dx, dy);
            let steps = Math.ceil(dist / 3); // 3px step for smooth continuous color
            
            for(let step = 0; step < steps; step++) {
                let t0 = step / steps;
                let t1 = (step + 1) / steps;
                
                let cx0 = hcx0 + dx * t0;
                let cy0 = hcy0 + dy * t0;
                let cx1 = hcx0 + dx * t1;
                let cy1 = hcy0 + dy * t1;
                
                let currentDist = pathDist + dist * t0;
                
                // Continuous flowing black-and-white gradient along physical path
                let colorVal = Math.floor(127.5 + 127.5 * Math.cos(currentDist * 0.05 - Date.now() / 200));
                
                offCtx.beginPath();
                offCtx.moveTo(cx0, cy0);
                offCtx.lineTo(cx1, cy1);
                offCtx.strokeStyle = `rgb(${colorVal}, ${colorVal}, ${colorVal})`;
                offCtx.stroke();
            }
            pathDist += dist;
        }
        
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 320);
        ctx.drawImage(offCanvas, 0, 0);
        ctx.restore();
    }
    
    // Draw continuous rounded paths
    if (!hintActive) {
        ctx.globalAlpha = 0.5; // 軌跡透明度 50%
        if (pathHistory.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            let currentTypeIsNew = pathHistory[1].isNew;
            let p0 = pathHistory[0];
            
            ctx.beginPath();
            let cx0 = p0.x * cellSize + cellSize / 2;
            let cy0 = p0.y * cellSize + cellSize / 2;
            ctx.moveTo(cx0, cy0);
            
            // Path width matches 0.65x of original (0.75) width -> ~0.4875
            let pathWidth = cellSize * 0.4875;
            
            for (let i = 1; i < pathHistory.length; i++) {
                let p1 = pathHistory[i];
                let cx1 = p1.x * cellSize + cellSize / 2;
                let cy1 = p1.y * cellSize + cellSize / 2;
                
                if (p1.isNew !== currentTypeIsNew) {
                    ctx.strokeStyle = currentTypeIsNew ? COLOR_PATH_NEW : COLOR_PATH_REPEAT;
                    ctx.lineWidth = pathWidth;
                    ctx.stroke();
                    
                    currentTypeIsNew = p1.isNew;
                    ctx.beginPath();
                    ctx.moveTo(cx0, cy0);
                }
                
                ctx.lineTo(cx1, cy1);
                cx0 = cx1;
                cy0 = cy1;
            }
            
            ctx.strokeStyle = currentTypeIsNew ? COLOR_PATH_NEW : COLOR_PATH_REPEAT;
            ctx.lineWidth = pathWidth;
            ctx.stroke();
        } else if (pathHistory.length === 1) {
            let p0 = pathHistory[0];
            ctx.fillStyle = COLOR_PATH_NEW;
            let r = (cellSize * 0.4875) / 2;
            ctx.beginPath();
            ctx.arc(p0.x * cellSize + cellSize / 2, p0.y * cellSize + cellSize / 2, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0; // 恢復不透明
    }
    
    // Draw Trail
    let px = player.x * cellSize + cellSize / 2;
    let py = player.y * cellSize + cellSize / 2;
    
    let timeSinceLastMove = Date.now() - trailStartTime;
    if (timeSinceLastMove < 250 && (lastMoveDir.dx !== 0 || lastMoveDir.dy !== 0)) {
        let maxDist = (cellSize * 0.8) * (2 / 3);
        let fadeRatio = 1 - (timeSinceLastMove / 250); 
        
        ctx.save();
        ctx.fillStyle = COLOR_PLAYER;
        for (let i = 0; i < 10; i++) {
            let dist = ((i + 1) / 10) * maxDist;
            let ptx = px - lastMoveDir.dx * dist;
            let pty = py - lastMoveDir.dy * dist;
            
            let alpha = (1 - (i / 10)) * fadeRatio * 0.5; // max alpha 0.5
            
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(ptx, pty, cellSize * (0.35 - i * 0.02), 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        }
        ctx.restore();
    }
    
    // Draw Player (Dynamic Monochrome Sphere Effect)
    let radius = cellSize * 0.4;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    
    // 1. 底色 (跟隨配色系統)
    ctx.fillStyle = COLOR_PLAYER;
    ctx.fill();
    
    // 2. 高光與陰影疊層，營造單色球體立體感
    let pGradient = ctx.createRadialGradient(
        px - radius * 0.3, py - radius * 0.3, radius * 0.1, 
        px, py, radius
    );
    pGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)'); // 強反光
    pGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)'); // 表面受光
    pGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)'); // 過渡帶
    pGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)'); // 底部暗部
    
    ctx.fillStyle = pGradient;
    ctx.fill();
    ctx.closePath();
    
    // Removed Hint Overlay from here to move it earlier
    
    ctx.restore(); // Restore global translation
}

function activateHint() {
    initAudio(); // User interaction unlocks audio
    hintUsed = true;
    // 不再直接隱藏按鈕，而是保留顯示倒數
    // btnHint.classList.add('hidden-ui'); 
    btnHint.style.pointerEvents = 'none'; // 倒數期間不可再次點擊
    
    hintPath = bfsPath(startPos, endPos);
    hintActive = true;
    hintEndTime = Date.now() + 10000; // 維持10秒
    
    startTickingSound();
    
    requestAnimationFrame(animateHint);
}

function animateHint() {
    if (!hintActive) return;
    
    let now = Date.now();
    if (now > hintEndTime) {
        hintActive = false;
        stopTickingSound();
        btnHint.classList.add('hidden-ui');
        btnHint.innerText = '提示路線';
        btnHint.style.pointerEvents = 'auto';
        draw();
        return;
    }
    
    // 更新按鈕文字為倒數計時格式 09,999
    let remain = Math.min(9999, hintEndTime - now);
    let ss = Math.floor(remain / 1000).toString().padStart(2, '0');
    let mmm = Math.max(0, Math.floor(remain % 1000)).toString().padStart(3, '0');
    btnHint.innerText = `${ss},${mmm}`;
    
    draw();
    requestAnimationFrame(animateHint);
}

// Background Music System removed

function bfsPath(start, target) {
    let queue = [start];
    let visited = new Set([`${start.x},${start.y}`]);
    let cameFrom = new Map();
    
    while (queue.length > 0) {
        let curr = queue.shift();
        
        if (curr.x === target.x && curr.y === target.y) {
            let path = [curr];
            let step = curr;
            while (cameFrom.has(`${step.x},${step.y}`)) {
                step = cameFrom.get(`${step.x},${step.y}`);
                path.push(step);
            }
            return path.reverse();
        }
        
        let cell = grid[curr.x][curr.y];
        let neighbors = [];
        
        if (curr.y > 0 && !cell.walls.top) neighbors.push({x: curr.x, y: curr.y - 1});
        if (curr.x < cols - 1 && !cell.walls.right) neighbors.push({x: curr.x + 1, y: curr.y});
        if (curr.y < rows - 1 && !cell.walls.bottom) neighbors.push({x: curr.x, y: curr.y + 1});
        if (curr.x > 0 && !cell.walls.left) neighbors.push({x: curr.x - 1, y: curr.y});
        
        for (let n of neighbors) {
            let key = `${n.x},${n.y}`;
            if (!visited.has(key)) {
                visited.add(key);
                cameFrom.set(key, curr);
                queue.push(n);
            }
        }
    }
    return [];
}

// Mobile Controls Initialization
let moveInterval = null;
function initMobileControls() {
    const controls = {
        'ctrl-up': 'top',
        'ctrl-right': 'right',
        'ctrl-down': 'bottom',
        'ctrl-left': 'left'
    };

    Object.entries(controls).forEach(([id, dir]) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const startMoving = (e) => {
            e.preventDefault();
            moveInDirection(dir);
            if (moveInterval) clearInterval(moveInterval);
            moveInterval = setInterval(() => moveInDirection(dir), 200);
        };

        const stopMoving = (e) => {
            e.preventDefault();
            if (moveInterval) {
                clearInterval(moveInterval);
                moveInterval = null;
            }
        };

        btn.addEventListener('touchstart', startMoving, { passive: false });
        btn.addEventListener('touchend', stopMoving, { passive: false });
        btn.addEventListener('touchcancel', stopMoving, { passive: false });
        
        // For mouse testing
        btn.addEventListener('mousedown', startMoving);
        btn.addEventListener('mouseup', stopMoving);
        btn.addEventListener('mouseleave', stopMoving);
    });

    // Swipe Detection
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
            if (Math.abs(dx) > Math.abs(dy)) {
                moveInDirection(dx > 0 ? 'right' : 'left');
            } else {
                moveInDirection(dy > 0 ? 'bottom' : 'top');
            }
        }
    }, { passive: true });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('SW registered:', registration);
        }).catch(error => {
            console.log('SW registration failed:', error);
        });
    });
}

// Start Game
initList();
initMobileControls();
loadLevel(1);
