// ----------------------------------------
// script.js
// ----------------------------------------

let cardIdCounter = 0;
let currentRound = 1;
let currentGold = 0;
let roundRevenue = 0;
let refreshCount = 0;

const rows = [4,5,4,5,4,5,4];
const typeMapping = {
  1:'wasteland', 2:'wasteland', 3:'wasteland', 4:'wasteland',
  5:'wasteland', 6:'slum',      7:'slum',      8:'wasteland',
  9:'river',     10:'slum',     11:'city',     12:'slum',
  13:'river',    14:'slum',     15:'city',     16:'city',
  17:'river',    18:'wasteland',19:'slum',     20:'slum',
  21:'river',    22:'wasteland',23:'wasteland',24:'slum',
  25:'river',    26:'wasteland',27:'wasteland',28:'wasteland',
  29:'river',    30:'wasteland',31:'wasteland'
};

const cardPoolData = [
  { name:'建築A', rarity:'普通', label:'荒原',      baseProduce:6 },
  { name:'建築B', rarity:'普通', label:'貧民窟',    baseProduce:6 },
  { name:'建築C', rarity:'稀有', label:'荒原',      baseProduce:6 },
  { name:'建築D', rarity:'稀有', label:'貧民窟',    baseProduce:6 },
  { name:'建築E', rarity:'史詩', label:'繁華區',    baseProduce:6 },
  { name:'建築F', rarity:'史詩', label:'河流',      baseProduce:6 },
  { name:'建築G', rarity:'傳說', label:'繁華區',    baseProduce:6 },
  { name:'建築H', rarity:'傳說', label:'河流',      baseProduce:6 },
  { name:'淨水站', rarity:'普通', label:'河流',     baseProduce:4, specialAbility:'50%機率額外+1' },
  { name:'星軌會館', rarity:'稀有', label:'繁華區',  baseProduce:6, specialAbility:'無鄰居額外+2' },
  { name:'建築A', rarity:'普通', label:'荒原',      baseProduce:6 },
  { name:'摩天坊', rarity:'普通', label:'繁華區', baseProduce:5 },
  { name:'集貧居', rarity:'普通', label:'貧民窟', baseProduce:4 },
  { name:'廢土站', rarity:'普通', label:'荒原',   baseProduce:3 },
  { name:'廢材棚', rarity:'普通', label:'荒原',   baseProduce:4 },
  { name:'社群站', rarity:'普通', label:'貧民窟', baseProduce:4, specialAbility:'有鄰居額外+1' },
  { name:'彈出商亭', rarity:'普通', label:'繁華區', baseProduce:5, specialAbility:'邊緣格額外+1' },
  { name:'地脈節點', rarity:'普通', label:'荒原', baseProduce:6, specialAbility:'鄰2族群+1' },
  { name:'匯聚平臺', rarity:'稀有', label:'貧民窟', baseProduce:5, specialAbility:'≥3鄰額外+2' },
   { name:'流動站',   rarity:'稀有', label:'河流',   baseProduce:5, specialAbility:'河流鄰格+1' },
   { name:'焚料方艙', rarity:'稀有', label:'荒原',   baseProduce:8, specialAbility:'偶數回合−1，最低4' }
];

const labelEffectDesc = {
  "繁華區":"蓋在繁華區時+4",
  "貧民窟":"相鄰貧民窟建築每座+1",
  "河流":"蓋在河流時+3",
  "荒原":"非荒原地塊50%機率不產出"
};

const directionsEven = [
  {dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:-1},
  {dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}
];
const directionsOdd = [
  {dr:-1,dc:-1},{dr:-1,dc:0},{dr:0,dc:-1},
  {dr:0,dc:1},{dr:1,dc:-1},{dr:1,dc:0}
];

let tileMap = [];

