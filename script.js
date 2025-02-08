class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
        this.faceUp = false;
        this.element = this.createCardElement();
    }

    createCardElement() {
        const card = document.createElement('div');
        card.className = 'card back';
        card.draggable = true;
        
        const content = document.createElement('div');
        content.className = 'content';
        
        const corner = document.createElement('div');
        corner.className = 'corner';
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'value';
        valueSpan.textContent = this.getDisplayValue();
        
        const suitSpan = document.createElement('span');
        suitSpan.className = 'suit';
        suitSpan.textContent = this.getSuitSymbol();
        
        corner.appendChild(valueSpan);
        corner.appendChild(suitSpan);
        content.appendChild(corner);
        card.appendChild(content);
        
        card.dataset.suit = this.suit;
        card.dataset.value = this.value;
        
        if (['hearts', 'diamonds'].includes(this.suit)) {
            card.classList.add('red');
        } else {
            card.classList.add('black');
        }
        
        return card;
    }

    getDisplayValue() {
        const valueMap = {
            1: 'A',
            11: 'J',
            12: 'Q',
            13: 'K'
        };
        return valueMap[this.value] || this.value.toString();
    }

    getSuitSymbol() {
        const suitMap = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        return suitMap[this.suit];
    }

    flip() {
        this.faceUp = !this.faceUp;
        this.element.classList.toggle('back');
    }
}

class Solitaire {
    constructor() {
        this.deck = [];
        this.waste = [];
        this.foundations = {
            'hearts': [],
            'diamonds': [],
            'clubs': [],
            'spades': []
        };
        this.tableau = Array(7).fill().map(() => []);
        this.moveHistory = [];
        this.points = 0;
        this.highScore = parseInt(localStorage.getItem('solitaireHighScore')) || 0;
        this.missions = [];
        this.initializeMissions();
        
        // Try to load saved game state
        if (this.loadGameState()) {
            this.setupEventListeners();
            this.updatePointsDisplay();
            this.startMissionTimer();
            this.setupPanels();
        } else {
            this.initializeGame();
            this.setupEventListeners();
            this.updatePointsDisplay();
            this.startMissionTimer();
            this.setupPanels();
        }

        // Save game state when page is closed or refreshed
        window.addEventListener('beforeunload', () => {
            this.saveGameState();
        });

        // Auto-save every 30 seconds
        setInterval(() => {
            this.saveGameState();
        }, 30000);
    }

    addPoints(amount, reason) {
        this.points += amount;
        this.updatePointsDisplay();
        
        // Show animation for points gained
        const pointsDisplay = document.getElementById('points-display');
        pointsDisplay.classList.remove('points-animation');
        void pointsDisplay.offsetWidth; // Trigger reflow
        pointsDisplay.classList.add('points-animation');
        
        // Update high score if necessary
        if (this.points > this.highScore) {
            this.highScore = this.points;
            localStorage.setItem('solitaireHighScore', this.highScore);
            document.getElementById('high-score-display').textContent = this.highScore;
        }
    }

    updatePointsDisplay() {
        document.getElementById('points-display').textContent = this.points;
        document.getElementById('high-score-display').textContent = this.highScore;
    }

    initializeGame() {
        // Create deck
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        for (let suit of suits) {
            for (let value = 1; value <= 13; value++) {
                this.deck.push(new Card(suit, value));
            }
        }

        // Shuffle deck
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }

