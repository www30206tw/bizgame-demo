// 定義全域卡牌識別碼計數器
let cardIdCounter = 0;

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

  // 建立卡牌元素，並賦予唯一識別碼
  function createCard(type, label) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerText = label;
    card.draggable = true;
    card.dataset.type = type;
    card.dataset.cardId = ++cardIdCounter; // 產生唯一識別碼
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', label);
      e.dataTransfer.setData('cardId', card.dataset.cardId);
    });
    return card;
  }

  // 抽卡函式：從較大牌庫中隨機選取 5 張卡牌供選擇
  function drawCards() {
    cardPool.innerHTML = '';
    const availableCards = [
      '科技卡 A', '建築卡 D', '建築卡 A',
      '建築卡 C', '科技卡 B', '科技卡 C',
      '建築卡 E', '建築卡 F', '科技卡 D',
      '建築卡 G'
    ];
    // 隨機洗牌
    const shuffled = availableCards.slice().sort(() => Math.random() - 0.5);
    const drawnCards = shuffled.slice(0, 5);
    drawnCards.forEach((label) => {
      const card = createCard(label.includes('建築') ? 'building' : 'tech', label);
      // 點擊選取卡牌（最多選 2 張）
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

  // 刷新卡牌：現在會重抽牌庫的全新組合
  window.refreshCards = function () {
    selectedCards.length = 0;
    drawCards();
  };

  // 跳過抽卡階段（僅隱藏抽卡視窗，可依需求調整獎勵邏輯）
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

  // 開始抽卡階段，每回合開始時呼叫
  window.startDrawPhase = function () {
    // 如有需求，可以在此重置手排內容
    // hand.innerHTML = '手排（建築）';
    selectedCards.length = 0;
    drawSection.style.display = 'flex';
    drawCards();
  };

  // 初始化六邊形地塊，並加入拖曳及覆蓋確認邏輯
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（六邊形地塊）</h2>';
    for (let i = 0; i < 6; i++) {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      hex.setAttribute("data-has-building", "false");
      hex.ondragover = (e) => e.preventDefault();
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const label = e.dataTransfer.getData('text/plain');

        // 若地塊已有建築，詢問是否覆蓋
        if (hex.getAttribute("data-has-building") === "true") {
          if (!confirm("該地塊已經有建築，是否覆蓋？")) {
            return; // 若取消則不作更動
          }
        }
        // 放置新的建築到地塊
        hex.innerText = label;
        hex.setAttribute("data-has-building", "true");

        // 從手排中移除該卡牌（僅限手排內的建築卡）
        const cardElem = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElem && cardElem.parentElement.id === "hand") {
          cardElem.remove();
        }
      };
      mapArea.appendChild(hex);
    }
  }
  initMapArea();

  // 開始遊戲：隱藏開始畫面，初始化回合數並進入抽卡階段
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    updateRoundDisplay();
    window.startDrawPhase();
  }

  // 註冊鍵盤監聽：當開始畫面顯示時，按下 Enter 鍵開始遊戲
  document.addEventListener('keydown', function (e) {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  // 回合結束按鈕：更新回合數並開始新一回合的抽卡階段
  endTurnBtn.addEventListener('click', function () {
    // 可在此加入本回合金幣收益計算等邏輯
    currentRound++;
    updateRoundDisplay();
    // 重置手排內容（依需求可調整）
    hand.innerHTML = '手排（建築）';
    window.startDrawPhase();
  });
};
