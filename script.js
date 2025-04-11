window.onload = function () {
  let currentRound = 1; // 回合計數
  const startScreen = document.getElementById('start-screen');
  const drawSection = document.getElementById('draw-section');
  const cardPool = document.getElementById('card-pool');
  const hand = document.getElementById('hand');
  const mapArea = document.getElementById('map-area');
  const roundNumberElem = document.getElementById('round-number');
  const endTurnBtn = document.getElementById('end-turn-btn');
  const selectedCards = [];

  // 更新上方回合數資訊
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }

  // 建立卡牌元素
  function createCard(type, label) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerText = label;
    card.draggable = true;
    card.dataset.type = type;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', label);
    });
    return card;
  }

  // 抽卡（產生 5 張卡牌供玩家選擇其中 2 張）
  function drawCards() {
    cardPool.innerHTML = '';
    const cards = ['科技卡 A', '建築卡 D', '建築卡 A', '建築卡 C', '科技卡 B'];
    cards.forEach((label) => {
      const card = createCard(label.includes('建築') ? 'building' : 'tech', label);
      card.onclick = () => {
        if (selectedCards.includes(card)) {
          card.classList.remove('selected');
          selectedCards.splice(selectedCards.indexOf(card), 1);
        } else if (selectedCards.length < 2) {
          card.classList.add('selected');
          selectedCards.push(card);
        }
      };
      cardPool.appendChild(card);
    });
  }

  // 刷新卡牌
  window.refreshCards = function () {
    drawCards();
    selectedCards.length = 0;
  };

  // 跳過抽卡階段（隱藏抽卡視窗，可依需求調整獎勵邏輯）
  window.skipDraw = function () {
    drawSection.style.display = 'none';
  };

  // 確定選卡，將選取的卡牌複製到手排區
  window.confirmDraw = function () {
    selectedCards.forEach((c) => {
      const copy = createCard(c.dataset.type, c.innerText);
      hand.appendChild(copy);
    });
    drawSection.style.display = 'none';
  };

  // 開始抽卡階段（每回合開始時呼叫）
  window.startDrawPhase = function () {
    // 可視需求重置手排
    // hand.innerHTML = '手排（建築）';
    selectedCards.length = 0;
    drawSection.style.display = 'flex';
    drawCards();
  };

  // 初始化六邊形地塊
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（六邊形地塊）</h2>';
    for (let i = 0; i < 6; i++) {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      hex.ondragover = (e) => e.preventDefault();
      hex.ondrop = (e) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/plain');
        hex.innerText = text;
      };
      mapArea.appendChild(hex);
    }
  }
  initMapArea();

  // 開始遊戲：隱藏開始畫面，初始化回合數，然後進入抽卡階段
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    updateRoundDisplay();
    window.startDrawPhase();
  }

  // 註冊鍵盤監聽：當開始畫面顯示時，按下 Enter 鍵即開始遊戲
  document.addEventListener('keydown', function (e) {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  // 「回合結束」按鈕：更新回合數並開始新的抽卡階段
  endTurnBtn.addEventListener('click', function () {
    // 此處可加入計算本回合金幣收益等邏輯
    currentRound++;
    updateRoundDisplay();
    // 如需要，每回合結束後可清空手排區，或依遊戲設計保留某些資訊
    hand.innerHTML = '手排（建築）';
    window.startDrawPhase();
  });
};
