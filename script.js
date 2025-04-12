// 確保只引用此一份 script.js
let cardIdCounter = 0;
window.onload = function() {
  /*******************
   * 1. 遊戲狀態
   *******************/
  let currentRound   = 1;
  let currentGold    = 0;
  let roundRevenue   = 0;
  let refreshCount   = 0;

  /*******************
   * 2. DOM 元素
   *******************/
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

  const selectedCards = [];

  /*******************
   * 3. 建立 31 塊地塊
   *******************/
  function createTileMap31() {
    const rows = [4,5,4,5,4,5,4];
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
      const count = rows[r];
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
   *******************/
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
   * 5. 絕對定位
   *******************/
  function initMapArea() {
    mapArea.innerHTML = '';
    const tileWidth = 80, tileHeight = 80;
    const verticalSpacing = tileHeight * 0.75;
    const offsetX = tileWidth / 2;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    const coords = tileMap.map(tile => {
      // odd row => shift left
      const shiftLeft = (tile.row % 2 === 1);
      const x = tile.col * tileWidth + (shiftLeft ? -offsetX : 0);
      const y = tile.row * verticalSpacing;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return {...tile, x, y};
    });
    const shapeW = maxX - minX + tileWidth;
    const shapeH = maxY - minY + tileHeight;
    const mapW = mapArea.clientWidth, mapH = mapArea.clientHeight;
    const centerX = (mapW - shapeW)/2;
    const centerY = (mapH - shapeH)/2;
    coords.forEach(c => {
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      if      (c.type === 'city')  hex.classList.add('city-tile');
      else if (c.type === 'slum')  hex.classList.add('slum-tile');
      else if (c.type === 'river') hex.classList.add('river-tile');
      else                         hex.classList.add('wasteland-tile');
      hex.dataset.tileId = c.id;
      hex.textContent    = '?';
      const px = c.x - minX + centerX;
      const py = c.y - minY + centerY;
      hex.style.left = px + 'px';
      hex.style.top  = py + 'px';
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
  initMapArea();

  /*******************
   * 6. 建築卡 (5選2)
   *******************/
  function createBuildingCard(buildingName) {
    const produceAmount = 6;
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
      <div class="card-rarity">普通</div>
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
    const buildings = ["建築A","建築B","建築C","建築D","建築E"];
    const drawn = shuffle(buildings.slice()).slice(0, 5);
    drawn.forEach(bName => {
      const card = createBuildingCard(bName);
      card.onclick = () => {
        // 最多選2張
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
   * 7. 放置建築 & 計算產出
   *******************/
  function placeBuildingOnTile(tile, cardElem) {
    if (tile.buildingPlaced) {
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce   = 0;
      tile.slumBonusGranted  = false;
    }
    let produceVal = parseInt(cardElem.dataset.produce) || 6;
    if (tile.type === 'city') produceVal += 2;
    if (tile.type === 'river') produceVal -= 1;
    tile.buildingProduce = produceVal;
    tile.buildingPlaced  = true;

    // 在地塊上顯示卡名
    const hexEl = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hexEl.textContent = cardElem.querySelector('.card-name').innerText;
    cardElem.remove();

    // 若是貧民窟 => 檢查「3 塊以上互相相連」(集群)
    if (tile.type === 'slum') {
      recalcSlumBonus();
    }
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  /**
   * recalcSlumBonus：找出所有連通的貧民窟 (BFS/DFS)，若該連通集成員數 ≥3，則整個集群的建築各 +1。
   * 並防止多次疊加 => 使用 tile.slumBonusGranted
   */
  function recalcSlumBonus() {
    // 先把所有貧民窟 bonus 狀態重製 => 之後再重新計算
    tileMap.forEach(t => {
      if (t.type === 'slum' && t.buildingPlaced && t.slumBonusGranted) {
        roundRevenue -= t.buildingProduce;
        t.buildingProduce -= 1;  // 去掉舊的 +1
        t.slumBonusGranted = false;
        roundRevenue += t.buildingProduce;
      }
    });

    // 使用 BFS/DFS 找出連通集
    let visited = new Set();
    tileMap.forEach(tile => {
      if (tile.type === 'slum' && tile.buildingPlaced && !visited.has(tile.id)) {
        // 找出與 tile 同一連通集
        let cluster = [];
        let queue   = [tile.id];
        while (queue.length > 0) {
          const currId = queue.shift();
          if (visited.has(currId)) continue;
          visited.add(currId);

          const currTile = tileMap.find(x => x.id===currId);
          if (currTile && currTile.type==='slum' && currTile.buildingPlaced) {
            cluster.push(currTile);
            currTile.adjacency.forEach(nbId => {
              if (!visited.has(nbId)) {
                queue.push(nbId);
              }
            });
          }
        }
        // 若此連通集大小≥3 => 為整個集群成員加 +1
        if (cluster.length >= 3) {
          cluster.forEach(ct => {
            if (!ct.slumBonusGranted) {
              roundRevenue -= ct.buildingProduce;
              ct.buildingProduce += 1;
              ct.slumBonusGranted = true;
              roundRevenue += ct.buildingProduce;
            }
          });
        }
      }
    });
    updateResourceDisplay();
  }

  /*******************
   * 8. 回合流程 & UI
   *******************/
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

  function startGame() {
    startScreen.style.display = 'none';
    currentRound   = 1;
    currentGold    = 0;
    roundRevenue   = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }
  document.addEventListener('keydown', (e) => {
    if (startScreen.style.display !== 'none' && (e.key==='Enter' || e.key==='NumpadEnter')) {
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