// 工具函式
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 建立地圖資料
function createTileMap31(){
  let map = [];
  let id = 1;
  rows.forEach((count, r) => {
    for (let c = 0; c < count; c++, id++) {
      map.push({
        id, row:r, col:c,
        type:typeMapping[id],
        buildingProduce:0,
        buildingPlaced:false,
        slumBonusGranted:false,
        adjacency:[], x:0, y:0
      });
    }
  });
  return map;
}

// 計算鄰接清單 (odd-r offset)
function computeAdj(){
  tileMap.forEach(tile => {
    const dirs = (tile.row % 2 === 0) ? directionsEven : directionsOdd;
    dirs.forEach(d => {
      const nb = tileMap.find(t => t.row === tile.row + d.dr && t.col === tile.col + d.dc);
      if (nb) tile.adjacency.push(nb.id);
    });
  });
}

// 將地圖渲染到畫面
function initMapArea(){
  const mapArea = document.getElementById('map-area');
  mapArea.innerHTML = '';
  const tileW = 80, tileH = 80, vSpace = tileH * 0.75, offX = tileW/2;
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  tileMap.forEach(t => {
    const shift = (t.row % 2 === 1) ? -offX : 0;
    t.x = t.col * tileW + shift;
    t.y = t.row * vSpace;
    minX = Math.min(minX, t.x);
    maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y);
    maxY = Math.max(maxY, t.y);
  });
  const shapeW = maxX - minX + tileW, shapeH = maxY - minY + tileH;
  const centerX = (mapArea.clientWidth - shapeW)/2;
  const centerY = (mapArea.clientHeight - shapeH)/2;
  const hoverCover = document.getElementById('hcover');

  tileMap.forEach(t => {
    const hex = document.createElement('div');
    hex.className = `hex-tile ${t.type}-tile`;
    hex.dataset.tileId = t.id;
    hex.textContent = '?';
    hex.style.left = (t.x - minX + centerX) + 'px';
    hex.style.top  = (t.y - minY + centerY) + 'px';
    hex.ondragover = e => e.preventDefault();
    hex.ondrop = e => {
      e.preventDefault();
      const cid = e.dataTransfer.getData('cardId');
      const card = document.querySelector(`[data-card-id="${cid}"]`);
      if (card) placeBuildingOnTile(t, card);
    };
    
    // 滑鼠移入：顯示懸浮窗
    hex.addEventListener('mouseenter', () => {
      // 找到對應的 tile 物件
      const tileData = tileMap.find(t => t.id === t.id && String(t.id) === hex.dataset.tileId);
      let html = '';
      if (!tileData.buildingPlaced) {
     // 空地上顯示地塊類型
        html = `<div>地塊類型：${tileData.type}</div>`;
      } else {
     // 已有建築：顯示建築名稱 + 本回合產出
        html = `
          <div>建築：${tileData.buildingName}</div>
          <div>本回合產出：${tileData.buildingProduce}</div>
        `;
      }
      hoverCover.innerHTML = html;
   // 計算位置：放在 hex 右方 5px
      const rect = hex.getBoundingClientRect();
      hoverCover.style.top = `${rect.top}px`;
      hoverCover.style.left = `${rect.right + 5}px`;
      hoverCover.style.display = 'block';
    });

    // 滑鼠移出：隱藏懸浮窗
    hex.addEventListener('mouseleave', () => {
      hoverCover.style.display = 'none';
    });

     mapArea.appendChild(hex);
  });
}

// 更新 UI 顯示
function updateRoundDisplay(){ document.getElementById('round-number').innerText = currentRound; }
function updateResourceDisplay(){
  document.getElementById('gold-amount').innerText = currentGold;
  document.getElementById('round-gold').innerText = roundRevenue;
}
function updateRefreshButton(){
  const cost = 2 * (refreshCount + 1);
  document.getElementById('refresh-btn').textContent = `刷新卡片(${cost} 金幣)`;
}