        // Deal cards to tableau
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                const card = this.deck.pop();
                this.tableau[j].push(card);
                if (i === j) {
                    card.flip();
                }
            }
        }

        this.renderGame();
    }

    setupEventListeners() {
        // Deck click
        document.getElementById('deck').addEventListener('click', () => {
            if (this.deck.length === 0) {
                while (this.waste.length > 0) {
                    const card = this.waste.pop();
                    card.flip();
                    this.deck.push(card);
                }
            } else {
                const card = this.deck.pop();
                card.flip();
                this.waste.push(card);
            }
            this.renderGame();
        });

        // Drag and drop functionality
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('card') && !e.target.classList.contains('back')) {
                e.target.classList.add('dragging');
                const cardData = {
                    suit: e.target.dataset.suit,
                    value: parseInt(e.target.dataset.value)
                };
                
                // Find all cards that are being dragged (the card and all cards on top of it)
                const draggedCards = this.findStackFromCard(cardData);
                e.dataTransfer.setData('text/plain', JSON.stringify(draggedCards));
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.classList.remove('dragging');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.tableau-pile, .foundation');
            if (target) {
                target.classList.add('can-drop');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.tableau-pile, .foundation');
            if (target) {
                target.classList.remove('can-drop');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.tableau-pile, .foundation');
            if (target) {
                target.classList.remove('can-drop');
            }

            try {
                const draggedCards = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (!Array.isArray(draggedCards) || draggedCards.length === 0) return;

                const firstCard = this.findCard(draggedCards[0].suit, draggedCards[0].value);
                if (!firstCard) return;

                if (target) {
                    if (target.classList.contains('foundation')) {
                        // Only allow single cards to be moved to foundation
                        if (draggedCards.length === 1) {
                            this.tryMoveToFoundation(firstCard, target.dataset.suit);
                        }
                    } else if (target.classList.contains('tableau-pile')) {
                        this.tryMoveToTableau(firstCard, parseInt(target.id.split('-')[1]));
                    }
                }
                
                this.renderGame();
                this.checkWinCondition();
            } catch (error) {
                console.error('Error during drop:', error);
            }
        });
    }

    findStackFromCard(cardData) {
        // Find the pile and index where the card is
        for (let pileIndex = 0; pileIndex < this.tableau.length; pileIndex++) {
            const pile = this.tableau[pileIndex];
            const cardIndex = pile.findIndex(c => c.suit === cardData.suit && c.value === cardData.value);
            
            if (cardIndex !== -1) {
                // Return the card and all cards on top of it
                return pile.slice(cardIndex).map(card => ({
                    suit: card.suit,
                    value: card.value
                }));
            }
        }
        
        // If not found in tableau, it must be a single card from waste or foundation
        return [{suit: cardData.suit, value: cardData.value}];
    }

    findCard(suit, value) {
        // Search in waste
        const wasteCard = this.waste.find(c => c.suit === suit && c.value === value);
        if (wasteCard) return wasteCard;

        // Search in tableau
        for (let pile of this.tableau) {
            const tableauCard = pile.find(c => c.suit === suit && c.value === value);
            if (tableauCard) return tableauCard;
        }

        return null;
    }

    tryMoveToFoundation(card, foundationSuit) {
        const foundation = this.foundations[foundationSuit];
        if (card.suit === foundationSuit) {
            if ((foundation.length === 0 && card.value === 1) ||
                (foundation.length > 0 && card.value === foundation[foundation.length - 1].value + 1)) {
                this.removeCardFromCurrent(card);
                foundation.push(card);
                // Points for moving to foundation
                this.addPoints(10, 'Move to foundation');
                this.updateMissionProgress('foundation_move');
                return true;
            }
        }
        return false;
    }

    tryMoveToTableau(card, tableauIndex) {
        const pile = this.tableau[tableauIndex];
        if (pile.length === 0) {
            if (card.value === 13) { // Only Kings can be placed on empty spots
                this.removeCardFromCurrent(card);
                pile.push(card);
                // Points for moving a king to empty space
                this.addPoints(5, 'King to empty space');
                this.updateMissionProgress('king_move');
                return true;
            }
        } else {
            const topCard = pile[pile.length - 1];
            if (this.isAlternatingColor(card, topCard) && card.value === topCard.value - 1) {
                this.removeCardFromCurrent(card);
                pile.push(card);
                // Points for successful tableau move
                this.addPoints(2, 'Tableau move');
                this.updateMissionProgress('tableau_move');
                return true;
            }
        }
        return false;
    }

    removeCardFromCurrent(card) {
        // Remove from waste
        const wasteIndex = this.waste.indexOf(card);
        if (wasteIndex !== -1) {
            this.waste.splice(wasteIndex, 1);
            return;
        }

        // Remove from tableau
        for (let pile of this.tableau) {
            const index = pile.indexOf(card);
            if (index !== -1) {
                // Remove the card and all cards on top of it
                const cardsToMove = pile.splice(index);
                // Return all cards except the first one (the one we're moving)
                pile.push(...cardsToMove.slice(1));
                if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                    pile[pile.length - 1].flip();
                    this.updateMissionProgress('reveal_card');
                }
                return;
            }
        }
        
        // If we reveal a card by removing one, award points
        for (let pile of this.tableau) {
            if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                pile[pile.length - 1].flip();
                this.addPoints(5, 'Reveal card');
                this.updateMissionProgress('reveal_card');
                break;
            }
        }
    }

    isAlternatingColor(card1, card2) {
        const redSuits = ['hearts', 'diamonds'];
        const card1IsRed = redSuits.includes(card1.suit);
        const card2IsRed = redSuits.includes(card2.suit);
        return card1IsRed !== card2IsRed;
    }

    renderGame() {
        // Render deck
        const deckElement = document.getElementById('deck');
        deckElement.innerHTML = '';
        if (this.deck.length > 0) {
            const topCard = this.deck[this.deck.length - 1];
            deckElement.appendChild(topCard.element);
        }

        // Render waste
        const wasteElement = document.getElementById('waste');
        wasteElement.innerHTML = '';
        if (this.waste.length > 0) {
            const topCard = this.waste[this.waste.length - 1];
            wasteElement.appendChild(topCard.element);
        }

        // Update progress bar
        this.updateProgress();

        // Render foundations
        for (let suit in this.foundations) {
            const foundation = document.querySelector(`.foundation[data-suit="${suit}"]`);
            foundation.innerHTML = '';
            if (this.foundations[suit].length > 0) {
                const topCard = this.foundations[suit][this.foundations[suit].length - 1];
                foundation.appendChild(topCard.element);
            }
        }

        // Render tableau
        for (let i = 0; i < 7; i++) {
            const tableauPile = document.getElementById(`tableau-${i}`);
            tableauPile.innerHTML = '';
            
            // Calculate the maximum height available
            const maxHeight = window.innerHeight - 300; // Leave space for other elements
            const cardHeight = 140; // Height of a card
            const minSpacing = 20; // Minimum spacing between cards
            
            // Calculate the spacing based on the number of cards
            const numCards = this.tableau[i].length;
            let spacing = minSpacing;
            if (numCards > 1) {
                const availableSpace = maxHeight - cardHeight;
                spacing = Math.max(minSpacing, Math.min(30, availableSpace / (numCards - 1)));
            }
            
            this.tableau[i].forEach((card, index) => {
                card.element.style.top = `${index * spacing}px`;
                card.element.style.zIndex = index;
                tableauPile.appendChild(card.element);
            });
        }
        
        this.checkStuckState();
    }

    updateProgress() {
        const totalCards = 52;
        const cardsInFoundation = Object.values(this.foundations)
            .reduce((sum, pile) => sum + pile.length, 0);
        
        const progress = Math.round((cardsInFoundation / totalCards) * 100);
        
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        
        // Add color transitions based on progress
        if (progress < 25) {
            progressBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ff5252)';
        } else if (progress < 50) {
            progressBar.style.background = 'linear-gradient(90deg, #ffd93d, #ffc107)';
        } else if (progress < 75) {
            progressBar.style.background = 'linear-gradient(90deg, #6bff6b, #52ff52)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        }
    }

    checkWinCondition() {
        const isWon = Object.values(this.foundations).every(pile => pile.length === 13);
        if (isWon) {
            this.updateMissionProgress('win_game');
            // Bonus points for winning
            this.addPoints(100, 'Game won!');
            document.getElementById('win-message').style.display = 'block';
        }
    }

    checkAvailableMoves() {
        // Check moves from waste
        if (this.waste.length > 0) {
            const topWasteCard = this.waste[this.waste.length - 1];
            if (this.canMoveToFoundation(topWasteCard) || this.canMoveToTableau(topWasteCard)) {
                return true;
            }
        }

        // Check moves from tableau
        for (let i = 0; i < this.tableau.length; i++) {
            const pile = this.tableau[i];
            if (pile.length === 0) continue;

            for (let j = pile.length - 1; j >= 0; j--) {
                const card = pile[j];
                if (!card.faceUp) continue;

                if (this.canMoveToFoundation(card) || this.canMoveToTableau(card, i)) {
                    return true;
                }
            }
        }

        // Check if we can flip any cards in tableau
        for (let pile of this.tableau) {
            if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
                return true;
            }
        }

        // Check if we can draw from deck
        if (this.deck.length > 0) {
            return true;
        }

        return false;
    }

    canMoveToFoundation(card) {
        const foundation = this.foundations[card.suit];
        return (foundation.length === 0 && card.value === 1) ||
               (foundation.length > 0 && card.value === foundation[foundation.length - 1].value + 1);
    }

    canMoveToTableau(card, currentPileIndex = -1) {
        for (let i = 0; i < this.tableau.length; i++) {
            if (i === currentPileIndex) continue;
            const pile = this.tableau[i];
            
            if (pile.length === 0) {
                if (card.value === 13) return true;
            } else {
                const topCard = pile[pile.length - 1];
                if (this.isAlternatingColor(card, topCard) && card.value === topCard.value - 1) {
                    return true;
                }
            }
        }
        return false;
    }

    getHint() {
        let hints = [];

        // Check waste card
        if (this.waste.length > 0) {
            const topWasteCard = this.waste[this.waste.length - 1];
            if (this.canMoveToFoundation(topWasteCard)) {
                hints.push(`Move ${topWasteCard.getDisplayValue()} of ${topWasteCard.suit} to foundation`);
            }
            
            if (this.canMoveToTableau(topWasteCard)) {
                hints.push(`Move ${topWasteCard.getDisplayValue()} of ${topWasteCard.suit} to tableau`);
            }
        }

        // Check tableau cards
        for (let i = 0; i < this.tableau.length; i++) {
            const pile = this.tableau[i];
            if (pile.length === 0) continue;

            const topCard = pile[pile.length - 1];
            if (!topCard.faceUp) continue;

            if (this.canMoveToFoundation(topCard)) {
                hints.push(`Move ${topCard.getDisplayValue()} of ${topCard.suit} from tableau ${i + 1} to foundation`);
            }

            if (this.canMoveToTableau(topCard, i)) {
                hints.push(`Move ${topCard.getDisplayValue()} of ${topCard.suit} from tableau ${i + 1} to another tableau pile`);
            }
        }

        if (hints.length === 0) {
            if (this.deck.length > 0) {
                hints.push("Draw a card from the deck");
            } else if (this.waste.length > 0) {
                hints.push("Reset the deck");
            } else {
                hints.push("No moves available. Consider starting a new game.");
            }
        }

        return hints[Math.floor(Math.random() * hints.length)];
    }

    checkStuckState() {
        if (!this.checkAvailableMoves()) {
            const hint = this.getHint();
            alert(`No more moves available!\n${hint}`);
        }
    }

    initializeMissions() {
        // Load saved missions or create new ones
        const savedMissions = localStorage.getItem('dailyMissions');
        const lastUpdate = localStorage.getItem('missionsLastUpdate');
        const now = new Date();
        
        if (savedMissions && lastUpdate && this.isSameDay(new Date(lastUpdate), now)) {
            this.missions = JSON.parse(savedMissions);
        } else {
            this.generateNewMissions();
            this.saveMissions();
        }
        
        this.renderMissions();
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    generateNewMissions() {
        const possibleMissions = [
            {
                id: 'foundation_cards',
                title: 'Foundation Builder',
                description: 'Move 10 cards to foundation piles',
                target: 10,
                progress: 0,
                reward: 50,
                type: 'foundation_move'
            },
            {
                id: 'reveal_cards',
                title: 'Card Revealer',
                description: 'Reveal 15 face-down cards',
                target: 15,
                progress: 0,
                reward: 40,
                type: 'reveal_card'
            },
            {
                id: 'kings_moved',
                title: 'King Placer',
                description: 'Move 3 kings to empty tableau spots',
                target: 3,
                progress: 0,
                reward: 30,
                type: 'king_move'
            },
            {
                id: 'tableau_moves',
                title: 'Tableau Master',
                description: 'Make 20 moves between tableau piles',
                target: 20,
                progress: 0,
                reward: 45,
                type: 'tableau_move'
            },
            {
                id: 'win_game',
                title: 'Victory Seeker',
                description: 'Win a game',
                target: 1,
                progress: 0,
                reward: 100,
                type: 'win_game'
            }
        ];

        // Randomly select 3 missions
        this.missions = this.shuffleArray(possibleMissions).slice(0, 3);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    saveMissions() {
        localStorage.setItem('dailyMissions', JSON.stringify(this.missions));
        localStorage.setItem('missionsLastUpdate', new Date().toISOString());
    }

    renderMissions() {
        const missionsList = document.getElementById('missions-list');
        missionsList.innerHTML = '';

        this.missions.forEach(mission => {
            const progress = Math.min(100, (mission.progress / mission.target) * 100);
            const missionElement = document.createElement('div');
            missionElement.className = `mission-item ${progress >= 100 ? 'completed' : ''}`;
            missionElement.innerHTML = `
                <div class="mission-title">${mission.title}</div>
                <div class="mission-description">${mission.description}</div>
                <div class="mission-progress">
                    <div class="mission-progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="mission-reward">+${mission.reward} pts</div>
            `;
            missionsList.appendChild(missionElement);
        });
    }

    updateMissionProgress(type) {
        let missionUpdated = false;
        this.missions.forEach(mission => {
            if (mission.type === type && mission.progress < mission.target) {
                mission.progress++;
                if (mission.progress === mission.target) {
                    this.addPoints(mission.reward, `Mission completed: ${mission.title}`);
                }
                missionUpdated = true;
            }
        });

        if (missionUpdated) {
            this.saveMissions();
            this.renderMissions();
        }
    }

    setupPanels() {
        // Setup for each panel (progress, points, missions)
        this.setupPanel('progress');
        this.setupPanel('points');
        this.setupPanel('missions');

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            const panels = ['progress', 'points', 'missions'];
            panels.forEach(panelType => {
                const panel = document.getElementById(`${panelType}-${panelType === 'missions' ? 'panel' : 'container'}`);
                const toggle = document.getElementById(`${panelType}-toggle`);
                
                if (!panel.contains(e.target) && 
                    !toggle.contains(e.target) && 
                    panel.classList.contains('visible')) {
                    this.hidePanel(panelType);
                }
            });
        });
    }

    setupPanel(panelType) {
        const panel = document.getElementById(`${panelType}-${panelType === 'missions' ? 'panel' : 'container'}`);
        const toggleButton = document.getElementById(`${panelType}-toggle`);
        const closeButton = document.getElementById(`close-${panelType}`);
        
        // Load saved state
        const isPanelVisible = localStorage.getItem(`${panelType}PanelVisible`) === 'true';
        if (isPanelVisible) {
            panel.classList.add('visible');
        }

        // Toggle button click handler
        toggleButton.addEventListener('click', () => {
            this.togglePanel(panelType);
        });

        // Close button click handler
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hidePanel(panelType);
        });

        // Prevent panel from closing when clicking inside
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    togglePanel(panelType) {
        const panel = document.getElementById(`${panelType}-${panelType === 'missions' ? 'panel' : 'container'}`);
        const isVisible = panel.classList.contains('visible');
        
        if (isVisible) {
            this.hidePanel(panelType);
        } else {
            this.showPanel(panelType);
        }
    }

    showPanel(panelType) {
        const panel = document.getElementById(`${panelType}-${panelType === 'missions' ? 'panel' : 'container'}`);
        panel.classList.add('visible');
        localStorage.setItem(`${panelType}PanelVisible`, 'true');
    }

    hidePanel(panelType) {
        const panel = document.getElementById(`${panelType}-${panelType === 'missions' ? 'panel' : 'container'}`);
        panel.classList.remove('visible');
        localStorage.setItem(`${panelType}PanelVisible`, 'false');
    }

    startMissionTimer() {
        const updateTimer = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const timeLeft = tomorrow - now;
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            document.getElementById('missions-timer').textContent = 
                `Next refresh in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                this.generateNewMissions();
                this.saveMissions();
                this.renderMissions();
            }
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    saveGameState() {
        const gameState = {
            deck: this.serializeCards(this.deck),
            waste: this.serializeCards(this.waste),
            foundations: {
                hearts: this.serializeCards(this.foundations.hearts),
                diamonds: this.serializeCards(this.foundations.diamonds),
                clubs: this.serializeCards(this.foundations.clubs),
                spades: this.serializeCards(this.foundations.spades)
            },
            tableau: this.tableau.map(pile => this.serializeCards(pile)),
            points: this.points,
            timestamp: new Date().getTime()
        };

        localStorage.setItem('solitaireGameState', JSON.stringify(gameState));
    }

    serializeCards(cards) {
        return cards.map(card => ({
            suit: card.suit,
            value: card.value,
            faceUp: card.faceUp
        }));
    }

    loadGameState() {
        const savedState = localStorage.getItem('solitaireGameState');
        if (!savedState) return false;

        const state = JSON.parse(savedState);
        
        // Check if the saved state is from the last 24 hours
        const now = new Date().getTime();
        if (now - state.timestamp > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('solitaireGameState');
            return false;
        }

        // Recreate the game state
        this.deck = this.deserializeCards(state.deck);
        this.waste = this.deserializeCards(state.waste);
        this.foundations = {
            hearts: this.deserializeCards(state.foundations.hearts),
            diamonds: this.deserializeCards(state.foundations.diamonds),
            clubs: this.deserializeCards(state.foundations.clubs),
            spades: this.deserializeCards(state.foundations.spades)
        };
        this.tableau = state.tableau.map(pile => this.deserializeCards(pile));
        this.points = state.points;

        this.renderGame();
        return true;
    }

    deserializeCards(cardData) {
        return cardData.map(data => {
            const card = new Card(data.suit, data.value);
            if (data.faceUp) {
                card.flip();
            }
            return card;
        });
    }

    newGame() {
        // Clear saved game state when starting a new game
        localStorage.removeItem('solitaireGameState');
        document.getElementById('win-message').style.display = 'none';
        this.deck = [];
        this.waste = [];
        this.foundations = {
            'hearts': [],
            'diamonds': [],
            'clubs': [],
            'spades': []
        };
        this.tableau = Array(7).fill().map(() => []);
        this.points = 0;
        this.initializeGame();
        this.updatePointsDisplay();
    }
}

let game;  // Make game globally accessible
function newGame() {
    // Clear saved game state when starting a new game
    localStorage.removeItem('solitaireGameState');
    document.getElementById('win-message').style.display = 'none';
    game = new Solitaire();
}

// Start the game when the page loads
window.addEventListener('load', () => {
    game = new Solitaire();
});
