// 確保只引用此一份 script.js
let cardIdCounter = 0;

window.onload = function() {
  /*******************
   * 1. 遊戲狀態
   *******************/
  let currentRound = 1;
  let currentGold = 0;
  let roundRevenue = 0;
  let refreshCount = 0;

  /*******************
   * 2. 取得 DOM 元素
   *******************/
  const startScreen = document.getElementById('start-screen');
  const drawSection = document.getElementById('draw-section');
  const cardPool = document.getElementById('card-pool');
  const hand = document.getElementById('hand');
  const mapArea = document.getElementById('map-area');
  const roundNumberElem = document.getElementById('round-number');
  const endTurnBtn = document.getElementById('end-turn-btn');
  const goldAmountElem = document.getElementById('gold-amount');
  const roundGoldElem = document.getElementById('round-gold');
  const refreshBtn = document.getElementById('refresh-btn');
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  const closeInfoBtn = document.getElementById('close-info-btn');
  const selectedCards = [];

  /*******************
   * 3. 建立 31 塊地塊 (排列：7行，個數依序：4,5,4,5,4,5,4)
   * 編號依行依序遞增。例如：第一行編號 1~4；第二行 5~9；第三行 10~13；以此類推。
   * 對照類型依要求：
   *  1:荒原, 2:荒原, 3:荒原, 4:荒原,
   *  5:荒原, 6:貧民窟, 7:貧民窟, 8:荒原, 9:河流, 10:貧民窟,
   *  11:繁華區, 12:貧民窟, 13:河流, 14:貧民窟, 15:繁華區, 16:繁華區,
   *  17:河流, 18:荒原, 19:貧民窟, 20:貧民窟, 21:河流, 22:荒原,
   *  23:荒原, 24:貧民窟, 25:河流, 26:荒原, 27:荒原, 28:荒原, 29:河流,
   *  30:荒原, 31:荒原
   *******************/
  function createTileMap31() {
    const rows = [4, 5, 4, 5, 4, 5, 4];
    const typeMapping = {
      1:'wasteland', 2:'wasteland', 3:'wasteland', 4:'wasteland',
      5:'wasteland', 6:'slum', 7:'slum', 8:'wasteland', 9:'river', 10:'slum',
      11:'city', 12:'slum', 13:'river', 14:'slum', 15:'city', 16:'city',
      17:'river', 18:'wasteland', 19:'slum', 20:'slum', 21:'river', 22:'wasteland',
      23:'wasteland', 24:'slum', 25:'river', 26:'wasteland', 27:'wasteland', 28:'wasteland', 29:'river',
      30:'wasteland', 31:'wasteland'
    };
    let tiles = [];
    let idCounter = 1;
    for (let r = 0; r < rows.length; r++) {
      let count = rows[r];
      for (let c = 0; c < count; c++) {
        tiles.push({
          id: idCounter,
          row: r,
          col: c,
          type: typeMapping[idCounter],
          buildingProduce: 0,
          buildingPlaced: false,
          slumBonusGranted: false,
          adjacency: []
        });
        idCounter++;
      }
    }
    return tiles;
  }
  let tileMap = createTileMap31();

  /*******************
   * 4. 計算鄰接 (odd-r offset)
   * 本版本採用：行數若為偶數 (row 0,2,4,6) 不偏移，若為奇數 (row1,3,5) 向左移一格，
   * 鄰接方向則依此設定：
   *   - 對於偶數行使用 directionsEven
   *   - 對於奇數行使用 directionsOdd
   *******************/
  const directionsEven = [ // row 為偶數
    { dr: -1, dc: 0 },
    { dr: -1, dc: +1 },
    { dr: 0,  dc: -1 },
    { dr: 0,  dc: +1 },
    { dr: +1, dc: 0 },
    { dr: +1, dc: +1 }
  ];
  const directionsOdd = [ // row 為奇數
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: 0,  dc: -1 },
    { dr: 0,  dc: +1 },
    { dr: +1, dc: -1 },
    { dr: +1, dc: 0 }
  ];
  function computeAdjacency() {
    tileMap.forEach(tile => {
      const dirSet = (tile.row % 2 === 0) ? directionsEven : directionsOdd;
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
  computeAdjacency();

  /*******************
   * 5. 以絕對定位置中地圖
   *    此處：每行若為奇數 (row1,3,5) 往左移 offsetX
   *******************/
  function initMapArea() {
    mapArea.innerHTML = '';
    const tileWidth = 80, tileHeight = 80;
    const verticalSpacing = tileHeight * 0.75;
    const offsetX = tileWidth / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const coords = tileMap.map(tile => {
      const shiftLeft = (tile.row % 2 === 1); // 奇數行向左移
      const x = tile.col * tileWidth + (shiftLeft ? -offsetX : 0);
      const y = tile.row * verticalSpacing;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return { ...tile, x, y };
    });
    const shapeWidth = maxX - minX + tileWidth;
    const shapeHeight = maxY - minY + tileHeight;
    const mapW = mapArea.clientWidth;
    const mapH = mapArea.clientHeight;
    const centerOffsetX = (mapW - shapeWidth) / 2;
    const centerOffsetY = (mapH - shapeHeight) / 2;
    coords.forEach(c => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      if (c.type === 'city') hex.classList.add('city-tile');
      else if (c.type === 'slum') hex.classList.add('slum-tile');
      else if (c.type === 'river') hex.classList.add('river-tile');
      else hex.classList.add('wasteland-tile');
      hex.dataset.tileId = c.id;
      hex.textContent = '?';
      const px = c.x - minX + centerOffsetX;
      const py = c.y - minY + centerOffsetY;
      hex.style.left = px + 'px';
      hex.style.top  = py + 'px';
      hex.ondragover = (e) => e.preventDefault();
      hex.ondrop = (e) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElem) return;
        placeBuildingOnTile(c, cardElem);
      };
      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  /*******************
   * 6. UI 更新函式
   *******************/
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }
  function updateResourceDisplay() {
    goldAmountElem.innerText = currentGold;
    roundGoldElem.innerText = roundRevenue;
  }
  function updateRefreshButton() {
    const cost = 2 * (refreshCount + 1);
    refreshBtn.textContent = `刷新卡片(${cost} 金幣)`;
  }

  /*******************
   * 7. 建築卡生成與抽卡 (5選2)
   *******************/
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
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', buildingName);
    });
    return card;
  }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function drawCards() {
    cardPool.innerHTML = '';
    const possibleBuildings = ["建築A", "建築B", "建築C", "建築D", "建築E"];
    const drawn = shuffle(possibleBuildings.slice()).slice(0, 5);
    drawn.forEach(bName => {
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
    if (selectedCards.length < 2) {
      alert("請至少選擇 2 張卡牌！");
      return;
    }
    selectedCards.forEach(c => {
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

  /*******************
   * 8. 放置建築與計算產能
   *******************/
  function placeBuildingOnTile(tile, cardElem) {
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce = 0;
      tile.slumBonusGranted = false;
    }
    let produceVal = parseInt(cardElem.dataset.produce) || 6;
    if (tile.type === 'city') produceVal += 2;
    if (tile.type === 'river') produceVal -= 1;
    tile.buildingProduce = produceVal;
    tile.buildingPlaced = true;
    const hexEl = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hexEl.textContent = cardElem.querySelector('.card-name').innerText;
    cardElem.remove();
    // 若該 tile 為貧民窟，重新計算貧民窟加成（根據新要求：若該貧民窟至少有2個相鄰貧民窟建築則加1）
    if (tile.type === 'slum') {
      recalcSlumBonuses();
    }
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }
  // 針對所有 slum tile 進行重新計算
  function recalcSlumBonuses() {
    tileMap.forEach(tile => {
      if (tile.type === 'slum' && tile.buildingPlaced) {
        let adjacentCount = 0;
        tile.adjacency.forEach(nbId => {
          const nb = tileMap.find(t => t.id === nbId);
          if (nb && nb.type === 'slum' && nb.buildingPlaced) {
            adjacentCount++;
          }
        });
        if (adjacentCount >= 2 && !tile.slumBonusGranted) {
          roundRevenue -= tile.buildingProduce;
          tile.buildingProduce += 1;
          tile.slumBonusGranted = true;
          roundRevenue += tile.buildingProduce;
        } else if (adjacentCount < 2 && tile.slumBonusGranted) {
          // 若條件失效，移除加成（可選）
          roundRevenue -= tile.buildingProduce;
          tile.buildingProduce -= 1;
          tile.slumBonusGranted = false;
          roundRevenue += tile.buildingProduce;
        }
      }
    });
    updateResourceDisplay();
  }

  /*******************
   * 9. 回合流程與 UI 更新
   *******************/
  function updateRoundDisplay() {
    roundNumberElem.innerText = currentRound;
  }
  function updateResourceDisplay() {
    goldAmountElem.innerText = currentGold;
    roundGoldElem.innerText = roundRevenue;
  }
  function updateRefreshButton() {
    const cost = 2 * (refreshCount + 1);
    refreshBtn.textContent = `刷新卡片(${cost} 金幣)`;
  }

  /*******************
   * 10. 遊戲流程
   *******************/
  function startGame() {
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }
  document.addEventListener('keydown', e => {
    if (startScreen.style.display !== 'none' && (e.key === 'Enter' || e.key === 'NumpadEnter')) {
      startGame();
    }
  });
  endTurnBtn.addEventListener('click', () => {
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
};

