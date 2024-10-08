// Define Ingredients with SVG File Paths
const INGREDIENTS = {
    BOTTOM_BUN: 'images/ibunb.svg', // bun bottom
    TOP_BUN: 'images/ibunt.svg',    // bun top
    PATTY: 'images/ipat.svg',       // patty
    LETTUCE: 'images/ilet.svg',     // lettuce
    CHEESE: 'images/iche.svg',      // cheese
    TOMATO: 'images/itom.svg',      // tomato
    ONION: 'images/ioni.svg',       // onion
    PICKLE: 'images/ipik.svg'       // pickle
};

// Mapping of Ingredients to Image Filenames (for the active burger)
const INGREDIENT_IMAGES = {
    BOTTOM_BUN: 'images/bottom.png',
    TOP_BUN: 'images/top.png',
    PATTY: 'images/pat.png',
    LETTUCE: 'images/lett.png',
    CHEESE: 'images/che.png',
    TOMATO: 'images/tom.png',
    ONION: 'images/oni.png',
    ONION2: 'images/oni2.png',
    PICKLE: 'images/pic.png'
};

// Level progression ingredients
const LEVEL_INGREDIENTS = {
    1: ['PATTY'],
    2: ['PATTY', 'LETTUCE'],
    3: ['PATTY', 'LETTUCE', 'CHEESE'],
    4: ['PATTY', 'LETTUCE', 'CHEESE', 'TOMATO'],
    5: ['PATTY', 'LETTUCE', 'CHEESE', 'TOMATO', 'ONION'],
    6: ['PATTY', 'LETTUCE', 'CHEESE', 'TOMATO', 'ONION', 'PICKLE'],
    // You can add more levels if desired
};

// DOM Elements
const activeBurger = document.getElementById('active-burger');
const toast = document.getElementById('toast');
const pressProgressContainer = document.getElementById('press-progress-container');
const pressProgress = document.getElementById('press-progress');
const mistakeModal = document.getElementById('mistake-modal');
const closeButton = document.querySelector('.close-button');
const activeBurgerContainer = document.getElementById('active-burger-container');
const muteButton = document.getElementById('muteButton');
const levelIndicator = document.getElementById('level-indicator');
const strikesDisplay = document.getElementById('strikes-display');
const clickInstruction = document.getElementById('click-instruction');

