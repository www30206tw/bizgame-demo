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
  const selectedCards = [];

  /* ========== 地塊資料(4×5=20) ========== */
  //   需求： 
  //   - 3 塊繁華區相鄰 (city)
  //   - 5 塊貧民窟 (slum) 相連
  //   - 4 塊河流(river) 連成一線
  //   - 其餘為荒原 (wasteland)
  //
  //   這裡預先手動配置，並在 BFS 中做「odd-r 偏移」計算相鄰。
  //
  //   row=0: (0,0) (0,1) (0,2) (0,3) (0,4)
  //   row=1: (1,0) (1,1) (1,2) (1,3) (1,4)
  //   row=2: (2,0) (2,1) (2,2) (2,3) (2,4)
  //   row=3: (3,0) (3,1) (3,2) (3,3) (3,4)
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

  // 給每個 tile 加上基礎屬性
  tileMap.forEach((t, idx) => {
    t.id                = idx;
    t.buildingProduce   = 0;   // 當前建築產出
    t.buildingPlaced    = false;
    t.slumBonusGranted  = false; // 避免重複加貧民窟 +1
    t.adjacency         = [];
  });

  /* ========== 計算 Hex 格狀鄰接(odd-r) ========== */
  function inBounds(r, c) {
    return (r >= 0 && r < 4 && c >= 0 && c < 5);
  }

  function computeAdjacency() {
    // odd-r 偏移 hex，相鄰方向定義
    const directionsEven = [
      { dr: -1, dc: 0 },
      { dr: -1, dc: +1 },
      { dr: 0,  dc: -1 },
      { dr: 0,  dc: +1 },
      { dr: +1, dc: 0 },
      { dr: +1, dc: +1 }
    ];
    const directionsOdd = [
      { dr: -1, dc: -1 },
      { dr: -1, dc: 0 },
      { dr: 0,  dc: -1 },
      { dr: 0,  dc: +1 },
      { dr: +1, dc: -1 },
      { dr: +1, dc: 0 }
    ];

    tileMap.forEach((tile) => {
      const { row, col } = tile;
      const isEvenRow = (row % 2 === 0);
      const dirSet = isEvenRow ? directionsEven : directionsOdd;

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

  /* ========== 卡牌生成 (建築) ========== */
  function createBuildingCard(buildingName) {
    const produceAmount = 6;  // 基礎產出
    const rarity        = "普通";
    const card = document.createElement('div');
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

  /* ========== 建立地塊並渲染 ========== */
  function createAllTiles() {
    tileMap.forEach((tile) => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';

      // 根據 type 決定顏色
      if      (tile.type === 'city')      hex.classList.add('city-tile');
      else if (tile.type === 'slum')      hex.classList.add('slum-tile');
      else if (tile.type === 'river')     hex.classList.add('river-tile');
      else                                hex.classList.add('wasteland-tile');

      hex.textContent = '?';  // 可改成 tile.type 以利除錯
      hex.dataset.tileId = tile.id;

      // 拖曳放置
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

  /* ========== 放置建築到地塊：計算產出 ========== */
  function placeBuildingOnTile(tile, cardElem) {
    // 若地塊已有建築，先扣除舊產出
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce   = 0;
      tile.slumBonusGranted  = false; // 覆蓋建築後，重置貧民窟加成狀態
    }

    // 建築基礎產出
    let produceVal = parseInt(cardElem.dataset.produce) || 6;

    // 繁華區 +2
    if (tile.type === 'city') {
      produceVal += 2;
    }
    // 河流 -1
    if (tile.type === 'river') {
      produceVal -= 1;
    }

    tile.buildingProduce = produceVal;
    tile.buildingPlaced  = true;

    // 更新畫面：在地塊上顯示卡牌名稱
    const thisHex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    thisHex.textContent = cardElem.querySelector('.card-name').innerText;

    // 手排移除該卡
    cardElem.remove();

    // 若是貧民窟，就檢查是否形成 3(含)以上相連
    // 只對尚未加成的建築進行 +1
    if (tile.type === 'slum') {
      checkSlumClusterAndAddBonus(tile.id);
    }

    // 最後把計算完的建築產值加入回合收益
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  /* ========== 判斷貧民窟相連：若>=3，+1 ========== */
  function checkSlumClusterAndAddBonus(startId) {
    // BFS：找出與 startId 同樣是 slum、有建築的相連集合
    const visited = new Set();
    const queue = [startId];
    const cluster = [];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const t = tileMap[currId];
      if (t.type === 'slum' && t.buildingPlaced) {
        cluster.push(currId);
        // 搜尋相鄰
        t.adjacency.forEach(nbId => {
          const nbTile = tileMap[nbId];
          if (!visited.has(nbId) && nbTile.type === 'slum' && nbTile.buildingPlaced) {
            queue.push(nbId);
          }
        });
      }
    }

    // 若相連貧民窟 >=3，就為尚未加成的建築 +1
    if (cluster.length >= 3) {
      cluster.forEach(cid => {
        const slumTile = tileMap[cid];
        // 若該地塊尚未加成過 => 加 1
        if (!slumTile.slumBonusGranted) {
          roundRevenue -= slumTile.buildingProduce;
          slumTile.buildingProduce += 1;
          slumTile.slumBonusGranted = true; // 避免重複加
          roundRevenue += slumTile.buildingProduce;
        }
      });
      updateResourceDisplay();
    }
  }

  /* ========== 初始化地圖 ========== */
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（20 塊）</h2>';
    createAllTiles();
  }
  initMapArea();

  /* ========== 開始遊戲、回合流程 ========== */
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold  = 0;
    roundRevenue = 0;
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

  /* ========== 說明彈窗 ========== */
  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });
};