// 建築卡牌生成
function createBuildingCard(info){
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.produce = info.baseProduce;
  card.dataset.cardId = ++cardIdCounter;
  card.dataset.label = info.label;
  card.innerHTML = `
    <div class="card-gold-output">${info.baseProduce}</div>
    <div class="card-image-area"></div>
    <div class="card-name">${info.name}</div>
    <div class="card-rarity">${info.rarity}</div>
    <div class="card-label">${info.label}</div>
    <div class="card-ability">${info.specialAbility||''}</div>
    <div class="tooltip">
      ${info.label}：${labelEffectDesc[info.label]||''}
      ${info.specialAbility?'/'+info.specialAbility:''}
    </div>`;
  // 點選選牌
  card.onclick = () => {
    card.classList.toggle('selected');
  };
  // 拖曳
  card.draggable = true;
  card.addEventListener('dragstart', e => {
  // 1. 設定拖曳資料
  e.dataTransfer.setData('cardId', card.dataset.cardId);
  
  // 1.1 暫時隱藏這張卡牌的 tooltip，以免出現在 drag image 上
  const tip = card.querySelector('.tooltip');
  if (tip) tip.style.display = 'none';

  // 2. 只對「抽卡區」(#card-pool) 隱藏其他卡牌
  const pool = document.getElementById('card-pool');
  if (pool.contains(card)) {
    pool.querySelectorAll('.card').forEach(c => {
      if (c !== card) c.style.visibility = 'hidden';
    });
  }

  // 3. 強制 drag image 使用本體
  e.dataTransfer.setDragImage(card, card.clientWidth/2, card.clientHeight/2);

  // 3.1 拖曳啟動後，延遲隱藏手排中的自己（拿在手上）
  setTimeout(() => {
  const hand = document.getElementById('hand');
  if (hand.contains(card)) {
    card.style.display = 'none';
  }
}, 0);
});

 card.addEventListener('dragend', e => {
  // 先把自身 tooltip 還原
  const tip = card.querySelector('.tooltip');
  if (tip) tip.style.display = '';

  // 只對「抽卡區」的卡，恢復可見
  const pool = document.getElementById('card-pool');
  pool.querySelectorAll('.card').forEach(c => {
    c.style.visibility = 'visible';
  });
   
  // 3.2 拖曳結束後，若自己還在手排，恢復顯示
  const hand = document.getElementById('hand');
  if (hand.contains(card)) {
    card.style.display = '';
  }
 });
  return card;
}

// 抽牌階段
function drawCards(){
  const pool = document.getElementById('card-pool');
  pool.innerHTML = '';
  shuffle(cardPoolData.slice()).slice(0,5).forEach(info => {
    pool.appendChild(createBuildingCard(info));
  });
}

// 操作按鈕
function refreshCards(){
  const cost = 2*(refreshCount+1);
  if(currentGold < cost){ alert('金幣不足'); return; }
  currentGold -= cost; refreshCount++;
  updateResourceDisplay(); updateRefreshButton();
  drawCards();
}
function skipDraw(){
  currentGold += 10;
  updateResourceDisplay();
  document.getElementById('draw-section').style.display='none';
}
function confirmDraw(){
  const selected = Array.from(document.querySelectorAll('.card.selected'));
  if(selected.length < 2){ alert('請選兩張'); return; }
  const hand = document.getElementById('hand');
  selected.forEach(c => {
    const info = {
      name: c.querySelector('.card-name').innerText,
      rarity: c.querySelector('.card-rarity').innerText,
      label: c.dataset.label,
      specialAbility: c.querySelector('.card-ability')?.innerText||'',
      baseProduce: parseInt(c.dataset.produce)
    };
    const nc = createBuildingCard(info);
    hand.appendChild(nc);
    c.classList.remove('selected');
  });
  document.getElementById('draw-section').style.display='none';
}

