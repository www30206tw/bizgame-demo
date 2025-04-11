// 全域卡牌識別碼與資源
let cardIdCounter = 0;

window.onload = function () {
  // 回合與資源變數
  let currentRound = 1;
  let currentGold = 0;       // 玩家目前總金幣
  let roundRevenue = 0;      // 本回合累計收益（將用於回合結束時增加總金幣）
  let refreshCount = 0;      // 本回合內已刷新的次數，用於計算刷新成本

  // 介面元素
  const startScreen       = document.getElementById('start-screen');
  const drawSection       = document.getElementById('draw-section');
  const cardPool          = document.getElementById('card-pool');
  const hand              = document.getElementById('hand');
  const mapArea           = document.getElementById('map-area');
  const roundNumberElem   = document.getElementById('round-number');
  const endTurnBtn        = document.getElementById('end-turn-btn');
  const goldAmountElem    = document.getElementById('gold-amount');
  const roundGoldElem     = document.getElementById('round-gold');

  // 用來暫存本次抽卡選取的卡牌 DOM 物件
  const selectedCards = [];

  /* ========= UI 更新函式 ========= */
  // 更新回合數顯示
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }
  // 更新金幣與回合收益顯示
  function updateResourceDisplay() {
    goldAmountElem.innerText  = currentGold;
    roundGoldElem.innerText   = roundRevenue;
  }

  /* ========= 簡單洗牌函式 ========= */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /* ========= 建築卡的生成 ========= */
  // 建立建築卡（預設產出6金幣，稀有度為普通）
  function createBuildingCard(buildingName) {
    const produceAmount = 6;  // 每回合產出金幣預設 6
    const rarity = "普通";    // 目前預設皆為普通
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.type = 'building';
    card.dataset.produce = produceAmount;
    card.dataset.cardId = ++cardIdCounter; // 產生唯一識別ID
    card.draggable = true;

    // 卡牌結構：包含圖片區、左上產出、名稱、稀有度以及能力區
    card.innerHTML = `
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${buildingName}</div>
      <div class="card-rarity">${rarity}</div>
      <div class="card-ability"></div>
    `;

    // 拖曳事件：傳遞卡牌ID與名稱
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', buildingName);
    });

    return card;
  }

  /* ========= 抽卡邏輯 ========= */
  function drawCards() {
    cardPool.innerHTML = '';
    // 僅生成建築卡（科技卡暫不設計）
    const possibleBuildings = ["建築A", "建築B", "建築C", "建築D", "建築E"];
    const shuffled = shuffle(possibleBuildings.slice());
    const drawnBuildings = shuffled.slice(0, 5); // 取5張

    drawnBuildings.forEach((bName) => {
      const card = createBuildingCard(bName);
      // 點擊選取（最多選2張）
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

  // 刷新卡牌：扣除金幣並根據本回合刷新次數增加成本
  window.refreshCards = function () {
    const cost = 2 * (refreshCount + 1); // 第一次2金, 第二次4金, ...
    if (currentGold < cost) {
      alert("金幣不足，無法刷新卡牌!");
      return;
    }
    currentGold -= cost;
    updateResourceDisplay();
    refreshCount++;
    selectedCards.length = 0;
    drawCards();
  };

  // 跳過抽卡：隱藏抽卡視窗並加 10 金幣
  window.skipDraw = function () {
    currentGold += 10;
    updateResourceDisplay();
    drawSection.style.display = 'none';
  };

  // 確定選卡：檢查是否選滿2張，否則提示
  window.confirmDraw = function () {
    if (selectedCards.length < 2) {
      alert("請至少選擇 2 張卡牌！");
      return;
    }
    // 將所選卡牌加入手排
    selectedCards.forEach((c) => {
      const copy = createBuildingCard(c.querySelector('.card-name').innerText);
      hand.appendChild(copy);
    });
    drawSection.style.display = 'none';
  };

  // 開始抽卡階段（重置本回合刷新次數）
  window.startDrawPhase = function () {
    refreshCount = 0;
    selectedCards.length = 0;
    drawSection.style.display = 'flex';
    drawCards();
  };

  /* ========= 地塊初始化與拖曳放置 ========= */
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（六邊形地塊）</h2>';
    for (let i = 0; i < 6; i++) {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      // 用於記錄此地塊內的建築產出
      hex.setAttribute("data-has-building", "false");
      hex.dataset.produce = 0;

      // 允許拖曳元素進入
      hex.ondragover = (e) => e.preventDefault();

      // 拖曳放置處理
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const buildingName = e.dataTransfer.getData('text/plain');
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElem) return;
        const newProduction = parseInt(cardElem.dataset.produce) || 0;

        // 若地塊已有建築，詢問是否覆蓋
        if (hex.getAttribute("data-has-building") === "true") {
          if (!confirm("該地塊已有建築，是否覆蓋？")) {
            return;
          }
          // 減去原本建築的產出
          const oldProduction = parseInt(hex.dataset.produce) || 0;
          roundRevenue -= oldProduction;
        }
        // 放置新建築：更新文字與數值
        hex.innerText = buildingName;
        hex.setAttribute("data-has-building", "true");
        hex.dataset.produce = newProduction;

        // 累加新建築產出
        roundRevenue += newProduction;
        updateResourceDisplay();

        // 從手排移除該卡牌
        cardElem.remove();
      };
      mapArea.appendChild(hex);
    }
  }
  initMapArea();

  /* ========= 遊戲開始與回合流程 ========= */
  function startGame() {
    startScreen.style.display = 'none';
    // 初始化回合與資源
    currentRound = 1;
    currentGold = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  // 監聽鍵盤：在開始畫面按下 Enter 鍵開始遊戲
  document.addEventListener('keydown', function (e) {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  // 回合結束：將本回合收益加至總金幣，再進入下一回合
  endTurnBtn.addEventListener('click', function () {
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();

    // 此處依設計決定是否清空手排；本範例保留現有手排
    window.startDrawPhase();
  });
};

