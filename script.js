// 全域卡牌識別碼與資源
let cardIdCounter = 0;

window.onload = function () {
  /* ========== 遊戲狀態 ========== */
  let currentRound   = 1;
  let currentGold    = 0;  // 玩家目前總金幣
  let roundRevenue   = 0;  // 本回合累計收益
  let refreshCount   = 0;  // 本回合刷新次數 (依次疊加成本)

  /* ========== 介面元素 ========== */
  const startScreen     = document.getElementById('start-screen');
  const drawSection     = document.getElementById('draw-section');
  const cardPool        = document.getElementById('card-pool');
  const hand            = document.getElementById('hand');
  const mapArea         = document.getElementById('map-area');
  const roundNumberElem = document.getElementById('round-number');
  const endTurnBtn      = document.getElementById('end-turn-btn');
  const goldAmountElem  = document.getElementById('gold-amount');
  const roundGoldElem   = document.getElementById('round-gold');
  const refreshBtn      = document.getElementById('refresh-btn');

  // 說明彈窗
  const infoBtn         = document.getElementById('info-btn');
  const infoModal       = document.getElementById('info-modal');
  const closeInfoBtn    = document.getElementById('close-info-btn');

  // 暫存本回合選取的卡牌 DOM
  const selectedCards   = [];

  /* ========== 地塊資料(4×5=20) ========== */
  // 與之前相同, row=0~3, col=0~4
  // 這裡維持原有分配，但會在 BFS 時調整 odd-r/even-r 方向。
  const tileMap = [
    // row0
    { row:0, col:0, type:'wasteland' },
    { row:0, col:1, type:'river' },
    { row:0, col:2, type:'river' },
    { row:0, col:3, type:'river' },
    { row:0, col:4, type:'river' },

    // row1
    { row:1, col:0, type:'wasteland' },
    { row:1, col:1, type:'slum' },
    { row:1, col:2, type:'city' },
    { row:1, col:3, type:'slum' },
    { row:1, col:4, type:'wasteland' },

    // row2
    { row:2, col:0, type:'wasteland' },
    { row:2, col:1, type:'slum' },
    { row:2, col:2, type:'city' },
    { row:2, col:3, type:'city' },
    { row:2, col:4, type:'wasteland' },

    // row3
    { row:3, col:0, type:'wasteland' },
    { row:3, col:1, type:'wasteland' },
    { row:3, col:2, type:'slum' },
    { row:3, col:3, type:'slum' },
    { row:3, col:4, type:'wasteland' },
  ];

  // 基礎屬性
  tileMap.forEach((t, idx) => {
    t.id               = idx;
    t.buildingProduce  = 0;
    t.buildingPlaced   = false;
    t.slumBonusGranted = false;
    t.adjacency        = [];
  });

  /* ========== Hex Layout 參數 ========== */
  const tileWidth       = 80;
  const tileHeight      = 80;
  const verticalSpacing = tileHeight * 0.75; // 60
  const offsetX         = tileWidth / 2;     // 40

  /**
   * 重點修正：
   * 依您的「視覺直覺」判斷，row=0 應視為 odd-row；row=1 視為 even-row。
   * 因此在 BFS 時，把 row 為偶數時視為 odd-row, row 為奇數時視為 even-row。
   * 讓 #1 不再把 #8 視為相鄰。
   */

  function inBounds(r, c) {
    return (r >= 0 && r < 4 && c >= 0 && c < 5);
  }

  // 注意：交換 directionsEven, directionsOdd
  const directionsOdd = [
    { dr: -1, dc: 0 },
    { dr: -1, dc: +1 },
    { dr: 0,  dc: -1 },
    { dr: 0,  dc: +1 },
    { dr: +1, dc: 0 },
    { dr: +1, dc: +1 }
  ];
  const directionsEven = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: 0,  dc: -1 },
    { dr: 0,  dc: +1 },
    { dr: +1, dc: -1 },
    { dr: +1, dc: 0 }
  ];

  function computeAdjacency() {
    tileMap.forEach((tile) => {
      const { row, col } = tile;
      // row=0 => 視為 odd
      // row=1 => 視為 even
      // row=2 => 視為 odd
      // row=3 => 視為 even
      // => isOddRow = (row % 2 === 0)
      const isOddRow = (row % 2 === 0); 
      // 交換
      const dirSet = isOddRow ? directionsOdd : directionsEven;

      dirSet.forEach(d => {
        const nr = row + d.dr;
        const nc = col + d.dc;
        if (inBounds(nr, nc)) {
          const neighbor = tileMap.find(t => t.row === nr && t.col === nc);
          if (neighbor) {
            tile.adjacency.push(neighbor.id);
          }
        }
      });
    });
  }
  computeAdjacency();

  /* ========== 基礎 UI 更新 ========== */
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }
  function updateResourceDisplay() {
    goldAmountElem.innerText = currentGold;
    roundGoldElem.innerText  = roundRevenue;
  }
  function updateRefreshButton() {
    const cost = 2 * (refreshCount + 1);
    refreshBtn.textContent = `刷新卡片(${cost} 金幣)`;
  }

  /* ========== 建築卡生成 ========== */
  function createBuildingCard(buildingName) {
    const produceAmount = 6; 
    const rarity        = "普通";
    const card          = document.createElement('div');
    card.className      = 'card';
    card.dataset.type   = 'building';
    card.dataset.produce= produceAmount;
    card.dataset.cardId = ++cardIdCounter;
    card.draggable      = true;

    card.innerHTML = `
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${buildingName}</div>
      <div class="card-rarity">${rarity}</div>
      <div class="card-ability"></div>
    `;

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', buildingName);
    });
    return card;
  }

  /* ========== 抽卡邏輯 ========== */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function drawCards() {
    cardPool.innerHTML = '';
    const possibleBuildings = ["建築A","建築B","建築C","建築D","建築E"];
    const shuffled = shuffle(possibleBuildings.slice());
    const drawnBuildings = shuffled.slice(0, 5);

    drawnBuildings.forEach((bName) => {
      const card = createBuildingCard(bName);
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

  window.refreshCards = function () {
    const cost = 2 * (refreshCount + 1);
    if (currentGold < cost) {
      alert("金幣不足，無法刷新卡牌!");
      return;
    }
    currentGold -= cost;
    refreshCount++;
    updateResourceDisplay();
    updateRefreshButton();

    selectedCards.length = 0;
    drawCards();
  };

  window.skipDraw = function () {
    currentGold += 10;
    updateResourceDisplay();
    drawSection.style.display = 'none';
  };

  window.confirmDraw = function () {
    if (selectedCards.length < 2) {
      alert("請至少選擇 2 張卡牌！");
      return;
    }
    selectedCards.forEach((c) => {
      const copy = createBuildingCard(c.querySelector('.card-name').innerText);
      hand.appendChild(copy);
    });
    drawSection.style.display = 'none';
  };

  window.startDrawPhase = function () {
    refreshCount = 0;
    selectedCards.length = 0;
    updateRefreshButton();
    drawSection.style.display = 'flex';
    drawCards();
  };

  /* ========== 建立地塊 (絕對定位) ========== */
  const tileWidth       = 80;
  const tileHeight      = 80;
  const verticalSpacing = tileHeight * 0.75; // 60
  const offsetX         = tileWidth / 2;     // 40

  function createAllTiles() {
    tileMap.forEach((tile) => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';

      // 顏色
      if      (tile.type === 'city')   hex.classList.add('city-tile');
      else if (tile.type === 'slum')   hex.classList.add('slum-tile');
      else if (tile.type === 'river')  hex.classList.add('river-tile');
      else                             hex.classList.add('wasteland-tile');

      hex.dataset.tileId = tile.id;
      hex.textContent    = '?';

      // 絕對定位
      // row=0 => oddRow => offset=0
      // row=1 => evenRow => offset=offsetX
      // row=2 => oddRow => offset=0
      // row=3 => evenRow => offset=offsetX
      const isOddRow = (tile.row % 2 === 0);
      const x        = tile.col * tileWidth + (isOddRow ? 0 : offsetX);
      const y        = tile.row * verticalSpacing;
      hex.style.left = x + 'px';
      hex.style.top  = y + 'px';

      // 拖曳
      hex.ondragover = (e) => e.preventDefault();
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId   = e.dataTransfer.getData('cardId');
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElem) return;
        placeBuildingOnTile(tile, cardElem);
      };

      mapArea.appendChild(hex);
    });
  }

  /* ========== 放置建築：計算產出 ========== */
  function placeBuildingOnTile(tile, cardElem) {
    // 若已有建築 => 先扣除
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce  = 0;
      tile.slumBonusGranted = false;
    }

    let produceVal = parseInt(cardElem.dataset.produce) || 6;

    if (tile.type === 'city')  produceVal += 2;
    if (tile.type === 'river') produceVal -= 1;

    tile.buildingProduce = produceVal;
    tile.buildingPlaced  = true;

    // UI
    const thisHex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    thisHex.textContent = cardElem.querySelector('.card-name').innerText;

    cardElem.remove();

    // 若是貧民窟 => 檢查相連
    if (tile.type === 'slum') {
      checkSlumClusterAndAddBonus(tile.id);
    }

    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  /* ========== 貧民窟 >=3 相連 => +1 ========== */
  function checkSlumClusterAndAddBonus(startId) {
    const visited = new Set();
    const queue   = [startId];
    const cluster = [];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const t = tileMap[currId];
      if (t.type === 'slum' && t.buildingPlaced) {
        cluster.push(currId);
        t.adjacency.forEach(nbId => {
          const nbTile = tileMap[nbId];
          if (!visited.has(nbId) && nbTile.type === 'slum' && nbTile.buildingPlaced) {
            queue.push(nbId);
          }
        });
      }
    }
    // 若相連的貧民窟 >= 3 => 為尚未加成者 +1
    if (cluster.length >= 3) {
      cluster.forEach(cid => {
        const slumTile = tileMap[cid];
        if (!slumTile.slumBonusGranted) {
          roundRevenue -= slumTile.buildingProduce;
          slumTile.buildingProduce += 1;
          slumTile.slumBonusGranted = true;
          roundRevenue += slumTile.buildingProduce;
        }
      });
      updateResourceDisplay();
    }
  }

  /* ========== 初始化地圖 & 遊戲流程 ========== */
  function initMapArea() {
    mapArea.innerHTML = '';
    createAllTiles();
  }
  initMapArea();

  function startGame() {
    startScreen.style.display = 'none';
    currentRound   = 1;
    currentGold    = 0;
    roundRevenue   = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  // 回合結束
  endTurnBtn.addEventListener('click', () => {
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  // 監聽鍵盤 (Enter) 開始遊戲
  document.addEventListener('keydown', (e) => {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  // 說明彈窗
  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });
};
