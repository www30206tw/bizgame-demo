// 全域卡牌識別碼與資源
let cardIdCounter = 0;

window.onload = function () {
  // 回合與資源
  let currentRound = 1;
  let currentGold = 0;       // 玩家目前總金幣
  let roundRevenue = 0;      // 每回合收益(由已放置的建築累計)

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

  // 用來暫存此回合選擇的卡牌DOM
  const selectedCards = [];

  /* ========== UI 更新函式 ========== */
  // 更新回合顯示
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }
  // 更新金幣與回合收益的顯示
  function updateResourceDisplay() {
    goldAmountElem.innerText  = currentGold;
    roundGoldElem.innerText   = roundRevenue;
  }

  // 簡單洗牌函式
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /* ========== 建築卡的生成 ========== */
  // 建立建築卡 (固定產出 6 金幣)
  function createBuildingCard(buildingName) {
    const produceAmount = 6;  // 預設所有建築的產出
    const rarity = "普通";    // 目前預設皆為普通
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.type = 'building';
    card.dataset.produce = produceAmount;
    card.dataset.cardId = ++cardIdCounter; // 唯一識別ID
    card.draggable = true;

    // 卡片結構 (圖片區、產出、名稱、稀有度、能力)
    // 目前能力與背景區塊先留白
    card.innerHTML = `
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${buildingName}</div>
      <div class="card-rarity">${rarity}</div>
      <div class="card-ability"></div>
    `;

    // 拖曳事件：傳遞卡牌ID與文字
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', buildingName);
    });

    return card;
  }

  /* ========== 抽卡邏輯 ========== */
  function drawCards() {
    cardPool.innerHTML = '';
    // 只生成建築卡
    const possibleBuildings = ["建築A", "建築B", "建築C", "建築D", "建築E"];
    const shuffled = shuffle(possibleBuildings.slice());
    const drawnBuildings = shuffled.slice(0, 5);  // 取前5個

    drawnBuildings.forEach((bName) => {
      const card = createBuildingCard(bName);
      // 點擊選取卡牌 (最多 2 張)
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
    // 先清空所選卡
    selectedCards.length = 0;
    // 重抽卡
    drawCards();
  };

  // 跳過抽卡 (僅隱藏抽卡視窗, 可視需求加上跳過獎勵)
  window.skipDraw = function () {
    drawSection.style.display = 'none';
  };

  // 確定選卡 (若不足 2 張，跳提示)
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

  // 開始抽卡階段
  window.startDrawPhase = function () {
    selectedCards.length = 0;
    drawSection.style.display = 'flex';
    drawCards();
  };

  /* ========== 地塊初始化與拖曳放置 ========== */
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（六邊形地塊）</h2>';
    for (let i = 0; i < 6; i++) {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      hex.setAttribute("data-has-building", "false");

      // 允許被拖曳元素放下
      hex.ondragover = (e) => e.preventDefault();

      // 放置卡牌
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const buildingName = e.dataTransfer.getData('text/plain');

        // 若地塊已有建築，詢問是否覆蓋
        if (hex.getAttribute("data-has-building") === "true") {
          if (!confirm("該地塊已經有建築，是否覆蓋？")) {
            return; // 取消則不蓋
          }
        }
        // 放置新建築
        hex.innerText = buildingName;
        hex.setAttribute("data-has-building", "true");

        // 從手排中移除該卡牌
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElem) {
          // 拿到建築的產出
          const produceVal = parseInt(cardElem.dataset.produce) || 0;
          // 回合收益增加
          roundRevenue += produceVal;
          updateResourceDisplay();

          cardElem.remove();
        }
      };
      mapArea.appendChild(hex);
    }
  }
  initMapArea();

  /* ========== 遊戲開始與回合流程 ========== */
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  // 監聽鍵盤：在開始畫面按下 Enter
  document.addEventListener('keydown', function (e) {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  // 回合結束：增加金幣，進入下一回合
  endTurnBtn.addEventListener('click', function () {
    // 每回合結束時，總金幣 += 回合收益
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();

    // 依設計決定是否清空手排；此處示範直接保留
    // hand.innerHTML = '手排（建築）';

    // 進入新回合抽卡
    window.startDrawPhase();
  });
};