// 地圖放牌
function placeBuildingOnTile(tile, card){
  // 1. 扣除既有產出
  if(tile.buildingPlaced){
    roundRevenue -= tile.buildingProduce;
    tile.slumBonusGranted = false;
  }
  // 2. 更新 tile 屬性
  tile.buildingBaseProduce = parseInt(card.dataset.produce);
  tile.buildingLabel = card.dataset.label;
  tile.buildingName  = card.querySelector('.card-name').innerText;
  let pv = tile.buildingBaseProduce;
  if(tile.type==='city'){ pv += 2;
    if(tile.buildingLabel==='繁華區') pv +=4;
  }
  if(tile.type==='river') pv -=1;
  tile.buildingProduce = pv;
  tile.buildingPlaced = true;
  // 3. 移除手牌
  card.remove();
  // 4. 更新地塊顯示
  const hex = document.querySelector(`[data-tile-id="${tile.id}"]`);
  hex.innerHTML = `
    <div class="hex-name">${tile.buildingName}</div>
    <div class="hex-ability">${tile.buildingLabel}</div>`;
  // 5. 重算收益
  recalcRevenueFromScratch();
}

// 重算整回合產出（含 slum 群聚與相鄰、specialAbility）
function recalcRevenueFromScratch(){
  let total = 0;
  // 前置：重置 slumBonusGranted
  tileMap.forEach(t=>t.slumBonusGranted=false);
  // 1. 基礎計算
  tileMap.forEach(t=>{
    if(!t.buildingPlaced) return;
    let pv = t.buildingBaseProduce;
    if(t.type==='city'){ pv+=2;
      if(t.buildingLabel==='繁華區') pv+=4;
    } else if(t.type==='river'){
      pv-=1;
      if(t.buildingLabel==='河流') pv+=3;
    }
    t.buildingProduce = pv;
  });
  // 2. slum BFS 群聚 +1
  const visited = new Set();
  tileMap.forEach(t=>{
    if(!t.buildingPlaced||t.type!=='slum'||visited.has(t.id)) return;
    const queue=[t.id], cluster=[];
    while(queue.length){
      const id=queue.shift();
      if(visited.has(id)) continue;
      visited.add(id);
      const ct=tileMap.find(x=>x.id===id);
      if(ct&&ct.buildingPlaced&&ct.type==='slum'){ cluster.push(ct);
        ct.adjacency.forEach(nid=>!visited.has(nid)&&queue.push(nid));
      }
    }
    if(cluster.length>=3){
      cluster.forEach(ct=>{ ct.buildingProduce++; ct.slumBonusGranted=true; });
    }
  });
  // 3. slum 相鄰貧民窟 +1（最多+5）
  tileMap.forEach(t=>{
    if(!t.buildingPlaced||t.type!=='slum'||t.buildingLabel!=='貧民窟') return;
    const adjCount = t.adjacency.filter(id=>{
      const nt=tileMap.find(x=>x.id===id);
      return nt&&nt.buildingPlaced;
    }).length;
    t.buildingProduce += Math.min(adjCount,5);
  });
  // 4. specialAbility on water & star
  tileMap.forEach(t=>{
    if(!t.buildingPlaced) return;
    if(t.buildingName==='淨水站'&&Math.random()<0.5) t.buildingProduce++;
    if(t.buildingName==='星軌會館'){
       const hasN = t.adjacency.some(id=>{
        const nt=tileMap.find(x=>x.id===id);
        return nt&&nt.buildingPlaced;
      });
      if(!hasN) t.buildingProduce+=2;
    }
    // 社群站：若與至少 1 座其他建築相鄰，額外 +1
   if(t.buildingName==='社群站'){
       const hasNeighbor = t.adjacency.some(id=>{
       const nt=tileMap.find(x=>x.id===id);
       return nt&&nt.buildingPlaced;
     });
     if(hasNeighbor) t.buildingProduce++;
   }
   // 彈出商亭：若處於地圖邊緣格，額外 +1
   if(t.buildingName==='彈出商亭'){
     const row = t.row, col = t.col;
     const lastRow = rows.length - 1;
     const rowCount = rows[row];
     if(row === 0 || row === lastRow || col === 0 || col === rowCount - 1){
       t.buildingProduce++;
     }
   }
  // 地脈節點：若相鄰建築恰為2，則包含自己在內的3座每座+1
   if(t.buildingName==='地脈節點'){
     const nei = t.adjacency
       .map(id=>tileMap.find(x=>x.id===id))
       .filter(x=>x && x.buildingPlaced);
     if(nei.length===2){
       t.buildingProduce++;
       nei.forEach(x=>x.buildingProduce++);
     }
   }
  // 匯聚平臺：若與3座以上建築相鄰，額外+2
   if(t.buildingName==='匯聚平臺'){
     const cnt = t.adjacency
       .map(id=>tileMap.find(x=>x.id===id))
       .filter(x=>x && x.buildingPlaced)
       .length;
     if(cnt>3) t.buildingProduce+=2;
   }
  // 流動站：若自身在河流上，相鄰且也在河流的建築每座+1
   if(t.buildingName==='流動站' && t.type==='river'){
     t.adjacency.forEach(id=>{
       const x=tileMap.find(y=>y.id===id);
       if(x && x.buildingPlaced && x.type==='river'){
         x.buildingProduce++;
       }
     });
   }
  // 焚料方艙：偶數回合產出−1，下限4
   if(t.buildingName==='焚料方艙'){
     if(currentRound % 2 === 0){
       t.buildingProduce = Math.max(t.buildingProduce - 1, 4);
     }
   }
  });
  // 5. 累加
  tileMap.forEach(t=>{ if(t.buildingPlaced) total+=t.buildingProduce; });
  roundRevenue = total;
  updateResourceDisplay();
}

