// 為了避免衝突，請確保此檔案只有一份，且 index.html 只引用一次
let cardIdCounter = 0;

window.onload = function () {
  /* ========== 回合資源狀態 ========== */
  let currentRound   = 1;
  let currentGold    = 0;
  let roundRevenue   = 0;
  let refreshCount   = 0;

  /* ========== DOM 元素參考 ========== */
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

  /************************************************
   * 以「半徑 2」產生 19 塊蜂巢地塊
   * 中心(#1): 紫色 (city-tile)
   * 第1圈(#2~#7): 灰黑 (slum-tile)
   * 第2圈(#8~#19): 橙色 (wasteland-tile)
   ************************************************/
  // 使用「Axial 座標 + 半徑2」生成所有(q,r)，距離中心(0,0) <= 2
  // 範圍: -2 <= q <= 2, -2 <= r <= 2, 且 |q + r| <= 2
  const radius = 2;
  const tileData = []; // 暫存 {q, r, dist} 資訊

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const distance = hexDistance({q:0,r:0}, {q, r});
      if (distance <= radius) {
        tileData.push({ q, r, dist: distance });
      }
    }
  }
  // 依 dist 排序: dist=0 => #1, dist=1 => #2~#7, dist=2 => #8~#19
  tileData.sort((a,b) => a.dist - b.dist);

  // 給予「id 與 type」
  // dist=0 => tile #1 => city(紫)
  // dist=1 => tile #2~#7 => slum(灰黑)
  // dist=2 => tile #8~#19 => wasteland(橙)
  tileData.forEach((t, idx) => {
    t.id         = idx + 1; 
    t.buildingProduce   = 0;
    t.buildingPlaced    = false;
    t.slumBonusGranted  = false;
    if (t.dist === 0) {
      t.type = 'city'; 
    } else if (t.dist === 1) {
      t.type = 'slum';
    } else {
      t.type = 'wasteland';
    }
  });

  // 計算鄰接: 透過 axial 6 方向
  const axialDirs = [
    { dq: +1, dr: 0 },
    { dq: +1, dr: -1 },
    { dq: 0,  dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: +1 },
    { dq: 0,  dr: +1 },
  ];
  tileData.forEach((tile) => {
    tile.adjacency = [];
    axialDirs.forEach(d => {
      const nq = tile.q + d.dq;
      const nr = tile.r + d.dr;
      const neighbor = tileData.find(tt => tt.q === nq && tt.r === nr);
      if (neighbor) {
        tile.adjacency.push(neighbor.id);
      }
    });
  });

  // 將 tileData 存入全域 array
  const tileMap = tileData;

  // 以下將 axial 座標轉成實際 (x, y) 以絕對定位
  // 這裡選擇 pointy-top hex 佈局 => offsetX, offsetY 計算可參考
  // https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  // 為讓整個圖形在地圖中央，可以先計算 bbox，再置中。
  const tileWidth  = 80;
  const tileHeight = 80;

  // pointy-top 轉換 (q,r) => (x,y)
  function axialToPixel(q, r) {
    // pointy-top axial
    const x = tileWidth * (Math.sqrt(3) * (q + r/2));
    const y = tileHeight * (3/4 * r);
    return { x, y };
  }

  // 找出最小與最大 x, y 用於置中
  const coords = tileMap.map(t => {
    const {x, y} = axialToPixel(t.q, t.r);
    return { id:t.id, x, y, dist:t.dist, type:t.type, adjacency:t.adjacency };
  });
  const minX = Math.min(...coords.map(c => c.x));
  const maxX = Math.max(...coords.map(c => c.x));
  const minY = Math.min(...coords.map(c => c.y));
  const maxY = Math.max(...coords.map(c => c.y));

  // 讓中心 tile( dist=0 )盡量置中 mapArea
  // 先計算圖形寬高
  const shapeWidth  = maxX - minX + tileWidth;
  const shapeHeight = maxY - minY + tileHeight;
  // 取地圖容器一半 - 圖形寬度/2
  // 由於 mapArea 大小不一定，我們抓一個大概 => clientWidth/Height
  const centerOffsetX = mapArea.clientWidth/2  - shapeWidth/2;
  const centerOffsetY = mapArea.clientHeight/2 - shapeHeight/2;

  // 建立 hex-tile DOM
  coords.forEach((c) => {
    const hex = document.createElement('div');
    hex.className = 'hex-tile';
    if (c.type === 'city') {
      hex.classList.add('city-tile');
    } else if (c.type === 'slum') {
      hex.classList.add('slum-tile');
    } else {
      // dist=2 => wasteland(橙)
      hex.classList.add('wasteland-tile');
    }

    hex.dataset.tileId = c.id;
    hex.textContent = '?';
    // 絕對定位: 加上置中偏移
    const px = c.x - minX + centerOffsetX;
    const py = c.y - minY + centerOffsetY;
    hex.style.left = px + 'px';
    hex.style.top  = py + 'px';

    // 拖曳處理
    hex.ondragover = (e) => e.preventDefault();
    hex.ondrop = (e) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData('cardId');
      const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
      if (!cardElem) return;
      placeBuildingOnTile(c.id, cardElem);
    };
    mapArea.appendChild(hex);
  });

  /**
   * 以上已完成 19 塊蜂巢地塊，
   * tileMap[] 內存有 (id, dist, type, q, r, adjacency, ...)
   */

  /* ========== 工具函式：Axial 距離 ========== */
  function hexDistance(a, b) {
    // axial => cube => distance
    // 參考: https://www.redblobgames.com/grids/hexagons/#distances-axial
    const a3 = axialToCube(a.q, a.r);
    const b3 = axialToCube(b.q, b.r);
    return (Math.abs(a3.x - b3.x) + Math.abs(a3.y - b3.y) + Math.abs(a3.z - b3.z)) / 2;
  }
  function axialToCube(q, r) {
    const x = q;
    const z = r;
    const y = -x - z;
    return { x, y, z };
  }

  /* ========== 放置建築並計算產能 ========== */
  function placeBuildingOnTile(tileId, cardElem) {
    const tileObj = tileMap.find(t => t.id === tileId);
    if (!tileObj) return;

    // 若該地塊已有建築，先移除舊的產出
    if (tileObj.buildingPlaced) {
      roundRevenue -= tileObj.buildingProduce;
      tileObj.buildingProduce   = 0;
      tileObj.slumBonusGranted  = false;
    }

    // 基礎產量
    let produceVal = parseInt(cardElem.dataset.produce) || 6;
    // 若是 city => +2
    if (tileObj.type === 'city') {
      produceVal += 2;
    }
    // 若是 river => -1 (本示例中未出現，但可自行擴充)
    // 若是 slum => 後面再檢查相連 +1
    tileObj.buildingProduce = produceVal;
    tileObj.buildingPlaced  = true;

    // 在畫面顯示卡名
    const hexEl = mapArea.querySelector(`[data-tile-id="${tileId}"]`);
    hexEl.textContent = cardElem.querySelector('.card-name').innerText;

    // 從手排移除
    cardElem.remove();

    // 若是貧民窟 => 檢查相連 +1
    if (tileObj.type === 'slum') {
      checkSlumClusterAndAddBonus(tileObj.id);
    }

    // 加回本回合收益
    roundRevenue += tileObj.buildingProduce;
    updateResourceDisplay();
  }

  /* ========== 貧民窟 3 塊相連 => +1 ========== */
  function checkSlumClusterAndAddBonus(startId) {
    const visited = new Set();
    const queue = [startId];
    const cluster = [];
    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const t = tileMap.find(x => x.id === currId);
      if (t && t.type === 'slum' && t.buildingPlaced) {
        cluster.push(currId);
        t.adjacency.forEach(nbId => {
          const nbTile = tileMap.find(x => x.id === nbId);
          if (!visited.has(nbId) && nbTile && nbTile.type === 'slum' && nbTile.buildingPlaced) {
            queue.push(nbId);
          }
        });
      }
    }
    // 若 >=3 個相連的 slum => 為未加成的建築 +1
    if (cluster.length >= 3) {
      cluster.forEach(cid => {
        const slumTile = tileMap.find(x => x.id === cid);
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

  /* ========== 抽卡 & 回合機制 與以往相同 ========== */
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

  // 抽卡
  function drawCards() {
    cardPool.innerHTML = '';
    const possibleBuildings = ["建築A","建築B","建築C","建築D","建築E"];
    const arr = shuffle(possibleBuildings.slice()).slice(0, 5);
    arr.forEach((bName) => {
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

  // 初始化
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold  = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  endTurnBtn.addEventListener('click', () => {
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  document.addEventListener('keydown', (e) => {
    if (startScreen.style.display !== 'none' && (e.key === 'Enter' || e.key === 'NumpadEnter')) {
      startGame();
    }
  });

  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });
};

/* ========== 其餘段落(如特效)可自行擴充 ========== */

