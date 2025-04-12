// 確保只有一份 script.js，避免重複宣告
let cardIdCounter = 0;

window.onload = function () {
  /********************************************************
   *  1. 資源 & 狀態變數
   ********************************************************/
  let currentRound   = 1;
  let currentGold    = 0;  // 玩家金幣
  let roundRevenue   = 0;  // 回合收益
  let refreshCount   = 0;  // 刷新次數

  /********************************************************
   *  2. DOM 取得
   ********************************************************/
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
  const infoBtn         = document.getElementById('info-btn');
  const infoModal       = document.getElementById('info-modal');
  const closeInfoBtn    = document.getElementById('close-info-btn');

  const selectedCards   = [];

  /********************************************************
   *  3. 定義31塊地形 & 佈局
   *     共有 6 列: 
   *       row=0 => 5塊  (id=1..5)
   *       row=1 => 6塊  (id=6..11)
   *       row=2 => 7塊  (id=12..18)
   *       row=3 => 6塊  (id=19..24)
   *       row=4 => 5塊  (id=25..29)
   *       row=5 => 2塊  (id=30..31)
   *     如此合計31塊。
   *     參考 odd-r (row=0視為偶數列) 邏輯計算鄰接。
   ********************************************************/
  const tileMap = createTileMap31();

  // 幫每塊 tile 加上預設屬性
  tileMap.forEach(tile => {
    tile.buildingProduce  = 0;
    tile.buildingPlaced   = false;
    tile.slumBonusGranted = false;
    tile.adjacency        = [];
  });

  // 計算 adjacency (odd-r)
  computeAdjacency();

  // 以絕對定位排版
  initMapArea();

  /********************************************************
   *  4. 事件：開始遊戲 / 回合結束 / 說明彈窗
   ********************************************************/
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold  = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  document.addEventListener('keydown', (e) => {
    // 同時偵測 Enter / NumpadEnter
    if (startScreen.style.display !== 'none' && 
       (e.key === 'Enter' || e.key === 'NumpadEnter')) {
      startGame();
    }
  });

  endTurnBtn.addEventListener('click', () => {
    // 回合結束 => 將 roundRevenue 累加到 currentGold
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });

  /********************************************************
   *  5. 抽卡邏輯：5 選 1
   ********************************************************/
  function drawCards() {
    cardPool.innerHTML = '';
    const possibleBuildings = ["建築A","建築B","建築C","建築D","建築E"];
    const shuffled = shuffle(possibleBuildings.slice());
    // 只取5張
    const drawn = shuffled.slice(0, 5);

    drawn.forEach((bName) => {
      const card = createBuildingCard(bName);
      card.onclick = () => {
        // 選卡(一次只能選1)
        if (selectedCards.includes(card)) {
          card.classList.remove('selected');
          selectedCards.splice(selectedCards.indexOf(card), 1);
        } else {
          // 先清空其他選取
          selectedCards.forEach(c => c.classList.remove('selected'));
          selectedCards.length = 0;

          card.classList.add('selected');
          selectedCards.push(card);
        }
      };
      cardPool.appendChild(card);
    });
  }

  window.refreshCards = function() {
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

  window.skipDraw = function() {
    currentGold += 10;
    updateResourceDisplay();
    drawSection.style.display = 'none';
  };

  window.confirmDraw = function() {
    // 選取卡牌 < 1 => 提示
    if (selectedCards.length < 1) {
      alert("請至少選擇 1 張卡牌！");
      return;
    }
    selectedCards.forEach((c) => {
      const copy = createBuildingCard(c.querySelector('.card-name').innerText);
      hand.appendChild(copy);
    });
    drawSection.style.display = 'none';
  };

  window.startDrawPhase = function() {
    refreshCount = 0;
    selectedCards.length = 0;
    updateRefreshButton();
    drawSection.style.display = 'flex';
    drawCards();
  };

  /********************************************************
   *  6. 建立建築卡
   ********************************************************/
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

  /********************************************************
   *  7. 放置建築 & 加成
   ********************************************************/
  function placeBuildingOnTile(tile, cardElem) {
    // 若該地塊已有建築 => 先扣除
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce  = 0;
      tile.slumBonusGranted = false;
    }
    // 基礎產量
    let produceVal = parseInt(cardElem.dataset.produce) || 6;
    // 類型加減成
    if (tile.type === 'city')  produceVal += 2;
    if (tile.type === 'river') produceVal -= 1;
    
    tile.buildingProduce = produceVal;
    tile.buildingPlaced  = true;

    // 顯示在介面
    const hexEl = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hexEl.textContent = cardElem.querySelector('.card-name').innerText;

    // 移除卡牌
    cardElem.remove();

    // 貧民窟檢查
    if (tile.type === 'slum') {
      checkSlumClusterAndAddBonus(tile.id);
    }
    // 更新回合收益
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  function checkSlumClusterAndAddBonus(startId) {
    const visited = new Set();
    const queue   = [startId];
    const cluster = [];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (visited.has(curr)) continue;
      visited.add(curr);

      const t = tileMap.find(x => x.id === curr);
      if (t && t.type === 'slum' && t.buildingPlaced) {
        cluster.push(curr);
        t.adjacency.forEach(nbID => {
          const nbTile = tileMap.find(x => x.id === nbID);
          if (!visited.has(nbID) && nbTile && nbTile.type === 'slum' && nbTile.buildingPlaced) {
            queue.push(nbID);
          }
        });
      }
    }
    if (cluster.length >= 3) {
      cluster.forEach(cid => {
        const st = tileMap.find(x => x.id === cid);
        if (!st.slumBonusGranted) {
          roundRevenue -= st.buildingProduce;
          st.buildingProduce += 1;
          st.slumBonusGranted = true;
          roundRevenue += st.buildingProduce;
        }
      });
      updateResourceDisplay();
    }
  }

  /********************************************************
   *  8. UI 更新：回合/資源
   ********************************************************/
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

  /********************************************************
   *  9. 生成 31 塊地塊：row, col, id, type
   *     6 列: (row=0: 1..5), (row=1: 6..11), ...
   ********************************************************/
  function createTileMap31(){
    // 依需求定義 row, col => id => type
    // row=0 => col=0..4 => id=1..5
    // row=1 => col=0..5 => id=6..11
    // row=2 => col=0..6 => id=12..18
    // row=3 => col=0..5 => id=19..24
    // row=4 => col=0..4 => id=25..29
    // row=5 => col=0..1 => id=30..31
    // 共31塊
    const data = [
      // row=0 (5 tiles)
      {id:1,type:'wasteland',row:0,col:0},
      {id:2,type:'wasteland',row:0,col:1},
      {id:3,type:'wasteland',row:0,col:2},
      {id:4,type:'wasteland',row:0,col:3},
      {id:5,type:'wasteland',row:0,col:4},

      // row=1 (6 tiles => id=6..11)
      {id:6, type:'slum',     row:1,col:0},
      {id:7, type:'slum',     row:1,col:1},
      {id:8, type:'wasteland',row:1,col:2},
      {id:9, type:'river',    row:1,col:3},
      {id:10,type:'slum',     row:1,col:4},
      {id:11,type:'city',     row:1,col:5},

      // row=2 (7 tiles => id=12..18)
      {id:12,type:'slum',     row:2,col:0},
      {id:13,type:'river',    row:2,col:1},
      {id:14,type:'slum',     row:2,col:2},
      {id:15,type:'city',     row:2,col:3},
      {id:16,type:'city',     row:2,col:4},
      {id:17,type:'river',    row:2,col:5},
      {id:18,type:'wasteland',row:2,col:6},

      // row=3 (6 tiles => id=19..24)
      {id:19,type:'slum',     row:3,col:0},
      {id:20,type:'slum',     row:3,col:1},
      {id:21,type:'river',    row:3,col:2},
      {id:22,type:'wasteland',row:3,col:3},
      {id:23,type:'wasteland',row:3,col:4},
      {id:24,type:'slum',     row:3,col:5},

      // row=4 (5 tiles => id=25..29)
      {id:25,type:'river',    row:4,col:0},
      {id:26,type:'wasteland',row:4,col:1},
      {id:27,type:'wasteland',row:4,col:2},
      {id:28,type:'wasteland',row:4,col:3},
      {id:29,type:'river',    row:4,col:4},

      // row=5 (2 tiles => id=30..31)
      {id:30,type:'wasteland',row:5,col:0},
      {id:31,type:'wasteland',row:5,col:5},
    ];
    return data;
  }

  /********************************************************
   * 10. 計算 adjacency (odd-r)
   *     row=0 視為偶數列, row=1為奇數列, 依此類推
   ********************************************************/
  function computeAdjacency(){
    // odd-r offset hex
    const directionsEven = [ // row為偶數 => row=0,2,4 => col不偏移
      { dr:-1, dc:0 },
      { dr:-1, dc:1 },
      { dr:0,  dc:-1},
      { dr:0,  dc:1 },
      { dr:1,  dc:0 },
      { dr:1,  dc:1 }
    ];
    const directionsOdd  = [ // row為奇數 => row=1,3,5 => col向左偏移
      { dr:-1, dc:-1 },
      { dr:-1, dc:0 },
      { dr:0,  dc:-1 },
      { dr:0,  dc:1  },
      { dr:1,  dc:-1 },
      { dr:1,  dc:0  }
    ];

    tileMap.forEach(tile => {
      const isEvenRow = (tile.row % 2 === 0);
      const dirSet    = isEvenRow ? directionsEven : directionsOdd;
      dirSet.forEach(d => {
        const nr = tile.row + d.dr;
        const nc = tile.col + d.dc;
        const neighbor = tileMap.find(t => t.row === nr && t.col === nc);
        if (neighbor) {
          tile.adjacency.push(neighbor.id);
        }
      });
    });
  }

  /********************************************************
   * 11. 將 31 塊絕對定位在地圖中央
   ********************************************************/
  function initMapArea(){
    mapArea.innerHTML = '';
    // tileWidth=80, tileHeight=80
    // odd-r 佈局: row偶數 => col無偏移, row奇數 => col offsetX
    const tileWidth  = 80;
    const tileHeight = 80;
    const verticalSpacing = tileHeight * 0.75; 
    const offsetX = tileWidth / 2; 

    // 先找 row, col 的最小最大
    let minX= Infinity, maxX= -Infinity;
    let minY= Infinity, maxY= -Infinity;

    // 暫存計算好的 (x,y)
    const tileCoords = tileMap.map(tile => {
      const isEvenRow = (tile.row % 2 === 0);
      // x= col * tileWidth + (row奇數? offsetX:0)
      const x = tile.col * tileWidth + (isEvenRow ? 0 : offsetX);
      const y = tile.row * verticalSpacing;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return {...tile, x, y};
    });

    // 置中 => 取 mapArea.clientWidth/Height
    const mapW = mapArea.clientWidth;
    const mapH = mapArea.clientHeight;
    const shapeWidth  = maxX - minX + tileWidth;
    const shapeHeight = maxY - minY + tileHeight;
    const offsetCenterX = (mapW - shapeWidth) / 2;
    const offsetCenterY = (mapH - shapeHeight) / 2;

    tileCoords.forEach(c => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      // 顏色
      if      (c.type === 'wasteland') hex.classList.add('wasteland-tile');
      else if (c.type === 'slum')      hex.classList.add('slum-tile');
      else if (c.type === 'river')     hex.classList.add('river-tile');
      else if (c.type === 'city')      hex.classList.add('city-tile');

      hex.dataset.tileId = c.id;
      hex.textContent    = '?';

      const px = c.x - minX + offsetCenterX;
      const py = c.y - minY + offsetCenterY;
      hex.style.left = px + 'px';
      hex.style.top  = py + 'px';

      // 拖曳
      hex.ondragover = e => e.preventDefault();
      hex.ondrop = e => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElem) return;
        placeBuildingOnTile(c, cardElem);
      };

      mapArea.appendChild(hex);
    });
  }
};