// Audio context
let audioContext;
let isMuted = false;

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Function to play a tone
function playTone(frequency, duration) {
    if (!audioContext) initAudio();
    if (isMuted) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

// Play place sound
function playPlaceSound() {
    playTone(440, 0.1); // A4 note, 100ms duration
}

// Play complete sound
function playCompleteSound() {
    setTimeout(() => playTone(523.25, 0.1), 0);    // C5 note
    setTimeout(() => playTone(659.25, 0.1), 100); // E5 note
    setTimeout(() => playTone(783.99, 0.2), 200); // G5 note, longer duration
}

// Game State
let ordersQueue = [];
let currentOrder = [];
let userProgress = [];
let currentLevel = 1;
let strikes = 0;

// Interaction Variables
let clickCount = 0;
let clickTimer = null;
let longPress = false;
let longPressTimer = null;
let pressStartTime = null;
let progressInterval = null;
let isLongPressHandled = false;
let awaitingTomatoLongPress = false;
let awaitingPickleLongPress = false;
let onionStage = 0; // 0: no onion, 1: first onion, 2: second onion
let pickleStage = 0; // 0: no pickle, 1: first tap, 2: second tap
let isLongPressing = false;
let pressProgressInterval = null;
let lastLongPressEnd = 0;
let actionProcessed = false;
const LONG_PRESS_THRESHOLD = 300; // Reduced from 500ms to 300ms
const TAP_DELAY_AFTER_LONG_PRESS = 300; // milliseconds

// Initialize the Game
function initGame() {
    initAudio();
    generateOrders();
    displayOrders();
    loadCurrentOrder();
    updateLevelIndicator();
    updateStrikesDisplay();
    setupInteractionHandlers();
    showClickInstruction(); // Show instruction overlay on game start
}

// Utility function to shuffle an array (Fisher-Yates Shuffle)
function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

// Generate Random Orders based on current level
function generateOrders() {
    ordersQueue = []; // Reset queue
    const numberOfBurgers = 2; // Starting with 2 orders per level
    for (let i = 0; i < numberOfBurgers; i++) {
        ordersQueue.push(generateSingleOrder());
    }
}

// Generate a single order
function generateSingleOrder() {
    let order = ['BOTTOM_BUN']; // Always start with bottom bun

    // Get the ingredients for the current level
    let ingredientsForLevel = LEVEL_INGREDIENTS[currentLevel];

    if (!ingredientsForLevel) {
        // If currentLevel exceeds defined levels, use the maximum level ingredients
        ingredientsForLevel = LEVEL_INGREDIENTS[6];
    }

    // The patty is always included and should be after the bottom bun
    order.push('PATTY');

    // Get optional ingredients (excluding 'PATTY')
    let optionalIngredients = ingredientsForLevel.slice(1); // Exclude 'PATTY'

    // Shuffle the optional ingredients to randomize their order
    optionalIngredients = shuffle(optionalIngredients);

    // Add optional ingredients to the order
    order = [...order, ...optionalIngredients];

    // Add top bun
    order.push('TOP_BUN');

    return order;
}

// Display Orders in the Runner (only show 'Now' and 'Next')
function displayOrders() {
    const nowOrderContent = document.querySelector('.order-row.now .order-content');
    const nextOrderContent = document.querySelector('.order-row.next .order-content');
    
    nowOrderContent.innerHTML = '';
    nextOrderContent.innerHTML = '';

    if (ordersQueue.length > 0) {
        populateOrderContent(nowOrderContent, ordersQueue[0]); // Current order (Now)
    }
    if (ordersQueue.length > 1) {
        populateOrderContent(nextOrderContent, ordersQueue[1]); // Next order in line
    } else if (ordersQueue.length === 1) {
        nextOrderContent.textContent = 'Last One!';
        nextOrderContent.classList.add('last-one');
    } else {
        nextOrderContent.textContent = '';
        nextOrderContent.classList.remove('last-one');
    }
}

// Populate order content with SVG images
function populateOrderContent(contentElement, order) {
    contentElement.innerHTML = ''; // Clear existing content
    order.forEach(ingredient => {
        const img = document.createElement('img');
        img.src = INGREDIENTS[ingredient];
        img.alt = ingredient.replace('_', ' '); // e.g., 'BOTTOM BUN'
        img.classList.add('burger-emoticon');
        contentElement.appendChild(img);
    });
}

// Load the Current Order
function loadCurrentOrder() {
    if (ordersQueue.length === 0) {
        showToast('🎉 Congratulations! You have completed all orders.', 'success');
        return;
    }
    currentOrder = ordersQueue[0];
    userProgress = [];
    onionStage = 0; // Reset onionStage here
    pickleStage = 0; // Reset pickleStage here
    renderActiveBurger();
    displayOrders();
}

// Render the Active Burger with Images
function renderActiveBurger() {
    activeBurger.innerHTML = '';
    userProgress.forEach((ingredient, index) => {
        let layer;
        if (ingredient === 'ONION') {
            layer = createIngredientLayer(onionStage === 2 ? 'ONION2' : 'ONION', index);
        } else {
            layer = createIngredientLayer(ingredient, index);
        }
        activeBurger.appendChild(layer);
        // Trigger reflow to ensure animation plays for each new element
        void layer.offsetWidth;
        layer.style.animation = 'none';
        layer.style.animation = null;
    });
}

// Create a Visual Layer for an Ingredient (Main Burger) with Image
function createIngredientLayer(ingredient, index) {
    const img = document.createElement('img');
    img.src = INGREDIENT_IMAGES[ingredient];
    img.alt = ingredient;
    img.classList.add('burger-image');
    img.style.animationDelay = `${index * 0.1}s`;
    return img;
}

// Event handling functions
function handlePressStart(e) {
    e.preventDefault();
    const nextIngredient = currentOrder[userProgress.length];

    if (
        nextIngredient === 'LETTUCE' ||
        nextIngredient === 'ONION' ||
        (nextIngredient === 'TOMATO' && awaitingTomatoLongPress) ||
        (nextIngredient === 'PICKLE' && awaitingPickleLongPress)
    ) {
        isLongPressing = true;
        pressStartTime = Date.now();
        showPressProgress(
            nextIngredient === 'TOMATO',
            nextIngredient === 'ONION',
            nextIngredient === 'PICKLE'
        );
        startProgressAnimation(nextIngredient);
        actionProcessed = false; // Reset the flag at the start of press
    }
}

function handlePressEnd(e) {
    e.preventDefault();
    const nextIngredient = currentOrder[userProgress.length];

    if (isLongPressing) {
        isLongPressing = false;
        stopProgressAnimation();

        if (!actionProcessed) { // Only process if not already processed
            const pressDuration = Date.now() - pressStartTime;
            if (pressDuration >= LONG_PRESS_THRESHOLD) {
                lastLongPressEnd = Date.now();
                if (nextIngredient === 'LETTUCE') {
                    processIngredient('LETTUCE');
                } else if (nextIngredient === 'TOMATO' && awaitingTomatoLongPress) {
                    processIngredient('TOMATO');
                    awaitingTomatoLongPress = false;
                } else if (nextIngredient === 'ONION') {
                    processOnion();
                } else if (nextIngredient === 'PICKLE' && awaitingPickleLongPress) {
                    processIngredient('PICKLE');
                    awaitingPickleLongPress = false;
                    pickleStage = 0;
                }
            } else {
                if (nextIngredient === 'TOMATO' && awaitingTomatoLongPress) {
                    awaitingTomatoLongPress = false;
                    registerStrike();
                    showMistakeAlert('TOMATO');
                }
                if (nextIngredient === 'PICKLE' && awaitingPickleLongPress) {
                    awaitingPickleLongPress = false;
                    pickleStage = 0;
                    registerStrike();
                    showMistakeAlert('PICKLE');
                }
            }
        }
    }
    hidePressProgress();
}

/**
 * Function to handle automatic processing when progress completes
 * and trigger the subtle tap effect.
 */
function processActionAutomatically(ingredient) {
    if (actionProcessed) return; // Prevent duplicate processing
    actionProcessed = true; // Set the flag to prevent further processing in this press

    lastLongPressEnd = Date.now();
    if (ingredient === 'LETTUCE') {
        processIngredient('LETTUCE');
    } else if (ingredient === 'TOMATO' && awaitingTomatoLongPress) {
        processIngredient('TOMATO');
        awaitingTomatoLongPress = false;
    } else if (ingredient === 'ONION') {
        processOnion();
    } else if (ingredient === 'PICKLE' && awaitingPickleLongPress) {
        processIngredient('PICKLE');
        awaitingPickleLongPress = false;
        pickleStage = 0;
    }

    // Trigger the subtle tap effect on the active burger container
    triggerTapEffect(activeBurgerContainer);
}

function handleTomatoTap() {
    if (!awaitingTomatoLongPress) {
        awaitingTomatoLongPress = true;
    } else {
        registerStrike();
        showMistakeAlert('TOMATO');
        awaitingTomatoLongPress = false;
    }
}

function handlePickleTap() {
    pickleStage++;
    if (pickleStage === 1) {
        // First tap
    } else if (pickleStage === 2) {
        awaitingPickleLongPress = true;
    } else {
        registerStrike();
        showMistakeAlert('PICKLE');
        pickleStage = 0;
        awaitingPickleLongPress = false;
    }
}

function startProgressAnimation(ingredient) {
    pressStartTime = Date.now();
    let progress = 0;
    pressProgressInterval = setInterval(() => {
        progress = Math.min((Date.now() - pressStartTime) / 200, 1);  // Use updated threshold
        updatePressProgress(progress, ingredient);
        if (progress >= 1) {
            stopProgressAnimation();
            processActionAutomatically(ingredient); // Automatically process action and trigger tap effect
        }
    }, 16); // ~60fps
}

function stopProgressAnimation() {
    if (pressProgressInterval) {
        clearInterval(pressProgressInterval);
        pressProgressInterval = null;
    }
}

function showPressProgress(isTomato = false, isOnion = false, isPickle = false) {
    pressProgressContainer.style.display = 'flex';
    pressProgress.style.background = 'conic-gradient(var(--secondary-color) 0deg, transparent 0deg)';
    pressProgress.classList.remove('tomato', 'onion', 'pickle');

    if (isTomato) {
        pressProgress.classList.add('tomato');
    }
    if (isOnion) {
        pressProgress.classList.add('onion');
    }
    if (isPickle) {
        pressProgress.classList.add('pickle');
    }
}

function updatePressProgress(progress, ingredient) {
    const degrees = progress * 360;
    let color = 'var(--secondary-color)';
    if (ingredient === 'TOMATO') {
        color = '#ff6347';
    } else if (ingredient === 'ONION') {
        color = '#FFFFFF';
    } else if (ingredient === 'PICKLE') {
        color = '#4CAF50';
    }
    pressProgress.style.background = `conic-gradient(${color} ${degrees}deg, transparent ${degrees}deg)`;
}

function hidePressProgress() {
    pressProgressContainer.style.display = 'none';
}

// Setup event listeners
function setupInteractionHandlers() {
    const container = document.getElementById('active-burger-container');

    // For touch devices
    container.addEventListener('touchstart', handlePressStart, { passive: false });
    container.addEventListener('touchend', handlePressEnd, { passive: false });

    // For mouse devices
    container.addEventListener('mousedown', handlePressStart);
    container.addEventListener('mouseup', handlePressEnd);

    // Click listener for building the burger
    container.addEventListener('click', (e) => {
        // Prevent immediate taps after a long press
        if (Date.now() - lastLongPressEnd >= TAP_DELAY_AFTER_LONG_PRESS) {
            handleTap(e);
        }
    });

    // Use event delegation to handle clicks on instruction examples
    const instructionExamples = document.querySelectorAll('.instruction-example');
    instructionExamples.forEach(example => {
        example.addEventListener('click', handleTap);
    });

    // Mute Button
    muteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the click from bubbling up to the active burger container
        toggleMute();
    });

    // Close Mistake Modal when clicking outside the content or on close button
    if (mistakeModal) {
        mistakeModal.addEventListener('click', (e) => {
            if (e.target === mistakeModal || e.target.classList.contains('close-button')) {
                mistakeModal.style.display = 'none';
            }
        });
    } else {
        console.error('Mistake modal element not found');
    }

    // Keyboard Accessibility: Space Bar and Enter Key
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault(); // Prevent default actions like scrolling
            handleKeyboardTap(e);
        }
    });
}