// 輔助：計算實際入帳（含荒原50%失敗）
function computeEffectiveRevenue(){
  let eff=0;
  tileMap.forEach(t=>{
    if(!t.buildingPlaced) return;
    let v = t.buildingProduce;
    if(t.buildingLabel==='荒原'&&t.type!=='wasteland'&&Math.random()<0.5) v=0;
    eff += v;
  });
  return eff;
}

// 啟動 Draw
function startDrawPhase(){
  refreshCount = 0;
  updateRefreshButton();
  document.getElementById('draw-section').style.display='flex';
  drawCards();
}

// window.onload 初始化
window.onload = () => {
  // DOM 參考
  const startScreen = document.getElementById('start-screen');
  const startBtn    = document.getElementById('startBtn');
  const endTurnBtn  = document.getElementById('end-turn-btn');
  const infoBtn     = document.getElementById('info-btn');
  const infoModal   = document.getElementById('info-modal');
  const closeInfoBtn= document.getElementById('close-info-btn');

  // 建立並渲染地圖
  tileMap = createTileMap31();
  computeAdj();
  initMapArea();

  // 初始顯示
  updateRoundDisplay();
  updateResourceDisplay();

  // 事件
  startBtn.onclick = ()=>{ startScreen.style.display='none'; startDrawPhase(); };
  document.addEventListener('keydown', e=> {
    if(e.key==='Enter'&&startScreen.style.display!=='none'){
      startScreen.style.display='none';
      startDrawPhase();
    }
  });
  endTurnBtn.onclick = () => {
  // 1. 計算本回合實際入帳並累加
  currentGold += computeEffectiveRevenue();
  // 2. 更新 UI（金幣 & 回合收益）
  updateResourceDisplay();
  // 3. 回合 +1 並更新顯示
  currentRound++;
  updateRoundDisplay();
  // 4. 開始下一輪抽卡
  startDrawPhase();
};
  document.getElementById('refresh-btn').onclick = refreshCards;
  infoBtn.onclick     = ()=>infoModal.style.display='flex';
  closeInfoBtn.onclick= ()=>infoModal.style.display='none';
};
