// Jigsaw Puzzle Game for WebXDC
class JigsawGame {
    constructor() {
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.pieces = [];
        this.selectedPiece = null;
        this.dragOffset = { x: 0, y: 0 };
        this.gridSize = 3; // Default 3x3
        this.moves = 0;
        this.timer = null;
        this.seconds = 0;
        this.currentImage = null;
        this.isPlaying = false;
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.tabSize = 0; // Size of the jigsaw tabs
        
        // Performance optimization: cached piece canvases
        this.pieceCanvasCache = new Map();
        this.staticLayerCanvas = null; // For placed pieces
        this.staticLayerDirty = true;
        this.backgroundCanvas = null; // For grid lines and background
        this.backgroundDirty = true;
        this.lastRenderTime = 0;
        this.renderThrottleMs = 8; // ~120fps max, prevents excessive renders
        this.pendingRender = null;
        
        // Default images (base64 encoded simple patterns)
        this.defaultImages = [];
        
        // Player stats
        this.stats = this.loadStats();
        
        // Sound effects - store as templates for cloning
        this.soundTemplates = {
            grab: 'assets/sounds/grab.mp3',
            drop: 'assets/sounds/drop.mp3',
            win: 'assets/sounds/win.mp3'
        };
        
        // Preload sounds by creating and loading audio elements
        this.sounds = {};
        Object.entries(this.soundTemplates).forEach(([name, src]) => {
            const audio = new Audio(src);
            audio.load();
            audio.volume = 0.5;
            this.sounds[name] = audio;
        });
        
        // Sound volume setting
        this.soundVolume = 0.5;
        
        // Background music
        this.bgMusic = new Audio('assets/tracks/soft-atmosphere.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.15; // Low background volume
        this.bgMusic.load();
        this.musicStarted = false;
        
        this.init();
    }
    
    // Load stats from localStorage
    loadStats() {
        try {
            const saved = localStorage.getItem('jigsaw_stats');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.log('Could not load stats:', e);
        }
        return {
            puzzlesSolved: 0,
            totalPlayTime: 0, // in seconds
            totalMoves: 0,
            bestTime: null, // best time for any puzzle
            gamesStarted: 0,
            lastPlayed: null
        };
    }
    
    // Save stats to localStorage
    saveStats() {
        try {
            localStorage.setItem('jigsaw_stats', JSON.stringify(this.stats));
        } catch (e) {
            console.log('Could not save stats:', e);
        }
    }
    
    // Save difficulty preference
    saveDifficulty(pieces) {
        try {
            localStorage.setItem('jigsaw_difficulty', pieces.toString());
        } catch (e) {
            console.log('Could not save difficulty:', e);
        }
    }
    
    // Load saved difficulty and apply it
    loadSavedDifficulty() {
        try {
            const saved = localStorage.getItem('jigsaw_difficulty');
            if (saved) {
                const pieces = parseInt(saved);
                this.gridSize = Math.sqrt(pieces);
                // Update UI to reflect saved difficulty
                document.querySelectorAll('.diff-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (parseInt(btn.dataset.pieces) === pieces) {
                        btn.classList.add('active');
                    }
                });
            }
        } catch (e) {
            console.log('Could not load difficulty:', e);
        }
    }
    
    // Start a random puzzle
    startRandomPuzzle() {
        if (this.defaultImages.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.defaultImages.length);
        const img = this.defaultImages[randomIndex];
        const imgSrc = img.src || img.dataUrl;
        this.startGame(imgSrc, img.attribution);
    }
    
    // Update stats display in menu
    updateStatsDisplay() {
        const statsContainer = document.getElementById('playerStats');
        if (!statsContainer) return;
        
        // Hide stats if player hasn't played yet
        if (this.stats.gamesStarted === 0) {
            statsContainer.classList.add('hidden');
            return;
        }
        
        statsContainer.classList.remove('hidden');
        
        // Format time nicely
        const formatPlayTime = (seconds) => {
            if (seconds < 60) return `${seconds}s`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        };
        
        const formatBestTime = (seconds) => {
            if (!seconds) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        statsContainer.innerHTML = `
            <div class="stats-title">📊 Your Stats</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-icon">🏆</span>
                    <div class="stat-info">
                        <span class="stat-value">${this.stats.puzzlesSolved}</span>
                        <span class="stat-label">Puzzles Solved</span>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">⏱️</span>
                    <div class="stat-info">
                        <span class="stat-value">${formatPlayTime(this.stats.totalPlayTime)}</span>
                        <span class="stat-label">Time Played</span>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">🎯</span>
                    <div class="stat-info">
                        <span class="stat-value">${formatBestTime(this.stats.bestTime)}</span>
                        <span class="stat-label">Best Time</span>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">🔄</span>
                    <div class="stat-info">
                        <span class="stat-value">${this.stats.totalMoves}</span>
                        <span class="stat-label">Total Moves</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Play a sound effect using cloned audio for instant playback
    playSound(name) {
        const originalSound = this.sounds[name];
        if (originalSound) {
            // Clone the preloaded audio element for instant, overlapping playback
            const sound = originalSound.cloneNode();
            sound.volume = this.soundVolume;
            sound.play().catch(() => {}); // Ignore autoplay errors
        }
    }
    
    // Start background music (requires user interaction)
    startBackgroundMusic() {
        if (!this.musicStarted) {
            this.bgMusic.play().catch(() => {}); // Ignore autoplay errors
            this.musicStarted = true;
        }
    }
    
    init() {
        // Set player name from WebXDC
        const playerName = window.webxdc?.selfName || 'Player';
        document.getElementById('playerName').textContent = playerName;
        
        // Set welcome name in menu
        const welcomeNameEl = document.getElementById('welcomeName');
        if (welcomeNameEl) {
            welcomeNameEl.textContent = playerName;
        }
        
        // Generate default images
        this.generateDefaultImages();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render default gallery
        this.renderDefaultGallery();
        
        // Display player stats
        this.updateStatsDisplay();
    }
    
    generateDefaultImages() {
        // Add real puzzle images first (with attributions)
        const realImages = [
            {
                name: 'Eilean Donan, UK',
                src: 'assets/puzzles/landscape-2.jpg',
                attribution: 'Photo by Christian Lendl on Unsplash'
            },
            {
                name: 'Bled, Slovenia',
                src: 'assets/puzzles/landscape-1.jpg',
                attribution: 'Photo by Ursa Bavcar on Unsplash'
            },
            {
                name: 'Seljalandsfoss, Iceland',
                src: 'assets/puzzles/landscape-3.jpg',
                attribution: 'Photo by Robert Lukeman on Unsplash'
            },
            {
                name: 'Maligne Lake, Canada',
                src: 'assets/puzzles/landscape-4.jpg',
                attribution: 'Photo by Tom Gainor on Unsplash'
            },
            {
                name: 'Bali, Indonesia',
                src: 'assets/puzzles/landscape-5.jpg',
                attribution: 'Photo by Aron Visuals on Unsplash'
            },
            {
                name: 'Twr Mawr, Anglesey',
                src: 'assets/puzzles/landscape-6.jpg',
                attribution: 'Photo by Jim Cooke on Unsplash'
            }
        ];
        
        // Add real images to the list
        realImages.forEach(img => {
            this.defaultImages.push({
                name: img.name,
                src: img.src,
                attribution: img.attribution,
                isExternal: true
            });
        });
    }
    
    renderDefaultGallery() {
        const gallery = document.getElementById('defaultGallery');
        gallery.innerHTML = '';
        
        this.defaultImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            // Handle both external images and data URLs
            const imgSrc = img.isExternal ? img.src : img.dataUrl;
            item.innerHTML = `
                <img src="${imgSrc}" alt="${img.name}">
                <span class="gallery-item-name">${img.name}</span>
            `;
            item.addEventListener('click', () => {
                this.startBackgroundMusic(); // Start music on first interaction
                this.startGame(imgSrc, img.attribution);
            });
            gallery.appendChild(item);
        });
    }
    
    setupEventListeners() {
        // Load saved difficulty from localStorage
        this.loadSavedDifficulty();
        
        // Difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const pieces = parseInt(e.target.dataset.pieces);
                this.gridSize = Math.sqrt(pieces);
                // Save difficulty preference
                this.saveDifficulty(pieces);
            });
        });
        
        // Random puzzle button
        document.getElementById('randomBtn')?.addEventListener('click', () => this.startRandomPuzzle());
        
        // Import button
        document.getElementById('importBtn').addEventListener('click', () => this.importImage());
        
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => this.showMenu());
        
        // Preview button
        document.getElementById('previewBtn').addEventListener('click', () => this.showPreview());
        document.getElementById('closePreview').addEventListener('click', () => this.hidePreview());
        document.getElementById('previewModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('previewModal')) {
                this.hidePreview();
            }
        });
        
        // Game controls
        document.getElementById('shuffleBtn').addEventListener('click', () => this.shufflePieces());
        document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
        
        // Victory buttons
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('newPuzzleBtn').addEventListener('click', () => this.showMenu());
        
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('mouseup', () => this.onPointerUp());
        this.canvas.addEventListener('mouseleave', () => this.onPointerUp());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onPointerDown(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onPointerMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.onPointerUp());
        this.canvas.addEventListener('touchcancel', () => this.onPointerUp());
        
        // Window resize
        window.addEventListener('resize', () => {
            if (this.isPlaying) {
                this.resizeCanvas();
            }
        });
    }
    
    async importImage() {
        this.startBackgroundMusic(); // Start music on interaction
        try {
            const files = await window.webxdc.importFiles({
                mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                multiple: false
            });
            
            if (files && files.length > 0) {
                const file = files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.startGame(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        } catch (error) {
            console.error('Error importing image:', error);
            // Fallback for testing without WebXDC
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.startGame(ev.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        }
    }
    
    startGame(imageDataUrl, attribution = null) {
        this.currentAttribution = attribution;
        this.currentImage = new Image();
        this.currentImage.onload = () => {
            this.showScreen('gameScreen');
            this.isPlaying = true;
            this.moves = 0;
            this.seconds = 0;
            this.updateStats();
            this.updateAttribution();
            
            // Track game started in player stats
            this.stats.gamesStarted++;
            this.stats.lastPlayed = Date.now();
            this.saveStats();
            
            // Wait for the DOM to fully render the game screen before sizing canvas
            // Use setTimeout to ensure layout is complete
            setTimeout(() => {
                this.resizeCanvas();
                this.createPieces();
                this.shufflePieces(true, true); // animate=true, isInitialShuffle=true
                this.startTimer();
                this.render();
            }, 50);
        };
        this.currentImage.src = imageDataUrl;
        document.getElementById('previewImage').src = imageDataUrl;
    }
    
    updateAttribution() {
        const attrElement = document.getElementById('attribution');
        if (attrElement) {
            if (this.currentAttribution) {
                attrElement.textContent = this.currentAttribution;
                attrElement.style.display = 'block';
            } else {
                attrElement.style.display = 'none';
            }
        }
    }
    
    resizeCanvas() {
        // Store old dimensions for proportional repositioning
        const oldCanvasWidth = this.canvas.width || 1;
        const oldCanvasHeight = this.canvas.height || 1;
        const oldPieceWidth = this.pieceWidth || 1;
        const oldPieceHeight = this.pieceHeight || 1;
        const oldTabSize = this.tabSize || 0;
        
        // Get the actual available space from the game container
        const gameContainer = document.querySelector('.game-container');
        const puzzleArea = document.querySelector('.puzzle-area');
        
        let maxWidth, maxHeight;
        
        if (gameContainer) {
            // Use the container's actual dimensions minus padding
            const containerRect = gameContainer.getBoundingClientRect();
            const puzzleAreaPadding = puzzleArea ? 24 : 0; // padding + border-radius compensation
            maxWidth = containerRect.width - puzzleAreaPadding;
            maxHeight = containerRect.height - puzzleAreaPadding;
        } else {
            // Fallback to window dimensions
            maxWidth = window.innerWidth - 40;
            maxHeight = window.innerHeight - 140;
        }
        
        // Ensure minimum dimensions
        maxWidth = Math.max(200, maxWidth);
        maxHeight = Math.max(200, maxHeight);
        
        // Calculate canvas size maintaining aspect ratio
        const imgRatio = this.currentImage.width / this.currentImage.height;
        let canvasWidth, canvasHeight;
        
        if (maxWidth / maxHeight > imgRatio) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * imgRatio;
        } else {
            canvasWidth = maxWidth;
            canvasHeight = canvasWidth / imgRatio;
        }
        
        // Add extra space for tabs
        this.pieceWidth = canvasWidth / this.gridSize;
        this.pieceHeight = canvasHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.2;
        
        // Expand canvas to accommodate tabs on edges
        const newCanvasWidth = canvasWidth + this.tabSize * 2;
        const newCanvasHeight = canvasHeight + this.tabSize * 2;
        
        this.canvas.width = newCanvasWidth;
        this.canvas.height = newCanvasHeight;
        
        // Calculate the puzzle area bounds (excluding tab margins)
        const puzzleAreaWidth = this.pieceWidth * this.gridSize;
        const puzzleAreaHeight = this.pieceHeight * this.gridSize;
        const oldPuzzleAreaWidth = oldPieceWidth * this.gridSize;
        const oldPuzzleAreaHeight = oldPieceHeight * this.gridSize;
        
        // Update piece positions if they exist
        if (this.pieces.length > 0) {
            this.pieces.forEach(piece => {
                // Store old relative position within the puzzle area (0-1 range)
                const oldRelX = (piece.x - oldTabSize) / oldPuzzleAreaWidth;
                const oldRelY = (piece.y - oldTabSize) / oldPuzzleAreaHeight;
                
                // Update piece dimensions
                piece.width = this.pieceWidth;
                piece.height = this.pieceHeight;
                
                // Update correct position
                piece.correctX = piece.col * this.pieceWidth + this.tabSize;
                piece.correctY = piece.row * this.pieceHeight + this.tabSize;
                
                // Reposition pieces
                if (!piece.isPlaced) {
                    // Convert relative position back to absolute using new dimensions
                    piece.x = oldRelX * puzzleAreaWidth + this.tabSize;
                    piece.y = oldRelY * puzzleAreaHeight + this.tabSize;
                    
                    // Clamp to canvas bounds with proper padding
                    const minX = this.tabSize;
                    const minY = this.tabSize;
                    const maxX = newCanvasWidth - piece.width - this.tabSize;
                    const maxY = newCanvasHeight - piece.height - this.tabSize;
                    
                    piece.x = Math.max(minX, Math.min(piece.x, maxX));
                    piece.y = Math.max(minY, Math.min(piece.y, maxY));
                } else {
                    // Placed pieces stay at their correct position
                    piece.x = piece.correctX;
                    piece.y = piece.correctY;
                }
            });
            
            // Invalidate caches and re-render piece textures
            this.pieceCanvasCache.clear();
            this.prerenderPieceTextures();
        }
        
        // Update static layer canvas size
        if (this.staticLayerCanvas) {
            this.staticLayerCanvas.width = newCanvasWidth;
            this.staticLayerCanvas.height = newCanvasHeight;
            this.staticLayerDirty = true;
        }
        
        // Mark background as dirty to re-render grid
        this.backgroundDirty = true;
        
        this.render();
    }
    
    // Generate random tab configuration for pieces
    generateTabConfig() {
        // Create a grid of tab directions
        // 1 = tab sticks out, -1 = tab goes in (notch)
        const horizontalTabs = []; // Tabs between rows
        const verticalTabs = [];   // Tabs between columns
        
        // Generate horizontal tabs (between rows)
        for (let row = 0; row < this.gridSize - 1; row++) {
            horizontalTabs[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                horizontalTabs[row][col] = Math.random() > 0.5 ? 1 : -1;
            }
        }
        
        // Generate vertical tabs (between columns)
        for (let row = 0; row < this.gridSize; row++) {
            verticalTabs[row] = [];
            for (let col = 0; col < this.gridSize - 1; col++) {
                verticalTabs[row][col] = Math.random() > 0.5 ? 1 : -1;
            }
        }
        
        return { horizontalTabs, verticalTabs };
    }
    
    createPieces() {
        this.pieces = [];
        this.pieceCanvasCache.clear(); // Clear cache when creating new pieces
        this.staticLayerDirty = true;
        const tabConfig = this.generateTabConfig();
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // Determine tab directions for each edge
                // Top edge
                let topTab = 0;
                if (row > 0) {
                    topTab = -tabConfig.horizontalTabs[row - 1][col]; // Opposite of piece above's bottom
                }
                
                // Bottom edge
                let bottomTab = 0;
                if (row < this.gridSize - 1) {
                    bottomTab = tabConfig.horizontalTabs[row][col];
                }
                
                // Left edge
                let leftTab = 0;
                if (col > 0) {
                    leftTab = -tabConfig.verticalTabs[row][col - 1]; // Opposite of piece to left's right
                }
                
                // Right edge
                let rightTab = 0;
                if (col < this.gridSize - 1) {
                    rightTab = tabConfig.verticalTabs[row][col];
                }
                
                const piece = {
                    id: row * this.gridSize + col,
                    row: row,
                    col: col,
                    x: col * this.pieceWidth + this.tabSize,
                    y: row * this.pieceHeight + this.tabSize,
                    width: this.pieceWidth,
                    height: this.pieceHeight,
                    correctX: col * this.pieceWidth + this.tabSize,
                    correctY: row * this.pieceHeight + this.tabSize,
                    isPlaced: false,
                    tabs: {
                        top: topTab,
                        right: rightTab,
                        bottom: bottomTab,
                        left: leftTab
                    }
                };
                this.pieces.push(piece);
            }
        }
        
        // Pre-render all piece textures for performance
        this.prerenderPieceTextures();
    }
    
    // Pre-render piece textures to offscreen canvases for performance
    prerenderPieceTextures() {
        this.pieces.forEach(piece => {
            this.cachePieceTexture(piece);
        });
        
        // Initialize static layer canvas
        this.staticLayerCanvas = document.createElement('canvas');
        this.staticLayerCanvas.width = this.canvas.width;
        this.staticLayerCanvas.height = this.canvas.height;
        this.staticLayerDirty = true;
        
        // Initialize background canvas
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = this.canvas.width;
        this.backgroundCanvas.height = this.canvas.height;
        this.backgroundDirty = true;
    }
    
    // Cache a single piece's texture to an offscreen canvas
    cachePieceTexture(piece) {
        const padding = this.tabSize * 2;
        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = piece.width + padding * 2;
        cacheCanvas.height = piece.height + padding * 2;
        const cacheCtx = cacheCanvas.getContext('2d');
        
        // Source coordinates from original image
        const srcX = piece.col * (this.currentImage.width / this.gridSize);
        const srcY = piece.row * (this.currentImage.height / this.gridSize);
        const srcW = this.currentImage.width / this.gridSize;
        const srcH = this.currentImage.height / this.gridSize;
        
        // Calculate extra source area for tabs
        const tabRatio = this.tabSize / piece.width;
        const extraSrcW = srcW * tabRatio;
        const extraSrcH = srcH * tabRatio;
        
        // Create a temporary piece at origin for drawing
        const tempPiece = {
            ...piece,
            x: padding,
            y: padding
        };
        
        // Create clipping path
        this.drawPiecePath(cacheCtx, tempPiece);
        cacheCtx.save();
        cacheCtx.clip();
        
        // Draw the image portion
        const drawX = padding - this.tabSize;
        const drawY = padding - this.tabSize;
        const drawW = piece.width + this.tabSize * 2;
        const drawH = piece.height + this.tabSize * 2;
        
        // Calculate source rectangle with extra for tabs
        const srcDrawX = srcX - extraSrcW;
        const srcDrawY = srcY - extraSrcH;
        const srcDrawW = srcW + extraSrcW * 2;
        const srcDrawH = srcH + extraSrcH * 2;
        
        // Clamp source coordinates to image bounds
        const clampedSrcX = Math.max(0, srcDrawX);
        const clampedSrcY = Math.max(0, srcDrawY);
        const clampedSrcW = Math.min(this.currentImage.width - clampedSrcX, srcDrawW - (clampedSrcX - srcDrawX));
        const clampedSrcH = Math.min(this.currentImage.height - clampedSrcY, srcDrawH - (clampedSrcY - srcDrawY));
        
        // Adjust destination based on clamping
        const destOffsetX = (clampedSrcX - srcDrawX) / srcDrawW * drawW;
        const destOffsetY = (clampedSrcY - srcDrawY) / srcDrawH * drawH;
        const destW = clampedSrcW / srcDrawW * drawW;
        const destH = clampedSrcH / srcDrawH * drawH;
        
        cacheCtx.drawImage(
            this.currentImage,
            clampedSrcX, clampedSrcY, clampedSrcW, clampedSrcH,
            drawX + destOffsetX, drawY + destOffsetY, destW, destH
        );
        
        cacheCtx.restore();
        
        // Draw the border directly on the cached canvas
        this.drawPiecePath(cacheCtx, tempPiece);
        cacheCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        cacheCtx.lineWidth = this.gridSize > 8 ? 1 : 2;
        cacheCtx.stroke();
        
        this.pieceCanvasCache.set(piece.id, {
            canvas: cacheCanvas,
            padding: padding
        });
    }
    
    shufflePieces(animate = true, isInitialShuffle = false) {
        const padding = this.tabSize + 10;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const isLargeBoard = this.gridSize > 8;
        
        if (animate) {
            // Store starting positions for each piece BEFORE any reordering
            const pieceData = this.pieces.map(piece => ({
                piece: piece,
                startX: isInitialShuffle ? piece.correctX : piece.x,
                startY: isInitialShuffle ? piece.correctY : piece.y,
                targetX: padding + Math.random() * (canvasWidth - piece.width - padding * 2 - this.tabSize),
                targetY: padding + Math.random() * (canvasHeight - piece.height - padding * 2 - this.tabSize),
                animDelay: isLargeBoard ? 0 : Math.random() * 0.3, // No staggered delay for large boards
                rotationDir: (Math.random() - 0.5) * 2
            }));
            
            // Shuffle the piece order for z-index BEFORE animation starts
            for (let i = pieceData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pieceData[i], pieceData[j]] = [pieceData[j], pieceData[i]];
            }
            
            // Reorder the pieces array to match shuffled order
            this.pieces = pieceData.map(data => data.piece);
            
            // For initial shuffle, set pieces to correct positions first
            if (isInitialShuffle) {
                this.pieces.forEach(piece => {
                    piece.x = piece.correctX;
                    piece.y = piece.correctY;
                });
            }
            
            // Reset placed state and set up animation properties
            pieceData.forEach(data => {
                data.piece.isPlaced = false;
                data.piece.animRotation = 0;
                data.piece.animScale = 1;
            });
            
            // Show the current state briefly (only for initial shuffle)
            this.render();
            
            // Animate pieces flying to shuffled positions
            // Shorter duration for large boards
            const duration = isLargeBoard ? 1200 : 2200;
            const startTime = performance.now();
            
            // Sine-based ease-in-out: zero velocity at start AND end
            const easeInOutSine = (t) => {
                return -(Math.cos(Math.PI * t) - 1) / 2;
            };
            
            // Smooth bell curve for rotation/scale
            const bellCurve = (t) => {
                return Math.sin(t * Math.PI);
            };
            
            const animateFrame = (currentTime) => {
                const elapsed = currentTime - startTime;
                const globalProgress = Math.min(elapsed / duration, 1);
                
                // Update piece positions with individual timing
                pieceData.forEach(data => {
                    const piece = data.piece;
                    
                    // Calculate individual piece progress with its delay
                    const delayedProgress = Math.max(0, globalProgress - data.animDelay);
                    const scaledProgress = delayedProgress / (1 - Math.max(0.01, data.animDelay));
                    const pieceProgress = Math.min(1, Math.max(0, scaledProgress));
                    
                    // Apply smooth easing to the progress
                    const posEased = easeInOutSine(pieceProgress);
                    
                    // Position interpolation
                    piece.x = data.startX + (data.targetX - data.startX) * posEased;
                    piece.y = data.startY + (data.targetY - data.startY) * posEased;
                    
                    // Skip rotation/scale for large boards - major performance improvement
                    if (!isLargeBoard) {
                        // Rotation: smooth bell curve, zero at start and end
                        const rotationAmount = bellCurve(pieceProgress);
                        piece.animRotation = rotationAmount * data.rotationDir * 12 * (Math.PI / 180);
                        
                        // Scale: smooth bell curve for subtle pop effect
                        const scaleAmount = bellCurve(pieceProgress);
                        piece.animScale = 1 + scaleAmount * 0.08;
                    }
                });
                
                this.render();
                
                if (globalProgress < 1) {
                    requestAnimationFrame(animateFrame);
                } else {
                    // Animation complete - just clean up animation properties
                    this.pieces.forEach(piece => {
                        piece.animRotation = 0;
                        piece.animScale = 1;
                    });
                    this.render();
                }
            };
            
            // Start animation - delay only for initial shuffle to show complete puzzle
            // Shorter delay for large boards
            const delay = isInitialShuffle ? (isLargeBoard ? 400 : 800) : 0;
            setTimeout(() => {
                requestAnimationFrame(animateFrame);
            }, delay);
        } else {
            // No animation - just set positions directly and shuffle order
            this.pieces.forEach(piece => {
                piece.x = padding + Math.random() * (canvasWidth - piece.width - padding * 2 - this.tabSize);
                piece.y = padding + Math.random() * (canvasHeight - piece.height - padding * 2 - this.tabSize);
                piece.isPlaced = false;
            });
            
            // Shuffle the array order for z-index
            for (let i = this.pieces.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
            }
            this.render();
        }
    }
    
    getPointerPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    // Check if a point is inside a piece (including tabs)
    isPointInPiece(x, y, piece) {
        const tabSize = this.tabSize;
        const pw = piece.width;
        const ph = piece.height;
        const px = piece.x;
        const py = piece.y;
        
        // Check main body
        if (x >= px && x <= px + pw && y >= py && y <= py + ph) {
            return true;
        }
        
        // Check tabs
        const tabRadius = tabSize * 0.8;
        
        // Top tab
        if (piece.tabs.top === 1) {
            const cx = px + pw / 2;
            const cy = py - tabSize * 0.3;
            if (Math.hypot(x - cx, y - cy) <= tabRadius) return true;
        }
        
        // Bottom tab
        if (piece.tabs.bottom === 1) {
            const cx = px + pw / 2;
            const cy = py + ph + tabSize * 0.3;
            if (Math.hypot(x - cx, y - cy) <= tabRadius) return true;
        }
        
        // Left tab
        if (piece.tabs.left === 1) {
            const cx = px - tabSize * 0.3;
            const cy = py + ph / 2;
            if (Math.hypot(x - cx, y - cy) <= tabRadius) return true;
        }
        
        // Right tab
        if (piece.tabs.right === 1) {
            const cx = px + pw + tabSize * 0.3;
            const cy = py + ph / 2;
            if (Math.hypot(x - cx, y - cy) <= tabRadius) return true;
        }
        
        return false;
    }
    
    onPointerDown(e) {
        e.preventDefault();
        const pos = this.getPointerPosition(e);
        
        // Find piece under pointer (check from top to bottom)
        // Skip pieces that are already placed (locked in position)
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const piece = this.pieces[i];
            // Skip already placed pieces - they are locked
            if (piece.isPlaced) continue;
            
            if (this.isPointInPiece(pos.x, pos.y, piece)) {
                this.selectedPiece = piece;
                this.dragOffset = {
                    x: pos.x - piece.x,
                    y: pos.y - piece.y
                };
                
                // Play grab sound
                this.playSound('grab');
                
                // Move to top
                this.pieces.splice(i, 1);
                this.pieces.push(piece);
                
                this.render();
                break;
            }
        }
    }
    
    onPointerMove(e) {
        if (!this.selectedPiece) return;
        e.preventDefault();
        
        const pos = this.getPointerPosition(e);
        this.selectedPiece.x = pos.x - this.dragOffset.x;
        this.selectedPiece.y = pos.y - this.dragOffset.y;
        
        // Keep within bounds (accounting for tabs)
        const minX = this.tabSize;
        const minY = this.tabSize;
        const maxX = this.canvas.width - this.selectedPiece.width - this.tabSize;
        const maxY = this.canvas.height - this.selectedPiece.height - this.tabSize;
        
        this.selectedPiece.x = Math.max(minX, Math.min(maxX, this.selectedPiece.x));
        this.selectedPiece.y = Math.max(minY, Math.min(maxY, this.selectedPiece.y));
        
        // Use requestAnimationFrame for smooth, throttled rendering
        if (!this.pendingRender) {
            this.pendingRender = requestAnimationFrame(() => {
                this.render();
                this.pendingRender = null;
            });
        }
    }
    
    onPointerUp() {
        if (!this.selectedPiece) return;
        
        // Cancel any pending render
        if (this.pendingRender) {
            cancelAnimationFrame(this.pendingRender);
            this.pendingRender = null;
        }
        
        const piece = this.selectedPiece;
        const snapThreshold = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
        
        // Check if close to correct position
        const dx = Math.abs(piece.x - piece.correctX);
        const dy = Math.abs(piece.y - piece.correctY);
        
        if (dx < snapThreshold && dy < snapThreshold) {
            piece.x = piece.correctX;
            piece.y = piece.correctY;
            
            if (!piece.isPlaced) {
                piece.isPlaced = true;
                piece.placedTime = Date.now(); // Record when piece was placed for fade effect
                this.staticLayerDirty = true; // Mark static layer for re-render
                this.moves++;
                this.updateStats();
                
                // Play drop sound for correct placement
                this.playSound('drop');
                
                // Visual feedback
                this.flashPiece(piece);
            }
        } else {
            // Play drop sound for incorrect placement
            this.playSound('drop');
            this.moves++;
            this.updateStats();
        }
        
        this.selectedPiece = null;
        this.render();
        
        // Check for win
        if (this.checkWin()) {
            this.onWin();
        }
    }
    
    flashPiece(piece) {
        // Visual feedback for correct placement with flash then fade
        // For large boards, skip the flash animation to improve performance
        if (this.gridSize > 8) {
            this.staticLayerDirty = true;
            this.startFadeAnimation();
            return;
        }
        
        let flashes = 0;
        const flashInterval = setInterval(() => {
            flashes++;
            if (flashes > 4) {
                clearInterval(flashInterval);
                // Continue rendering for the fade effect
                this.startFadeAnimation();
                return;
            }
            this.render(flashes % 2 === 0 ? piece : null);
        }, 100);
    }
    
    startFadeAnimation() {
        // Animate the fade of placed piece borders
        // For large boards, use a lower frame rate
        const fadeTime = 2000;
        const startTime = Date.now();
        const frameInterval = this.gridSize > 8 ? 100 : 16; // ~10fps for large boards, ~60fps for small
        let lastFrameTime = 0;
        
        const animateFade = (currentTime) => {
            const elapsed = Date.now() - startTime;
            
            // Throttle frame rate for large boards
            if (currentTime - lastFrameTime >= frameInterval) {
                lastFrameTime = currentTime;
                this.staticLayerDirty = true; // Need to update static layer for border fade
                this.render();
            }
            
            if (elapsed < fadeTime && this.isPlaying) {
                requestAnimationFrame(animateFade);
            } else {
                this.staticLayerDirty = true;
                this.render(); // Final render
            }
        };
        
        requestAnimationFrame(animateFade);
    }
    
    checkWin() {
        return this.pieces.every(piece => piece.isPlaced);
    }
    
    onWin() {
        this.isPlaying = false;
        this.stopTimer();
        
        // Update player stats
        this.stats.puzzlesSolved++;
        this.stats.totalPlayTime += this.seconds;
        this.stats.totalMoves += this.moves;
        if (!this.stats.bestTime || this.seconds < this.stats.bestTime) {
            this.stats.bestTime = this.seconds;
        }
        this.saveStats();
        
        // Play victory sound
        this.playSound('win');
        
        // Show victory screen
        setTimeout(() => {
            const playerName = window.webxdc?.selfName || 'Player';
            document.getElementById('victoryPlayer').textContent = `Well done, ${playerName}!`;
            document.getElementById('finalTime').textContent = this.formatTime(this.seconds);
            document.getElementById('finalMoves').textContent = this.moves;
            
            this.showScreen('victoryScreen');
            this.createConfetti();
        }, 500);
    }
    
    createConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';
        
        const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#1dd1a1', '#a29bfe'];
        
        for (let i = 0; i < 50; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            container.appendChild(piece);
        }
    }
    
    // Draw a jigsaw piece path with tabs
    drawPiecePath(ctx, piece, offsetX = 0, offsetY = 0) {
        const x = piece.x + offsetX;
        const y = piece.y + offsetY;
        const w = piece.width;
        const h = piece.height;
        const tabSize = this.tabSize;
        const tabs = piece.tabs;
        
        ctx.beginPath();
        
        // Start at top-left corner
        ctx.moveTo(x, y);
        
        // Top edge
        if (tabs.top === 0) {
            ctx.lineTo(x + w, y);
        } else {
            ctx.lineTo(x + w * 0.35, y);
            this.drawTab(ctx, x + w * 0.35, y, w * 0.3, tabSize, tabs.top, 'top');
            ctx.lineTo(x + w, y);
        }
        
        // Right edge
        if (tabs.right === 0) {
            ctx.lineTo(x + w, y + h);
        } else {
            ctx.lineTo(x + w, y + h * 0.35);
            this.drawTab(ctx, x + w, y + h * 0.35, h * 0.3, tabSize, tabs.right, 'right');
            ctx.lineTo(x + w, y + h);
        }
        
        // Bottom edge
        if (tabs.bottom === 0) {
            ctx.lineTo(x, y + h);
        } else {
            ctx.lineTo(x + w * 0.65, y + h);
            this.drawTab(ctx, x + w * 0.65, y + h, w * 0.3, tabSize, tabs.bottom, 'bottom');
            ctx.lineTo(x, y + h);
        }
        
        // Left edge
        if (tabs.left === 0) {
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y + h * 0.65);
            this.drawTab(ctx, x, y + h * 0.65, h * 0.3, tabSize, tabs.left, 'left');
            ctx.lineTo(x, y);
        }
        
        ctx.closePath();
    }
    
    // Draw a single tab or notch using bezier curves
    drawTab(ctx, startX, startY, size, tabDepth, direction, edge) {
        // direction: 1 = tab (outward), -1 = notch (inward)
        const d = direction * tabDepth * 0.8;
        
        if (edge === 'top') {
            const neckWidth = size * 0.2;
            const headWidth = size * 0.35;
            
            // Draw the tab shape
            ctx.lineTo(startX + neckWidth, startY);
            ctx.bezierCurveTo(
                startX + neckWidth, startY - d * 0.5,
                startX - headWidth + size * 0.5, startY - d,
                startX + size * 0.5, startY - d
            );
            ctx.bezierCurveTo(
                startX + size * 0.5 + headWidth, startY - d,
                startX + size - neckWidth, startY - d * 0.5,
                startX + size - neckWidth, startY
            );
            ctx.lineTo(startX + size, startY);
        } else if (edge === 'right') {
            const neckWidth = size * 0.2;
            const headWidth = size * 0.35;
            
            ctx.lineTo(startX, startY + neckWidth);
            ctx.bezierCurveTo(
                startX + d * 0.5, startY + neckWidth,
                startX + d, startY - headWidth + size * 0.5,
                startX + d, startY + size * 0.5
            );
            ctx.bezierCurveTo(
                startX + d, startY + size * 0.5 + headWidth,
                startX + d * 0.5, startY + size - neckWidth,
                startX, startY + size - neckWidth
            );
            ctx.lineTo(startX, startY + size);
        } else if (edge === 'bottom') {
            const neckWidth = size * 0.2;
            const headWidth = size * 0.35;
            
            ctx.lineTo(startX - neckWidth, startY);
            ctx.bezierCurveTo(
                startX - neckWidth, startY + d * 0.5,
                startX + headWidth - size * 0.5, startY + d,
                startX - size * 0.5, startY + d
            );
            ctx.bezierCurveTo(
                startX - size * 0.5 - headWidth, startY + d,
                startX - size + neckWidth, startY + d * 0.5,
                startX - size + neckWidth, startY
            );
            ctx.lineTo(startX - size, startY);
        } else if (edge === 'left') {
            const neckWidth = size * 0.2;
            const headWidth = size * 0.35;
            
            ctx.lineTo(startX, startY - neckWidth);
            ctx.bezierCurveTo(
                startX - d * 0.5, startY - neckWidth,
                startX - d, startY + headWidth - size * 0.5,
                startX - d, startY - size * 0.5
            );
            ctx.bezierCurveTo(
                startX - d, startY - size * 0.5 - headWidth,
                startX - d * 0.5, startY - size + neckWidth,
                startX, startY - size + neckWidth
            );
            ctx.lineTo(startX, startY - size);
        }
    }
    
    render(highlightPiece = null) {
        const ctx = this.ctx;
        
        // Use cached background if available
        if (this.backgroundCanvas && !this.backgroundDirty) {
            ctx.drawImage(this.backgroundCanvas, 0, 0);
        } else {
            this.renderBackground();
            if (this.backgroundCanvas) {
                ctx.drawImage(this.backgroundCanvas, 0, 0);
            }
        }
        
        // Use static layer for placed pieces if available and not dirty
        if (this.staticLayerCanvas && !this.staticLayerDirty) {
            ctx.drawImage(this.staticLayerCanvas, 0, 0);
        } else {
            // Render placed pieces and cache to static layer
            this.renderStaticLayer();
            if (this.staticLayerCanvas) {
                ctx.drawImage(this.staticLayerCanvas, 0, 0);
            }
        }
        
        // Draw unplaced pieces on top (they can be moved)
        this.pieces.forEach(piece => {
            if (!piece.isPlaced) {
                if (highlightPiece && piece === highlightPiece) return;
                this.drawPiece(piece);
            }
        });
    }
    
    // Render background and grid to a cached canvas
    renderBackground() {
        if (!this.backgroundCanvas) {
            this.backgroundCanvas = document.createElement('canvas');
        }
        this.backgroundCanvas.width = this.canvas.width;
        this.backgroundCanvas.height = this.canvas.height;
        
        const ctx = this.backgroundCanvas.getContext('2d');
        
        // Draw background with subtle pattern
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw target area (where pieces should go)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(this.tabSize, this.tabSize,
            this.pieceWidth * this.gridSize,
            this.pieceHeight * this.gridSize);
        
        // Draw grid lines for target positions
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= this.gridSize; i++) {
            ctx.moveTo(this.tabSize + i * this.pieceWidth, this.tabSize);
            ctx.lineTo(this.tabSize + i * this.pieceWidth, this.tabSize + this.pieceHeight * this.gridSize);
            ctx.moveTo(this.tabSize, this.tabSize + i * this.pieceHeight);
            ctx.lineTo(this.tabSize + this.pieceWidth * this.gridSize, this.tabSize + i * this.pieceHeight);
        }
        ctx.stroke();
        
        this.backgroundDirty = false;
    }
    
    // Render all placed pieces to a static layer canvas
    renderStaticLayer() {
        if (!this.staticLayerCanvas) return;
        
        const ctx = this.staticLayerCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.staticLayerCanvas.width, this.staticLayerCanvas.height);
        
        this.pieces.forEach(piece => {
            if (piece.isPlaced) {
                this.drawPieceToContext(ctx, piece);
            }
        });
        
        this.staticLayerDirty = false;
    }
    
    drawPiece(piece) {
        this.drawPieceToContext(this.ctx, piece);
    }
    
    // Draw a piece to a specific context (used for both main canvas and static layer)
    drawPieceToContext(ctx, piece) {
        const cached = this.pieceCanvasCache.get(piece.id);
        const isLargeBoard = this.gridSize > 8;
        
        // Apply animation transforms (rotation and scale) if present
        const hasAnimation = piece.animRotation !== undefined && piece.animRotation !== 0 ||
                            piece.animScale !== undefined && piece.animScale !== 1;
        
        ctx.save();
        
        if (hasAnimation) {
            const centerX = piece.x + piece.width / 2;
            const centerY = piece.y + piece.height / 2;
            ctx.translate(centerX, centerY);
            if (piece.animRotation) ctx.rotate(piece.animRotation);
            if (piece.animScale && piece.animScale !== 1) ctx.scale(piece.animScale, piece.animScale);
            ctx.translate(-centerX, -centerY);
        }
        
        // Draw shadow for unplaced pieces - DISABLED for large boards for performance
        if (!piece.isPlaced && !isLargeBoard) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = hasAnimation ? 20 : 15;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
        }
        
        // Draw cached texture if available (includes border)
        if (cached) {
            const padding = cached.padding;
            ctx.drawImage(
                cached.canvas,
                0, 0, cached.canvas.width, cached.canvas.height,
                piece.x - padding, piece.y - padding, cached.canvas.width, cached.canvas.height
            );
        } else {
            // Fallback: draw directly (shouldn't happen normally)
            this.drawPieceDirectly(ctx, piece);
        }
        
        ctx.restore();
        
        // Only draw dynamic borders for special states (selected, recently placed)
        // The default border is already in the cached texture
        const needsDynamicBorder = piece === this.selectedPiece ||
            (piece.isPlaced && piece.placedTime && (Date.now() - piece.placedTime) < 2000);
        
        if (needsDynamicBorder) {
            ctx.save();
            if (hasAnimation) {
                const centerX = piece.x + piece.width / 2;
                const centerY = piece.y + piece.height / 2;
                ctx.translate(centerX, centerY);
                if (piece.animRotation) ctx.rotate(piece.animRotation);
                if (piece.animScale && piece.animScale !== 1) ctx.scale(piece.animScale, piece.animScale);
                ctx.translate(-centerX, -centerY);
            }
            
            this.drawPiecePath(ctx, piece);
            
            if (piece.isPlaced) {
                // Fade the green border over 2 seconds after placement
                const fadeTime = 2000;
                const elapsed = piece.placedTime ? Date.now() - piece.placedTime : fadeTime;
                const opacity = Math.max(0, 0.9 - (elapsed / fadeTime) * 0.9);
                
                if (opacity > 0) {
                    ctx.strokeStyle = `rgba(51, 219, 152, ${opacity})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            } else if (piece === this.selectedPiece) {
                ctx.strokeStyle = '#59fcb3';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.restore();
        }
    }
    
    // Fallback direct drawing (without cache)
    drawPieceDirectly(ctx, piece) {
        const srcX = piece.col * (this.currentImage.width / this.gridSize);
        const srcY = piece.row * (this.currentImage.height / this.gridSize);
        const srcW = this.currentImage.width / this.gridSize;
        const srcH = this.currentImage.height / this.gridSize;
        
        const tabRatio = this.tabSize / this.pieceWidth;
        const extraSrcW = srcW * tabRatio;
        const extraSrcH = srcH * tabRatio;
        
        ctx.save();
        this.drawPiecePath(ctx, piece);
        ctx.clip();
        
        const drawX = piece.x - this.tabSize;
        const drawY = piece.y - this.tabSize;
        const drawW = piece.width + this.tabSize * 2;
        const drawH = piece.height + this.tabSize * 2;
        
        const srcDrawX = srcX - extraSrcW;
        const srcDrawY = srcY - extraSrcH;
        const srcDrawW = srcW + extraSrcW * 2;
        const srcDrawH = srcH + extraSrcH * 2;
        
        const clampedSrcX = Math.max(0, srcDrawX);
        const clampedSrcY = Math.max(0, srcDrawY);
        const clampedSrcW = Math.min(this.currentImage.width - clampedSrcX, srcDrawW - (clampedSrcX - srcDrawX));
        const clampedSrcH = Math.min(this.currentImage.height - clampedSrcY, srcDrawH - (clampedSrcY - srcDrawY));
        
        const destOffsetX = (clampedSrcX - srcDrawX) / srcDrawW * drawW;
        const destOffsetY = (clampedSrcY - srcDrawY) / srcDrawH * drawH;
        const destW = clampedSrcW / srcDrawW * drawW;
        const destH = clampedSrcH / srcDrawH * drawH;
        
        ctx.drawImage(
            this.currentImage,
            clampedSrcX, clampedSrcY, clampedSrcW, clampedSrcH,
            drawX + destOffsetX, drawY + destOffsetY, destW, destH
        );
        
        ctx.restore();
    }
    
    showHint() {
        // Find an unplaced piece and briefly show its correct position
        const unplacedPiece = this.pieces.find(p => !p.isPlaced);
        if (!unplacedPiece) return;
        
        const ctx = this.ctx;
        
        // Draw hint outline at correct position
        ctx.save();
        
        // Create a temporary piece at the correct position for drawing
        const hintPiece = { ...unplacedPiece, x: unplacedPiece.correctX, y: unplacedPiece.correctY };
        
        this.drawPiecePath(ctx, hintPiece);
        ctx.strokeStyle = '#33db98'; // Vector Shamrock
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        
        // Draw arrow from piece to correct position
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(unplacedPiece.x + unplacedPiece.width / 2, unplacedPiece.y + unplacedPiece.height / 2);
        ctx.lineTo(unplacedPiece.correctX + unplacedPiece.width / 2, unplacedPiece.correctY + unplacedPiece.height / 2);
        ctx.stroke();
        
        ctx.restore();
        
        // Clear hint after 2 seconds
        setTimeout(() => {
            this.render();
        }, 2000);
    }
    
    startTimer() {
        this.stopTimer();
        this.timer = setInterval(() => {
            this.seconds++;
            this.updateStats();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateStats() {
        document.getElementById('timer').textContent = this.formatTime(this.seconds);
        document.getElementById('moves').textContent = this.moves;
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }
    
    showMenu() {
        this.stopTimer();
        this.isPlaying = false;
        this.showScreen('menuScreen');
        // Refresh stats display when returning to menu
        this.updateStatsDisplay();
    }
    
    showPreview() {
        document.getElementById('previewModal').classList.add('active');
    }
    
    hidePreview() {
        document.getElementById('previewModal').classList.remove('active');
    }
    
    restartGame() {
        if (this.currentImage) {
            this.startGame(this.currentImage.src);
        }
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new JigsawGame();
});
