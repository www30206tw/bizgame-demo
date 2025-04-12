// 全域卡牌識別碼與資源
let cardIdCounter = 0;

window.onload = function () {
  /********************************************
   * 回合與資源變數
   ********************************************/
  let currentRound = 1;
  let currentGold = 0;         // 玩家目前總金幣
  let roundRevenue = 0;        // 本回合累計收益
  let refreshCount = 0;        // 本回合刷新次數 (依次疊加刷新成本)

  /********************************************
   * 介面元素
   ********************************************/
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

  // 彈窗 (說明)
  const infoBtn         = document.getElementById('info-btn');
  const infoModal       = document.getElementById('info-modal');
  const closeInfoBtn    = document.getElementById('close-info-btn');

  // 暫存本回合選取的卡牌
  const selectedCards = [];

  /********************************************
   * 地塊資料 (預排 4 列 × 5 行 = 20 格)
   * 說明:
   *  - row, col：該地塊位於第幾列第幾行
   *  - type：地塊類型，可為 city(繁華區)、slum(貧民窟)、river(河流)、wasteland(荒原)
   *  - buildingProduce：實際放置的建築生產值 (若還沒放建築，為 0)
   *  - buildingPlaced：是否已放置建築
   *  - adjacency：稍後會根據 (row, col) 計算相鄰地塊
   ********************************************/
  const tileMap = [
    // row0
    { row:0, col:0, type:'city' },       // 繁華區
    { row:0, col:1, type:'wasteland' },
    { row:0, col:2, type:'wasteland' },
    { row:0, col:3, type:'city' },       // 繁華區
    { row:0, col:4, type:'wasteland' },

    // row1
    { row:1, col:0, type:'wasteland' },
    { row:1, col:1, type:'slum' },       // 貧民窟
    { row:1, col:2, type:'slum' },       // 貧民窟
    { row:1, col:3, type:'slum' },       // 貧民窟
    { row:1, col:4, type:'wasteland' },

    // row2
    { row:2, col:0, type:'river' },      // 河流
    { row:2, col:1, type:'river' },      // 河流
    { row:2, col:2, type:'river' },      // 河流
    { row:2, col:3, type:'river' },      // 河流
    { row:2, col:4, type:'wasteland' },

    // row3
    { row:3, col:0, type:'slum' },       // 貧民窟
    { row:3, col:1, type:'slum' },       // 貧民窟
    { row:3, col:2, type:'city' },       // 繁華區
    { row:3, col:3, type:'wasteland' },
    { row:3, col:4, type:'wasteland' },
  ];

  // 依序為每個 tile 加上額外屬性
  tileMap.forEach((t, idx) => {
    t.id = idx;
    t.buildingProduce = 0;
    t.buildingPlaced = false;
    t.adjacency = [];
  });

  /********************************************
   * 計算地塊之間的鄰接關係 (Hex 格式)
   *  這裡採用「奇偶行」偏移邏輯
   ********************************************/
  function inBounds(r, c) {
    return (r >= 0 && r < 4 && c >= 0 && c < 5);
  }

  function computeAdjacency() {
    // 六邊形網格的相鄰規則 (假設偶數 row 不偏移，奇數 row 有點偏移)
    // 為簡化，這裡用一個常見的 "odd-r" 或 "even-r" 偏移法
    // 若不熟悉可直接手刻，也可參考各 Hex 庫

    const directionsEven = [
      { dr: -1, dc: 0 },  // 上
      { dr: -1, dc: +1 }, // 右上
      { dr: 0,  dc: -1 }, // 左
      { dr: 0,  dc: +1 }, // 右
      { dr: +1, dc: 0 },  // 下
      { dr: +1, dc: +1 }  // 右下
    ];
    const directionsOdd = [
      { dr: -1, dc: -1 }, // 左上
      { dr: -1, dc: 0 },  // 上
      { dr: 0,  dc: -1 }, // 左
      { dr: 0,  dc: +1 }, // 右
      { dr: +1, dc: -1 }, // 左下
      { dr: +1, dc: 0 }   // 下
    ];

    tileMap.forEach((tile) => {
      const { row, col } = tile;
      const isEvenRow = (row % 2 === 0);
      const dirSet = isEvenRow ? directionsEven : directionsOdd;

      dirSet.forEach((d) => {
        const nr = row + d.dr;
        const nc = col + d.dc;
        if (inBounds(nr, nc)) {
          // 找到對應的 tile
          const neighbor = tileMap.find(t => t.row === nr && t.col === nc);
          if (neighbor) {
            tile.adjacency.push(neighbor.id);
          }
        }
      });
    });
  }
  computeAdjacency();

  /********************************************
   * UI 函式
   ********************************************/
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }

  function updateResourceDisplay() {
    goldAmountElem.innerText = currentGold;
    roundGoldElem.innerText  = roundRevenue;
  }

  // 更新刷新按鈕文字
  function updateRefreshButton() {
    const cost = 2 * (refreshCount + 1);
    refreshBtn.textContent = `刷新卡片(${cost} 金幣)`;
  }

  /********************************************
   * 建立建築卡 (預設產出6)
   ********************************************/
  function createBuildingCard(buildingName) {
    const produceAmount = 6;
    const rarity = "普通";
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.type = 'building';
    card.dataset.produce = produceAmount;
    card.dataset.cardId = ++cardIdCounter; 
    card.draggable = true;

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

  /********************************************
   * 抽卡邏輯
   ********************************************/
  // 簡單洗牌函式
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

  // 刷新卡片
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

  // 跳過抽卡
  window.skipDraw = function () {
    currentGold += 10;
    updateResourceDisplay();
    drawSection.style.display = 'none';
  };

  // 確定選卡
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

  // 開始抽卡階段
  window.startDrawPhase = function () {
    refreshCount = 0;
    selectedCards.length = 0;
    updateRefreshButton();
    drawSection.style.display = 'flex';
    drawCards();
  };

  /********************************************
   * 建立地塊 (20 塊) 與拖曳事件
   ********************************************/
  function createAllTiles() {
    tileMap.forEach((tile) => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';

      // 根據 type 決定顏色
      switch(tile.type) {
        case 'city':
          hex.classList.add('city-tile');
          break;
        case 'slum':
          hex.classList.add('slum-tile');
          break;
        case 'river':
          hex.classList.add('river-tile');
          break;
        default:
          // wasteland
          hex.classList.add('wasteland-tile');
          break;
      }

      hex.textContent = '?';  // 可視需求改成 tile.type
      hex.dataset.tileId = tile.id;
      // 拖曳放置
      hex.ondragover = (e) => e.preventDefault();
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        // 找到對應手排卡
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElem) return;

        placeBuildingOnTile(tile, cardElem); 
      };

      mapArea.appendChild(hex);
    });
  }

  /********************************************
   * 放置建築到地塊: 計算最終產出
   ********************************************/
  function placeBuildingOnTile(tile, cardElem) {
    // 若該地塊已經有建築，先把舊的產出從 roundRevenue 中扣除
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce = 0; 
    }

    // 計算建築的基礎產出(手排卡上的 dataset.produce)
    let produceVal = parseInt(cardElem.dataset.produce) || 6;

    // 額外修正：繁華區 +2
    if (tile.type === 'city') {
      produceVal += 2;
    }
    // 河流 -1
    if (tile.type === 'river') {
      produceVal -= 1;
    }
    // 貧民窟: 先不加成，等下做「貧民窟相連」判斷再加

    // 設定 tile 的建築資訊
    tile.buildingProduce = produceVal;
    tile.buildingPlaced  = true;

    // 更新畫面: 在地塊上顯示建築名稱
    const thisHex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    thisHex.textContent = cardElem.querySelector('.card-name').innerText;

    // 從手排移除卡牌
    cardElem.remove();

    // 重新計算「貧民窟相連」的加成 (若該 tile 是 slum)
    if (tile.type === 'slum') {
      checkSlumClusterAndAddBonus(tile.id);
    }

    // 最後把計算完的建築產值加入 roundRevenue
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  /********************************************
   * 判斷貧民窟是否形成 3 個 (含) 以上相連
   * 若有 >= 3 連通的貧民窟建築，則當下區塊的所有建築產出各 +1
   ********************************************/
  function checkSlumClusterAndAddBonus(startId) {
    // 獲得相連的所有 "slum" 且有建築的 tile
    const visited = new Set();
    const queue = [startId];
    const cluster = []; // 存放符合條件的 tile id

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const t = tileMap[currId];
      if (t.type === 'slum' && t.buildingPlaced) {
        cluster.push(currId);
        // 將相鄰的 tile 加入 queue
        t.adjacency.forEach(nbId => {
          const nbTile = tileMap[nbId];
          if (!visited.has(nbId) && nbTile.type === 'slum' && nbTile.buildingPlaced) {
            queue.push(nbId);
          }
        });
      }
    }

    // 若形成 3 塊以上相連的貧民窟，則為這些區塊內的建築+1產出
    if (cluster.length >= 3) {
      cluster.forEach(cid => {
        // 先從 roundRevenue 中扣除原本建築的產出
        roundRevenue -= tileMap[cid].buildingProduce;
        tileMap[cid].buildingProduce += 1;
        // 再把新的值加回 roundRevenue
        roundRevenue += tileMap[cid].buildingProduce;
      });
    }
    updateResourceDisplay();
  }

  /********************************************
   * 初始化整個遊戲
   ********************************************/
  function initMapArea() {
    mapArea.innerHTML = '<h2>地塊區（20 塊）</h2>';
    createAllTiles();
  }
  initMapArea();

  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  // 回合結束：將本回合收益加至總金幣，再進入下一回合
  endTurnBtn.addEventListener('click', function () {
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  // 監聽鍵盤：在開始畫面按下 Enter
  document.addEventListener('keydown', function (e) {
    if (startScreen.style.display !== 'none' && e.key === 'Enter') {
      startGame();
    }
  });

  /********************************************
   * 說明彈窗邏輯
   ********************************************/
  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });
};