/**
 * Toggle the mute state and update the mute button icon accordingly.
 */
function toggleMute() {
    isMuted = !isMuted;
    muteButton.textContent = isMuted ? '🔇' : '🔊';
}

/**
 * Triggers the tap effect on a specified element.
 * @param {HTMLElement} element - The DOM element to apply the tap effect to.
 */
function triggerTapEffect(element) {
    if (!element) return;

    // Remove the class if it's already present to allow re-triggering
    element.classList.remove('tap-effect-opacity');

    // Trigger reflow to reset the animation
    void element.offsetWidth;

    // Apply the subtle opacity fade tap effect
    element.classList.add('tap-effect-opacity');

    // Remove the tap-effect class after the animation duration
    setTimeout(() => {
        element.classList.remove('tap-effect-opacity');
    }, 100); // Match with CSS animation duration
}

// Handle Clicks and Taps
function handleTap(e) {
    e.preventDefault();

    // Identify the element that was tapped
    const tappedElement = e.target.closest('.order-row, #active-burger-container, .instruction-example, #muteButton');

    // If the mute button was clicked, do not proceed further
    if (tappedElement && tappedElement.id === 'muteButton') {
        return;
    }

    // Trigger the tap effect on the tapped element
    triggerTapEffect(tappedElement);

    // Hide the instruction overlay after the first interaction
    if (tappedElement && tappedElement.id === 'active-burger-container') {
        hideClickInstruction();
    }

    // Proceed with existing tap handling logic
    // Ignore taps immediately after a long press
    if (Date.now() - lastLongPressEnd < TAP_DELAY_AFTER_LONG_PRESS) {
        return;
    }

    const nextIngredient = currentOrder[userProgress.length];

    switch (nextIngredient) {
        case 'PATTY':
            processIngredient('PATTY');
            break;
        case 'CHEESE':
            handleCheeseInput();
            break;
        case 'BOTTOM_BUN':
        case 'TOP_BUN':
            handleBunInput();
            break;
        case 'TOMATO':
            handleTomatoTap();
            break;
        case 'PICKLE':
            handlePickleTap();
            break;
        case 'LETTUCE':
        case 'ONION':
            // Do nothing, these are handled by long press
            registerStrike();
            showMistakeAlert(nextIngredient);
            break;
        default:
            registerStrike();
            showMistakeAlert(nextIngredient);
    }
}

