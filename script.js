/****************************
 * script.js (建築標籤版)
 ****************************/
let cardIdCounter = 0;

window.onload = function() {
  // 遊戲狀態
  let currentRound = 1;
  let currentGold = 0;
  let roundRevenue = 0;
  let refreshCount = 0;

  // DOM
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

  /*************************
   * 建立 31 塊地塊 (7行)
   *************************/
  function createTileMap31(){
    const rows = [4,5,4,5,4,5,4];
    const typeMapping = {
      1:'wasteland', 2:'wasteland',3:'wasteland',4:'wasteland',
      5:'wasteland',6:'slum',7:'slum',8:'wasteland',9:'river',10:'slum',
      11:'city',12:'slum',13:'river',14:'slum',15:'city',16:'city',
      17:'river',18:'wasteland',19:'slum',20:'slum',21:'river',22:'wasteland',
      23:'wasteland',24:'slum',25:'river',26:'wasteland',27:'wasteland',28:'wasteland',29:'river',
      30:'wasteland',31:'wasteland'
    };
    const tiles=[];
    let idCounter=1;
    for(let r=0;r<rows.length;r++){
      const count=rows[r];
      for(let c=0;c<count;c++){
        tiles.push({
          id:idCounter,
          row:r,
          col:c,
          type:typeMapping[idCounter],
          buildingProduce:0,
          buildingPlaced:false,
          adjacency:[],
          x:0,y:0, // 絕對定位
          label:"",
        });
        idCounter++;
      }
    }
    return tiles;
  }
  let tileMap = createTileMap31();

  // odd-r offset adjacency
  const directionsEven = [
    {dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}
  ];
  const directionsOdd = [
    {dr:-1,dc:-1},{dr:-1,dc:0},{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:-1},{dr:1,dc:0}
  ];
  function computeAdjacency(){
    tileMap.forEach(tile=>{
      const dirSet=(tile.row%2===0)?directionsEven:directionsOdd;
      dirSet.forEach(d=>{
        const nr=tile.row+d.dr;
        const nc=tile.col+d.dc;
        const nb=tileMap.find(tt=>tt.row===nr && tt.col===nc);
        if(nb){
          tile.adjacency.push(nb.id);
        }
      });
    });
  }
  computeAdjacency();

  // 絕對定位 & 置中
  function initMapArea(){
    mapArea.innerHTML='';
    const tileWidth=80, tileHeight=80;
    const verticalSpacing=tileHeight*0.75;
    const offsetX=tileWidth/2;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    tileMap.forEach(t=>{
      const shiftLeft=(t.row%2===1);
      t.x = t.col*tileWidth+(shiftLeft? -offsetX:0);
      t.y = t.row*verticalSpacing;
      minX=Math.min(minX,t.x);
      maxX=Math.max(maxX,t.x);
      minY=Math.min(minY,t.y);
      maxY=Math.max(maxY,t.y);
    });
    const shapeW=maxX-minX+tileWidth;
    const shapeH=maxY-minY+tileHeight;
    const mapW=mapArea.clientWidth, mapH=mapArea.clientHeight;
    const centerX=(mapW-shapeW)/2;
    const centerY=(mapH-shapeH)/2;

    tileMap.forEach(tile=>{
      const hex=document.createElement('div');
      hex.className='hex-tile';
      if(tile.type==='city')  hex.classList.add('city-tile');
      else if(tile.type==='slum')  hex.classList.add('slum-tile');
      else if(tile.type==='river') hex.classList.add('river-tile');
      else hex.classList.add('wasteland-tile');
      hex.dataset.tileId=tile.id;
      hex.textContent='?';

      const px=tile.x-minX+centerX;
      const py=tile.y-minY+centerY;
      hex.style.left=px+'px';
      hex.style.top=py+'px';

      hex.ondragover=e=>e.preventDefault();
      hex.ondrop=e=>{
        e.preventDefault();
        const cardId=e.dataTransfer.getData('cardId');
        const cardElem=hand.querySelector(`[data-card-id="${cardId}"]`);
        if(!cardElem)return;
        placeBuildingOnTile(tile,cardElem);
      };
      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  // 觀察 tileMap
  console.log("=== tileMap ===");
  tileMap.forEach(t=>{
    console.log(`Tile#${t.id} row=${t.row} col=${t.col} type=${t.type} adjacency=${t.adjacency}`);
  });

  // UI 更新
  function updateRoundDisplay(){ roundNumberElem.innerText=currentRound; }
  function updateResourceDisplay(){
    goldAmountElem.innerText=currentGold;
    roundGoldElem.innerText=roundRevenue;
  }
  function updateRefreshButton(){
    const cost=2*(refreshCount+1);
    refreshBtn.textContent=`刷新卡片(${cost} 金幣)`;
  }

  /*********************************
   * 建築卡：加入「標籤」與 Tooltip
   *********************************/
  // 4 種標籤: 繁華區/貧民窟/河流/荒原
  const BUILDING_LABELS = [
    {
      label: "繁華區",
      desc: "若此建築物蓋在繁華區地塊，回合結束時產出+4"
    },
    {
      label: "貧民窟",
      desc: "若此建築物蓋在貧民窟地塊，相鄰每有一座帶「貧民窟」標籤的建築，再+1"
    },
    {
      label: "河流",
      desc: "若此建築物蓋在河流地塊，回合結束時+3，並隨機使鄰近建築翻倍"
    },
    {
      label: "荒原",
      desc: "若此建築物蓋在荒原地塊，50% 產出=0，50% 將地塊轉為貧民窟"
    }
  ];

  function createBuildingCard(buildingName){
    // 隨機指定一個標籤 (可依需求自行決定)
    const randomIndex = Math.floor(Math.random() * BUILDING_LABELS.length);
    const chosen = BUILDING_LABELS[randomIndex];

    const produceAmount=6;
    const card = document.createElement('div');
    card.className='card';
    card.dataset.type='building';
    card.dataset.produce=produceAmount;
    card.dataset.cardId=++cardIdCounter;
    // 建立 card.dataset.label
    card.dataset.label=chosen.label; // e.g. "繁華區"

    // 建立卡片內容
    card.innerHTML=`
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${buildingName}</div>
      <div class="card-rarity">普通</div>
      <!-- 在稀有度下方加一行標籤文字 -->
      <div class="card-label">${chosen.label}</div>
      <!-- tooltip 內容 (hover 出現) -->
      <div class="tooltip">${chosen.label}：${chosen.desc}</div>
    `;

    card.draggable=true;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', buildingName);
    });
    return card;
  }

  function shuffle(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
    return array;
  }

  function drawCards(){
    cardPool.innerHTML='';
    const buildings=["建築A","建築B","建築C","建築D","建築E"];
    const drawn=shuffle(buildings.slice()).slice(0,5);
    drawn.forEach(bName=>{
      const card=createBuildingCard(bName);
      card.onclick=()=>{
        if(selectedCards.includes(card)){
          card.classList.remove('selected');
          selectedCards.splice(selectedCards.indexOf(card),1);
        }else if(selectedCards.length<2){
          card.classList.add('selected');
          selectedCards.push(card);
        }
      };
      cardPool.appendChild(card);
    });
  }

  window.refreshCards=function(){
    const cost=2*(refreshCount+1);
    if(currentGold<cost){
      alert("金幣不足，無法刷新!");
      return;
    }
    currentGold-=cost;
    refreshCount++;
    updateResourceDisplay();
    updateRefreshButton();
    selectedCards.length=0;
    drawCards();
  };
  window.skipDraw=function(){
    currentGold+=10;
    updateResourceDisplay();
    drawSection.style.display='none';
  };
  window.confirmDraw=function(){
    if(selectedCards.length<2){
      alert("請至少選 2 張卡牌!");
      return;
    }
    selectedCards.forEach(c=>{
      // 複製卡片到手牌
      const copy=createBuildingCard(c.querySelector('.card-name').innerText);
      // 保留相同標籤
      copy.dataset.label=c.dataset.label;
      copy.querySelector('.card-label').innerText = c.dataset.label;
      copy.querySelector('.tooltip').innerText = c.querySelector('.tooltip').innerText;
      hand.appendChild(copy);
    });
    drawSection.style.display='none';
  };
  window.startDrawPhase=function(){
    refreshCount=0;
    selectedCards.length=0;
    updateRefreshButton();
    drawSection.style.display='flex';
    drawCards();
  };

  /********************
   * placeBuildingOnTile
   ********************/
  function placeBuildingOnTile(tile, cardElem){
    console.log(`placeBuildingOnTile => tile#${tile.id}, tile.type=${tile.type}, buildingLabel=${cardElem.dataset.label}`);
    // 先移除舊產出
    if(tile.buildingPlaced){
      roundRevenue-=tile.buildingProduce;
      tile.buildingProduce=0;
    }
    tile.buildingPlaced=true;
    tile.label=cardElem.dataset.label; // 把卡片標籤存到 tile (此地塊上的建築)
    // 基礎產出6
    let produceVal=parseInt(cardElem.dataset.produce)||6;
    tile.buildingProduce=produceVal;

    // 更新顯示
    const tileHex = mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    tileHex.textContent = cardElem.querySelector('.card-name').innerText + `(${tile.label})`;

    // 從手牌移除卡
    cardElem.remove();

    // 放置後先重算一次回合收益
    recalcRevenueFromScratch();
  }

  // 回合結束時 => 套用標籤加成 => 再重算 roundRevenue
  function applyBuildingLabelSynergy(){
    // 先重置 buildingProduce 到基礎
    tileMap.forEach(tile=>{
      if(tile.buildingPlaced){
        // 基礎=6
        let base=6;
        if(tile.type==='city')  base+=0; // city不在這裡加, 之後"繁華區"標籤才判斷
        if(tile.type==='river') base+=0; // 之後河流標籤再加
        // (注意: 先不管 tile.type=slum/wasteland, 之後標籤再算效果)
        tile.buildingProduce=base;
      }
    });

    // 逐一檢查 tile.label & tile.type
    tileMap.forEach(tile=>{
      if(!tile.buildingPlaced) return; 
      const label = tile.label; 
      // 1) 繁華區標籤 vs city地塊 => +4
      if(label==='繁華區' && tile.type==='city'){
        tile.buildingProduce +=4;
      }
      // 2) 貧民窟標籤 vs slum地塊 => adjacency 中帶"貧民窟"標籤的建築數 => +1 * 數量
      if(label==='貧民窟' && tile.type==='slum'){
        // 數 adjacency
        let count=0;
        tile.adjacency.forEach(nbId=>{
          const nbTile = tileMap.find(x=>x.id===nbId);
          if(nbTile && nbTile.buildingPlaced && nbTile.label==='貧民窟'){
            count++;
          }
        });
        tile.buildingProduce += count; // each adjacency with "貧民窟" => +1
      }
      // 3) 河流標籤 vs river地塊 => +3, 並隨機讓鄰近建築翻倍
      if(label==='河流' && tile.type==='river'){
        tile.buildingProduce +=3;
        // 若有鄰近建築 => pick random => *2
        let nbBuildings = tile.adjacency
          .map(id=> tileMap.find(x=>x.id===id))
          .filter(tt=>tt.buildingPlaced);
        if(nbBuildings.length>0){
          const randIndex=Math.floor(Math.random()*nbBuildings.length);
          const chosen = nbBuildings[randIndex];
          chosen.buildingProduce *=2; 
          console.log(`河流標籤翻倍 => tile#${chosen.id}`);
        }
      }
      // 4) 荒原標籤 vs wasteland地塊 => 50%產出=0, 50%地塊轉"slum"
      if(label==='荒原' && tile.type==='wasteland'){
        let r=Math.random();
        if(r<0.5){
          // 50% => produce=0
          tile.buildingProduce=0;
        } else {
          // 另外 50% => tile.type='slum'
          tile.type='slum';
          console.log(`荒原標籤 => tile#${tile.id} 變成 slum`);
        }
      }
    });
    // 最後重新累計 roundRevenue
    recalcRevenueFromScratch();
  }

  // 重新計算 roundRevenue
  function recalcRevenueFromScratch(){
    let sum=0;
    tileMap.forEach(tile=>{
      if(tile.buildingPlaced){
        sum+=tile.buildingProduce;
      }
    });
    roundRevenue=sum;
    updateResourceDisplay();
  }

  // 回合結束
  function endTurn(){
    // 先應用 "標籤" 加成 (繁華區/貧民窟/河流/荒原)
    applyBuildingLabelSynergy();

    // 再把回合收益加到 currentGold
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();

    // 進入下一回合抽卡
    window.startDrawPhase();
  }

  // 監聽
  endTurnBtn.addEventListener('click', endTurn);

  function startGame(){
    startScreen.style.display='none';
    currentRound=1;
    currentGold=0;
    roundRevenue=0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }
  document.addEventListener('keydown', e=>{
    if(startScreen.style.display!=='none' && (e.key==='Enter' || e.key==='NumpadEnter')){
      startGame();
    }
  });
  infoBtn.addEventListener('click', ()=>{ infoModal.style.display='flex'; });
  closeInfoBtn.addEventListener('click', ()=>{ infoModal.style.display='none'; });
};
