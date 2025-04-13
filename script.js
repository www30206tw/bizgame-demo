let cardIdCounter = 0;
window.onload = function(){
  let currentRound = 1;
  let currentGold = 0;
  let roundRevenue = 0;
  let refreshCount = 0;

  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('startBtn');
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

  /***********************
   * 建立 31 塊地塊 (7行: 4,5,4,5,4,5,4)
   ***********************/
  function createTileMap31(){
    const rows = [4,5,4,5,4,5,4];
    const typeMapping = {
      1:'wasteland',2:'wasteland',3:'wasteland',4:'wasteland',
      5:'wasteland',6:'slum',7:'slum',8:'wasteland',9:'river',10:'slum',
      11:'city',12:'slum',13:'river',14:'slum',15:'city',16:'city',
      17:'river',18:'wasteland',19:'slum',20:'slum',21:'river',22:'wasteland',
      23:'wasteland',24:'slum',25:'river',26:'wasteland',27:'wasteland',28:'wasteland',29:'river',
      30:'wasteland',31:'wasteland'
    };
    let map = [];
    let idCounter = 1;
    for(let r=0; r<rows.length; r++){
      const count = rows[r];
      for(let c=0; c<count; c++){
        map.push({
          id: idCounter,
          row: r,
          col: c,
          type: typeMapping[idCounter],
          buildingProduce: 0,
          buildingPlaced: false,
          slumBonusGranted: false,
          adjacency: [],
          x:0, y:0
        });
        idCounter++;
      }
    }
    return map;
  }
  let tileMap = createTileMap31();

  /***********************
   * 計算鄰接 (odd‑r offset)
   ***********************/
  const directionsEven = [
    {dr:-1,dc:0}, {dr:-1,dc:1}, {dr:0,dc:-1}, {dr:0,dc:1}, {dr:1,dc:0}, {dr:1,dc:1}
  ];
  const directionsOdd = [
    {dr:-1,dc:-1}, {dr:-1,dc:0}, {dr:0,dc:-1}, {dr:0,dc:1}, {dr:1,dc:-1}, {dr:1,dc:0}
  ];
  function computeAdj(){
    tileMap.forEach(tile=>{
      const dirSet = (tile.row % 2 === 0) ? directionsEven : directionsOdd;
      dirSet.forEach(d=>{
        const nr = tile.row + d.dr;
        const nc = tile.col + d.dc;
        const nb = tileMap.find(x => x.row === nr && x.col === nc);
        if(nb){
          tile.adjacency.push(nb.id);
        }
      });
    });
  }
  computeAdj();

  /***********************
   * 絕對定位並置中
   ***********************/
  function initMapArea(){
    mapArea.innerHTML = '';
    const tileW = 80, tileH = 80;
    const verticalSpacing = tileH * 0.75;
    const offsetX = tileW / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    tileMap.forEach(tile=>{
      const shiftLeft = (tile.row % 2 === 1);
      tile.x = tile.col * tileW + (shiftLeft ? -offsetX : 0);
      tile.y = tile.row * verticalSpacing;
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
    });
    const shapeW = maxX - minX + tileW;
    const shapeH = maxY - minY + tileH;
    const mapW = mapArea.clientWidth, mapH = mapArea.clientHeight;
    const centerX = (mapW - shapeW) / 2;
    const centerY = (mapH - shapeH) / 2;

    tileMap.forEach(tile=>{
      const hex = document.createElement('div');
      hex.className = 'hex-tile';
      if(tile.type==='city') hex.classList.add('city-tile');
      else if(tile.type==='slum') hex.classList.add('slum-tile');
      else if(tile.type==='river') hex.classList.add('river-tile');
      else hex.classList.add('wasteland-tile');

      hex.dataset.tileId = tile.id;
      hex.textContent = '?';

      const px = tile.x - minX + centerX;
      const py = tile.y - minY + centerY;
      hex.style.left = px + 'px';
      hex.style.top = py + 'px';

      hex.ondragover = e => e.preventDefault();
      hex.ondrop = e => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        const cardElem = hand.querySelector(`[data-card-id="${cardId}"]`);
        if(!cardElem)return;
        placeBuildingOnTile(tile, cardElem);
      };

      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  /***********************
   * UI 更新函式
   ***********************/
  function updateRoundDisplay(){
    roundNumberElem.innerText = currentRound;
  }
  function updateResourceDisplay(){
    goldAmountElem.innerText = currentGold;
    roundGoldElem.innerText = roundRevenue;
  }
  function updateRefreshButton(){
    const cost = 2 * (refreshCount + 1);
    refreshBtn.textContent = `刷新卡片(${cost} 金幣)`;
  }

  /*******************************
   * 建築卡池 (固定 8 張)
   *******************************/
  const cardPoolData = [
    { name:'建築A', rarity:'普通',  label:'荒原',   baseProduce:6 },
    { name:'建築B', rarity:'普通',  label:'貧民窟', baseProduce:6 },
    { name:'建築C', rarity:'稀有',  label:'荒原',   baseProduce:6 },
    { name:'建築D', rarity:'稀有',  label:'貧民窟', baseProduce:6 },
    { name:'建築E', rarity:'史詩',  label:'繁華區', baseProduce:6 },
    { name:'建築F', rarity:'史詩',  label:'河流',   baseProduce:6 },
    { name:'建築G', rarity:'傳說',  label:'繁華區', baseProduce:6 },
    { name:'建築H', rarity:'傳說',  label:'河流',   baseProduce:6 },
  ];

  const labelEffectDesc = {
    "繁華區":"若此建築物蓋在繁華區，則回合結束時產出+4金幣",
    "貧民窟":"若此建築物蓋在貧民窟，相鄰帶貧民窟建築每座+1金幣",
    "河流":"若此建築物蓋在河流上，則回合結束時+3金幣，且周圍隨機一座建築產出翻倍",
    "荒原":"若此建築物蓋在荒原上，50%不產出，50%地塊轉為貧民窟"
  };

  function createBuildingCard(info){
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.type = 'building';
    card.dataset.produce = info.baseProduce;
    card.dataset.cardId = ++cardIdCounter;
    // 記錄標籤
    card.dataset.label = info.label;
    card.innerHTML = `
      <div class="card-gold-output">${info.baseProduce}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${info.name}</div>
      <div class="card-rarity">${info.rarity}</div>
      <div class="card-label">${info.label}</div>
      <div class="tooltip">${info.label}：${labelEffectDesc[info.label] || ""}</div>
    `;
    // 拖曳時手排卡隱藏
     let dragClone = null;
card.addEventListener('dragstart', e => {
  e.dataTransfer.setData('cardId', card.dataset.cardId);
  e.dataTransfer.setData('text/plain', info.name);
  dragClone = card.cloneNode(true);
  dragClone.style.position = 'absolute';
  dragClone.style.left = '-9999px';
  dragClone.style.top = '-9999px';
  document.body.appendChild(dragClone);
  e.dataTransfer.setDragImage(dragClone, 0, 0);
  setTimeout(() => { card.style.display = 'none'; }, 0);
});
card.addEventListener('dragend', e => {
  card.style.display = '';
  if (dragClone) {
    document.body.removeChild(dragClone);
    dragClone = null;
  }
});
    return card;
  }

  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function drawCards(){
    cardPool.innerHTML = '';
    // 從 8 張牌中隨機取 5 張
    const arr = shuffle(cardPoolData.slice());
    const five = arr.slice(0,5);
    five.forEach(info=>{
      const card = createBuildingCard(info);
      card.onclick = ()=>{
        if(selectedCards.includes(card)){
          card.classList.remove('selected');
          selectedCards.splice(selectedCards.indexOf(card),1);
        } else if(selectedCards.length < 2){
          card.classList.add('selected');
          selectedCards.push(card);
        }
      };
      cardPool.appendChild(card);
    });
  }

  window.refreshCards = function(){
    const cost = 2 * (refreshCount + 1);
    if(currentGold < cost){
      alert("金幣不足，無法刷新!");
      return;
    }
    currentGold -= cost;
    refreshCount++;
    updateResourceDisplay();
    updateRefreshButton();
    selectedCards.length = 0;
    drawCards();
  };

  window.skipDraw = function(){
    currentGold += 10;
    updateResourceDisplay();
    drawSection.style.display = 'none';
  };

  window.confirmDraw = function(){
    if(selectedCards.length < 2){
      alert("請至少選擇 2 張卡牌!");
      return;
    }
    // 依選擇複製卡牌進入手排
    selectedCards.forEach(c => {
      const baseP = parseInt(c.dataset.produce) || 6;
      const cName = c.querySelector('.card-name').innerText;
      const cRarity = c.querySelector('.card-rarity').innerText;
      const cLabel = c.querySelector('.card-label').innerText;
      const newCard = document.createElement('div');
      newCard.className = 'card';
      newCard.dataset.type = 'building';
      newCard.dataset.produce = baseP;
      newCard.dataset.cardId = ++cardIdCounter;
      newCard.dataset.label = cLabel;
      newCard.innerHTML = `
        <div class="card-gold-output">${baseP}</div>
        <div class="card-image-area"></div>
        <div class="card-name">${cName}</div>
        <div class="card-rarity">${cRarity}</div>
        <div class="card-label">${cLabel}</div>
        <div class="tooltip">${cLabel}：${labelEffectDesc[cLabel] || ""}</div>
      `;
      newCard.draggable = true;
      let dragClone = null;
newCard.addEventListener('dragstart', e => {
  e.dataTransfer.setData('cardId', newCard.dataset.cardId);
  e.dataTransfer.setData('text/plain', cName);

  // 建立拖曳預覽的克隆物件
  dragClone = newCard.cloneNode(true);
  dragClone.style.position = 'absolute';
  dragClone.style.left = '-9999px';
  dragClone.style.top = '-9999px';

  // 隱藏克隆中的 tooltip（保留 DOM 結構但不顯示）
  const tooltipElem = dragClone.querySelector('.tooltip');
  if (tooltipElem) {
    tooltipElem.style.display = 'none';
  }

  document.body.appendChild(dragClone);

  // 計算使用者點擊位置相對於卡牌左上角的偏移
  const rect = newCard.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  
  // 傳入正確的偏移量
  e.dataTransfer.setDragImage(dragClone, offsetX, offsetY);

  setTimeout(() => { newCard.style.display = 'none'; }, 0);
});

newCard.addEventListener('dragend', e => {
  newCard.style.display = '';
  if (dragClone) {
    document.body.removeChild(dragClone);
    dragClone = null;
  }
});
      hand.appendChild(newCard);
    });
    drawSection.style.display = 'none';
  };

  window.startDrawPhase = function(){
    refreshCount = 0;
    selectedCards.length = 0;
    updateRefreshButton();
    drawSection.style.display = 'flex';
    drawCards();
  };

  /***********************
   * placeBuildingOnTile (放置建築)
   ***********************/
  function placeBuildingOnTile(tile, cardElem){
    console.log(`placeBuildingOnTile => tile#${tile.id} type=${tile.type}`);
    // 若已有建築先扣除
    if(tile.buildingPlaced){
      roundRevenue -= tile.buildingProduce;
      tile.buildingProduce = 0;
      tile.slumBonusGranted = false;
    }
    tile.buildingBaseProduce = parseInt(cardElem.dataset.produce) || 6;
    tile.buildingLabel = cardElem.dataset.label || "";
    // 接著依據地塊計算產出
    let produceVal = tile.buildingBaseProduce;
    if(tile.type === 'city') {
    produceVal += 2; // 調整城市地塊基礎效果為 +2
    // 如果建築標籤為「繁華區」，額外增加 +4
    if(cardElem.dataset.label === '繁華區'){
        produceVal += 4;
    }
}
if(tile.type === 'river') produceVal -= 1;
    // 新增：如果建築的標籤為「貧民窟」且地塊類型也是 slum，則每相鄰一棟已放置建築，產出加 1 金幣（最多 +5）
if(tile.type === 'slum' && cardElem.dataset.label === '貧民窟'){
    let adjacentCount = 0;
    tile.adjacency.forEach(nbId => {
        const nbTile = tileMap.find(t => t.id === nbId);
        if(nbTile && nbTile.buildingPlaced){
            adjacentCount++;
        }
    });
    let bonus = Math.min(adjacentCount, 5);
    produceVal += bonus;
}
    tile.buildingProduce = produceVal;
    tile.buildingPlaced = true;
    // 將手牌的卡牌從手排移除，並在地塊上顯示卡名
    const hex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    const bName = cardElem.querySelector('.card-name').innerText;
    hex.textContent = bName;
    cardElem.remove();

    // 如果是 slum，計算 BFS cluster
    if(tile.type==='slum'){
      checkSlumClusterAndAddBonus(tile.id);
    } else {
      roundRevenue += tile.buildingProduce;
      updateResourceDisplay();
    }
  }

  // BFS：對於 slum tile 的連通集，若數量>=3，則每塊 +1 (只加一次)
  function checkSlumClusterAndAddBonus(startId){
    const visited = new Set();
    const queue = [startId];
    const cluster = [];
    while(queue.length > 0){
      const currId = queue.shift();
      if(visited.has(currId)) continue;
      visited.add(currId);
      const currTile = tileMap.find(x=>x.id===currId);
      if(currTile && currTile.type==='slum' && currTile.buildingPlaced){
        cluster.push(currTile);
        currTile.adjacency.forEach(nbId=>{
          const nbTile = tileMap.find(x=>x.id===nbId);
          if(nbTile && nbTile.type==='slum' && nbTile.buildingPlaced && !visited.has(nbId)){
            queue.push(nbId);
          }
        });
      }
    }
    console.log("cluster found =>", cluster.map(x=>x.id));
    if(cluster.length >= 3){
      cluster.forEach(ct=>{
        if(!ct.slumBonusGranted){
          ct.buildingProduce += 1;
          ct.slumBonusGranted = true;
        }
      });
    }
    recalcRevenueFromScratch();
  }

  function recalcRevenueFromScratch(){
    let sum = 0;
    tileMap.forEach(t=>{
      if(t.buildingPlaced){
        sum += t.buildingProduce;
      }
    });
    roundRevenue = sum;
    updateResourceDisplay();
  }

  /***********************
   * 回合結束
   ***********************/
  endTurnBtn.addEventListener('click', ()=>{
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  /***********************
   * 開始遊戲 (Enter 或 按鈕)
   ***********************/
  document.addEventListener('keydown', e=>{
    console.log("keydown:", e.key, "startScreen.style.display=", startScreen.style.display);
    if(startScreen.style.display !== 'none' && (e.key === 'Enter' || e.key === 'NumpadEnter')){
      startGame();
    }
  });
  startBtn.addEventListener('click', ()=>{
    console.log("startBtn clicked.");
    startGame();
  });
  function startGame(){
    startScreen.style.display = 'none';
    currentRound = 1;
    currentGold = 0;
    roundRevenue = 0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  /***********************
   * info
   ***********************/
  infoBtn.addEventListener('click', ()=>{
    infoModal.style.display = 'flex';
  });
  closeInfoBtn.addEventListener('click', ()=>{
    infoModal.style.display = 'none';
  });
};