// Handle Keyboard Taps
function handleKeyboardTap(e) {
    // Simulate a click/tap on the active burger container
    const container = document.getElementById('active-burger-container');
    if (container) {
        container.click();
    }
}

function handleCheeseInput() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        if (clickCount === 3) {
            processIngredient('CHEESE');
        } else {
            registerStrike();
            showMistakeAlert('CHEESE');
        }
        clickCount = 0;
    }, 300);
}

function handleBunInput() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        if (clickCount === 2) {
            processIngredient(currentOrder[userProgress.length]);
        } else {
            registerStrike();
            showMistakeAlert(currentOrder[userProgress.length]);
        }
        clickCount = 0;
    }, 300);
}

function processOnion() {
    onionStage++;
    if (onionStage === 1) {
        renderOnionLayer('ONION');
    } else if (onionStage === 2) {
        replaceOnionLayer();
        processIngredient('ONION');
    }
}

function renderOnionLayer(ingredient) {
    const layer = createIngredientLayer(ingredient, userProgress.length);
    activeBurger.appendChild(layer);
    playPlaceSound();
}

function replaceOnionLayer() {
    const onionLayers = activeBurger.querySelectorAll('img[src="images/oni.png"]');
    if (onionLayers.length > 0) {
        const lastOnionLayer = onionLayers[onionLayers.length - 1];
        lastOnionLayer.src = 'images/oni2.png';
    }
}

