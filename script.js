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
    { name: '淨水站', rarity: '普通', label: '河流', baseProduce: 4, specialAbility: '回合結束時，50%機率額外產出+1金幣' },
    { name: '星軌會館', rarity: '稀有', label: '繁華區', baseProduce: 6, specialAbility: '若無相鄰建築，則每回合額外+2金幣' }
  ];

  const labelEffectDesc = {
    "繁華區":"若此建築物蓋在繁華區，則回合結束時產出+4金幣",
    "貧民窟":"若此建築物蓋在貧民窟，相鄰帶貧民窟建築每座+1金幣",
    "河流":"若此建築物蓋在河流上，則回合結束時產出+3金幣",
    "荒原":"若此建築物未蓋在荒原地塊上，則回合結束時有50%機率不產出金幣"
  };

  function createBuildingCard(info){
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.type = 'building';
  card.dataset.produce = info.baseProduce;
  card.dataset.cardId = ++cardIdCounter;
  card.dataset.label = info.label;
  card.innerHTML = `
      <div class="card-gold-output">${info.baseProduce}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${info.name}</div>
      <div class="card-rarity">${info.rarity}</div>
      <div class="card-label">${info.label}</div>
      <div class="card-ability">${info.specialAbility ? info.specialAbility : ""}</div>
      <div class="tooltip">
          ${info.label}：${labelEffectDesc[info.label] || ""}
          ${info.specialAbility ? " / " + info.specialAbility : ""}
      </div>
  `;
  // 拖曳時手排卡隱藏與拖曳事件
  let dragClone = null;
  
  // 點選事件
  card.addEventListener('click', (e) => {
  // 如果正在拖曳，不處理 click
  if(card.getAttribute('data-dragging') === 'true'){
     return;
  }
  if(selectedCards.includes(card)){
      card.classList.remove('selected');
      selectedCards.splice(selectedCards.indexOf(card), 1);
  } else if(selectedCards.length < 2){
      card.classList.add('selected');
      selectedCards.push(card);
  }
});
  
  card.addEventListener('dragstart', e => {
      card.setAttribute('data-dragging', 'true');
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
      card.removeAttribute('data-dragging');
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
  const arr = shuffle(cardPoolData.slice());
  const five = arr.slice(0,5);
  five.forEach(info=>{
      const card = createBuildingCard(info);
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
  selectedCards.forEach(c => {
    const baseP = parseInt(c.dataset.produce) || 6;
    const cName = c.querySelector('.card-name').innerText;
    const cRarity = c.querySelector('.card-rarity').innerText;
    const cLabel = c.querySelector('.card-label').innerText;
    const cAbility = c.querySelector('.card-ability')?.innerText || "";

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
      <div class="card-ability">${cAbility}</div>
      <div class="tooltip">${cLabel}：${labelEffectDesc[cLabel] || ""}</div>
    `;
    newCard.draggable = true;
    let dragClone = null;

    newCard.addEventListener('dragstart', e => {
      // ...
    });
    newCard.addEventListener('dragend', e => {
      // ...
    });
    hand.appendChild(newCard);
  });
  // 完整結束 confirmDraw
  drawSection.style.display = 'none';
};
  
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
  // 記錄該建築的基礎產出與標籤（使用卡牌內的數值，不固定預設為6）
  tile.buildingBaseProduce = parseInt(cardElem.dataset.produce);
  tile.buildingLabel = cardElem.dataset.label;
  tile.buildingName = cardElem.querySelector('.card-name').innerText;
  
  // 依據地塊計算基本產出
  let produceVal = tile.buildingBaseProduce;
  if(tile.type === 'city') {
    produceVal += 2; // 城市地塊效果：+2
    if(cardElem.dataset.label === '繁華區'){
        produceVal += 4; // 若建築標籤為繁華區，再加 +4
    }
  }
  if(tile.type === 'river') produceVal -= 1;
  
  // 不再直接計算貧民窟相鄰加成與 BFS 群聚，此部分移至 recalcRevenueFromScratch()
  tile.buildingProduce = produceVal;
  tile.buildingPlaced = true;
    
  // 找到真正位於手排中的卡（以防 cardElem 為 clone）
  const realCardInHand = hand.querySelector(`[data-card-id="${cardElem.dataset.cardId}"]`);
  if(realCardInHand) {
    realCardInHand.remove();
  }  
  // 正確取得該地塊的 DOM（請確保這行下面不要有非註解的文字）
  const hex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
  if(!hex){
    console.error("找不到對應 tile 的 DOM，tile.id =", tile.id);
    return;
  }
    
  // 更新地塊顯示（包含能力）
  const bName = cardElem.querySelector('.card-name').innerText;
  const bAbility = cardElem.querySelector('.card-ability')?.innerText || "";
  hex.innerHTML = `<div class="hex-name">${bName}</div>
                   <div class="hex-ability">${bAbility}</div>`;
  
  // 放置完建築後，統一重新計算全地圖產出
  recalcRevenueFromScratch();
}


  function recalcRevenueFromScratch(){
  let total = 0;
  
  // (0) 重置所有 tile 的群聚加成標記
  tileMap.forEach(t => {
    t.slumBonusGranted = false;
  });
  
  // (1) 根據每塊 tile 的基礎產出與地塊屬性重新計算初步產出
  tileMap.forEach(t => {
    if(!t.buildingPlaced) return;
    
    // 使用 placeBuildingOnTile() 中記錄的基礎產出與標籤
    let baseP = t.buildingBaseProduce;  
    let label = t.buildingLabel;
    
    let produceVal = baseP;
    
    if(t.type === 'city'){
      produceVal += 2; // 城市地塊效果：+2
      if(label === '繁華區'){
        produceVal += 4; // 繁華區標籤加成：+4
      }
    } else if(t.type === 'river'){
  produceVal -= 1; // 河流地塊效果：-1
  if(label === '河流'){
    produceVal += 3; // 河流建築標籤額外效果：+3
  }
}
    // 將初步計算結果記回
    t.buildingProduce = produceVal;
  });
  
  // (2) 對所有 slum tile 執行 BFS，統一處理群聚加成：
  // 若連通集（cluster）的 slum tile 數量 ≥ 3，則該 cluster 中每塊 tile額外 +1
  let visited = new Set();
  tileMap.forEach(t => {
    if(!t.buildingPlaced || t.type !== 'slum') return;
    if(visited.has(t.id)) return;
    
    let queue = [t.id];
    let cluster = [];
    while(queue.length > 0){
      let currId = queue.shift();
      if(visited.has(currId)) continue;
      visited.add(currId);
      
      let currTile = tileMap.find(x => x.id === currId);
      if(!currTile || !currTile.buildingPlaced || currTile.type !== 'slum') continue;
      cluster.push(currTile);
      
      // 將所有鄰近 tile 加入隊列
      currTile.adjacency.forEach(nbId => {
        if(!visited.has(nbId)){
          queue.push(nbId);
        }
      });
    }
    
    // 若該 cluster 中有 ≥ 3 個 tile，則每塊額外 +1
    if(cluster.length >= 3){
      cluster.forEach(ct => {
        ct.buildingProduce += 1;
        ct.slumBonusGranted = true;
      });
    }
  });
  
  // (3) 對每塊 slum tile，若建築標籤為「貧民窟」，計算相鄰已放置建築的數量，每相鄰 +1 (最多 +5)
  tileMap.forEach(t => {
    if(!t.buildingPlaced) return;
    if(t.type === 'slum' && t.buildingLabel === '貧民窟'){
      let adjacentCount = 0;
      t.adjacency.forEach(nbId => {
        const nbTile = tileMap.find(x => x.id === nbId);
        if(nbTile && nbTile.buildingPlaced){
          adjacentCount++;
        }
      });
      let bonus = Math.min(adjacentCount, 5);
      t.buildingProduce += bonus;
    }
  });
  // (3.5) 處理建築物專屬特殊能力：淨水站 & 星軌會館
  tileMap.forEach(t => {
    if(!t.buildingPlaced) return;
    if(t.buildingName === '星軌會館'){
      let hasNeighbor = false;
      t.adjacency.forEach(nbId => {
        const nbTile = tileMap.find(x => x.id === nbId);
        if(nbTile && nbTile.buildingPlaced){
          hasNeighbor = true;
        }
      });
      if(!hasNeighbor){
        t.buildingProduce += 2;
      }
    }
  });
  
  // (4) 累加所有地塊最終產出
  tileMap.forEach(t => {
    if(t.buildingPlaced){
      total += t.buildingProduce;
    }
  });
  
  roundRevenue = total;
  updateResourceDisplay();
}
function computeEffectiveRevenue(){
  let effectiveTotal = 0;
  tileMap.forEach(t => {
    if(t.buildingPlaced){
      let eff = t.buildingProduce; // 這是 recalcRevenueFromScratch() 計算後的數值
      // 處理荒原能力：若建築標籤為 "荒原" 且所在地塊不是 wasteland，則50%機率產出為 0
      if(t.buildingLabel === '荒原' && t.type !== 'wasteland'){
        eff = (Math.random() < 0.5) ? 0 : eff;
      }
      // 處理淨水站能力：若建築名稱是 "淨水站"，則50%機率額外 +1金幣
      if(t.buildingName === '淨水站'){
         if(Math.random() < 0.5){
            eff += 1;
         }
      }
      effectiveTotal += eff;
    }
  });
  return effectiveTotal;
}
  /***********************
   * 回合結束
   ***********************/
  endTurnBtn.addEventListener('click', ()=>{
  // 使用 computeEffectiveRevenue() 計算實際回合產出 (含荒原隨機 50% 失效效果)
  let effectiveRevenue = computeEffectiveRevenue();
  currentGold += effectiveRevenue;
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