// Process the Added Ingredient
function processIngredient(ingredient) {
    const expectedIngredient = currentOrder[userProgress.length];
    if (ingredient === expectedIngredient) {
        userProgress.push(ingredient);
        renderActiveBurger();
        playPlaceSound(); // Play sound when ingredient is placed correctly
        checkCompletion();
    } else {
        registerStrike();
        showMistakeAlert(expectedIngredient);
    }
}

// Check if the Burger is Complete
function checkCompletion() {
    if (userProgress.length === currentOrder.length) {
        activeBurgerContainerAnimation();
        playCompleteSound(); // Play completion sound
        createShootingStars(); // Add shooting stars effect
        showToast(`✅ Order completed!`, 'success');
        setTimeout(() => {
            ordersQueue.shift(); // Remove the completed order
            if (ordersQueue.length === 0) {
                advanceLevel();
            } else {
                displayOrders(); // Update to show next in line
                loadCurrentOrder();
            }
        }, 1500);
    }
}

// Completion Animation Function
function activeBurgerContainerAnimation() {
    activeBurgerContainer.classList.add('burger-completed');
    setTimeout(() => {
        activeBurgerContainer.classList.remove('burger-completed');
    }, 300); // Adjusted to match new animation duration
}

// Reset the Current Burger to a Blank State
function resetCurrentBurger() {
    userProgress = [];
    onionStage = 0; // Reset onionStage when resetting
    pickleStage = 0; // Reset pickleStage when resetting
    renderActiveBurger();
}

// Show Toast Notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    switch (type) {
        case 'success':
            toast.style.backgroundColor = 'rgba(76, 175, 80, 0.9)'; // Green
            break;
        case 'error':
            toast.style.backgroundColor = 'rgba(244, 67, 54, 0.9)'; // Red
            break;
        case 'info':
        default:
            toast.style.backgroundColor = 'rgba(33, 150, 243, 0.9)'; // Blue
            break;
    }
    toast.classList.remove('show');
    void toast.offsetWidth; // Trigger reflow
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show Mistake Alert Modal
function showMistakeAlert(ingredient) {
    if (!mistakeModal) {
        console.error('Mistake modal element not found');
        return;
    }

    mistakeModal.style.display = 'block';
    const modalContent = mistakeModal.querySelector('.modal-content');
    const mistakeMessage = document.getElementById('mistake-message');

    if (!modalContent || !mistakeMessage) {
        console.error('Modal content or message element not found');
        return;
    }

    let message = '';
    switch (ingredient) {
        case 'BOTTOM_BUN':
        case 'TOP_BUN':
            message = '🍞 Bun: Double Tap';
            break;
        case 'PATTY':
            message = '🥩 Patty: Single Tap';
            break;
        case 'LETTUCE':
            message = '🥬 Lettuce: Long Tap';
            break;
        case 'CHEESE':
            message = '🧀 Cheese: Triple Tap';
            break;
        case 'TOMATO':
            message = '🍅 Tomato: Single Tap + Long Tap';
            break;
        case 'ONION':
            message = '🧅 Onion: Two Long Taps';
            break;
        case 'PICKLE':
            message = '🥒 Pickle: Two Short Taps + Long Tap';
            break;
        default:
            message = 'Try again!';
    }

    if (strikes === 3) {
        mistakeMessage.textContent = `Game Over!\nYou have ${strikes} strike(s).\n${message}`;
    } else {
        mistakeMessage.textContent = `You have ${strikes} strike(s).\n${message}`;
    }

    // Re-trigger the animation
    modalContent.style.animation = 'subtleBounce 0.5s ease-out';

    // Reset burger after showing mistake
    resetCurrentBurger();
}

// Advance to the Next Level
function advanceLevel() {
    if (currentLevel < Object.keys(LEVEL_INGREDIENTS).length) {
        currentLevel++;
        showToast(`🎉 Level ${currentLevel} Achieved!`, 'success');
        animateLevelIndicator();
        updateLevelIndicator();
        generateOrders();
        displayOrders();
        loadCurrentOrder();
        showClickInstruction(); // Show instruction overlay for the new level
    } else {
        // Maximum level reached
        showToast(`🎉 You have completed all levels!`, 'success');
        // You can add additional functionality here if desired
    }
}

// Update Level Indicator
function updateLevelIndicator() {
    if (levelIndicator) {
        levelIndicator.textContent = `Level: ${currentLevel}`;
    } else {
        console.error('Level indicator element not found');
    }
}

// Animate Level Indicator
function animateLevelIndicator() {
    if (!levelIndicator) return;

    levelIndicator.classList.add('level-up');

    levelIndicator.addEventListener('animationend', function handleAnimationEnd() {
        levelIndicator.classList.remove('level-up');
        levelIndicator.removeEventListener('animationend', handleAnimationEnd);
    });
}

// Register a Strike
function registerStrike() {
    strikes++;
    updateStrikesDisplay();

    if (strikes === 1) {
        showToast(`⚠️ Strike 1: Restarting current burger.`, 'error');
        resetCurrentBurger();
    } else if (strikes === 2) {
        showToast(`⚠️ Strike 2: Restarting level.`, 'error');
        resetLevel();
    } else if (strikes >= 3) {
        showToast(`❌ Strike 3: Restarting game.`, 'error');
        resetGame();
    }
}

// Update Strikes Display
function updateStrikesDisplay() {
    if (!strikesDisplay) {
        console.error('Strikes display element not found');
        return;
    }

    strikesDisplay.innerHTML = ''; // Clear existing strikes

    for (let i = 0; i < 3; i++) {
        const strike = document.createElement('span');
        strike.classList.add('strike');
        if (i < strikes) {
            strike.textContent = '❌';
            strike.classList.add('active-strike');
        } else {
            strike.textContent = '⭕';
            strike.classList.add('inactive-strike');
        }
        strikesDisplay.appendChild(strike);
    }
}

// Reset Current Level
function resetLevel() {
    showToast(`🔄 Level ${currentLevel} Restarted.`, 'info');
    // Do not reset strikes here
    generateOrders();
    displayOrders();
    loadCurrentOrder();
    showClickInstruction(); // Show instruction overlay after level reset
}

// Reset Entire Game
function resetGame() {
    showToast(`🔁 Game Restarted from Level 1.`, 'info');
    currentLevel = 1;
    strikes = 0;
    updateLevelIndicator();
    updateStrikesDisplay();
    generateOrders();
    displayOrders();
    loadCurrentOrder();
    showClickInstruction(); // Show instruction overlay after game reset
}

// Show Click Instruction Overlay
function showClickInstruction() {
    if (clickInstruction) {
        clickInstruction.style.display = 'flex';
    }
}

// Hide Click Instruction Overlay
function hideClickInstruction() {
    if (clickInstruction) {
        clickInstruction.style.opacity = '0';
        setTimeout(() => {
            clickInstruction.style.display = 'none';
            clickInstruction.style.opacity = '1'; // Reset opacity for future use
        }, 500); // Match with CSS transition duration if any
    }
}

// Shooting Stars Effect
function createShootingStars() {
    const numberOfStars = 5; // Adjust number of shooting stars as desired
    for (let i = 0; i < numberOfStars; i++) {
        const star = document.createElement('div');
        star.classList.add('star');

        // Calculate the center position of the burger container
        const containerRect = activeBurgerContainer.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;

        // Set initial position to the center of the burger container
        star.style.left = `${centerX}px`;
        star.style.top = `${centerY}px`;

        // Random movement direction
        const tx = Math.random() * 100 - 50; // Reduced movement range for shorter animation
        const ty = Math.random() * 100 - 50; // Reduced movement range for shorter animation

        // Set CSS variables for animation
        star.style.setProperty('--tx', `${tx}px`);
        star.style.setProperty('--ty', `${ty}px`);

        // Random delay to stagger the shooting stars
        star.style.animationDelay = `${Math.random() * 0.6}s`; // Reduced delay

        // Append the star to the burger container
        activeBurgerContainer.appendChild(star);

        // Remove the star after animation completes
        star.addEventListener('animationend', () => {
            star.remove();
        });
    }
}

// Initialize the Game on Page Load
window.onload = initGame;

// Ensure all functions and code blocks are properly closed
