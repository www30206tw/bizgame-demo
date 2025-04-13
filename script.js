/*******************************
 * script.js (卡池 & 標籤介面)
 *******************************/
let cardIdCounter = 0;

window.onload = function() {
  /*******************
   * 遊戲狀態
   *******************/
  let currentRound   = 1;
  let currentGold    = 0;
  let roundRevenue   = 0;
  let refreshCount   = 0;

  /*******************
   * DOM
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

  const selectedCards   = [];

  // 1) 建立地塊
  function createTileMap31(){
    const rows=[4,5,4,5,4,5,4];
    const typeMapping={
      1:'wasteland',2:'wasteland',3:'wasteland',4:'wasteland',
      5:'wasteland',6:'slum',7:'slum',8:'wasteland',9:'river',10:'slum',
      11:'city',12:'slum',13:'river',14:'slum',15:'city',16:'city',
      17:'river',18:'wasteland',19:'slum',20:'slum',21:'river',22:'wasteland',
      23:'wasteland',24:'slum',25:'river',26:'wasteland',27:'wasteland',28:'wasteland',29:'river',
      30:'wasteland',31:'wasteland'
    };
    let map=[];
    let idCounter=1;
    for(let r=0;r<rows.length;r++){
      const count=rows[r];
      for(let c=0;c<count;c++){
        map.push({
          id:idCounter,
          row:r,
          col:c,
          type:typeMapping[idCounter],
          buildingProduce:0,
          buildingPlaced:false,
          slumBonusGranted:false,
          adjacency:[]
        });
        idCounter++;
      }
    }
    return map;
  }
  let tileMap = createTileMap31();

  // odd-r offset adjacency
  const directionsEven=[
    {dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}
  ];
  const directionsOdd=[
    {dr:-1,dc:-1},{dr:-1,dc:0},{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:-1},{dr:1,dc:0}
  ];
  function computeAdj(){
    tileMap.forEach(tile=>{
      const dirSet=(tile.row%2===0)?directionsEven:directionsOdd;
      dirSet.forEach(d=>{
        const nr=tile.row+d.dr;
        const nc=tile.col+d.dc;
        const nb=tileMap.find(x=>x.row===nr && x.col===nc);
        if(nb) tile.adjacency.push(nb.id);
      });
    });
  }
  computeAdj();

  // 絕對定位
  function initMapArea(){
    mapArea.innerHTML='';
    const tileW=80, tileH=80;
    const verticalSpacing=tileH*0.75;
    const offsetX=tileW/2;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    tileMap.forEach(tile=>{
      const shiftLeft=(tile.row%2===1);
      tile.x=tile.col*tileW+(shiftLeft? -offsetX:0);
      tile.y=tile.row*verticalSpacing;
      minX=Math.min(minX,tile.x);
      maxX=Math.max(maxX,tile.x);
      minY=Math.min(minY,tile.y);
      maxY=Math.max(maxY,tile.y);
    });
    const shapeW=maxX-minX+tileW;
    const shapeH=maxY-minY+tileH;
    const mapW=mapArea.clientWidth, mapH=mapArea.clientHeight;
    const centerX=(mapW-shapeW)/2;
    const centerY=(mapH-shapeH)/2;

    tileMap.forEach(tile=>{
      const hex=document.createElement('div');
      hex.className='hex-tile';
      if(tile.type==='city') hex.classList.add('city-tile');
      else if(tile.type==='slum') hex.classList.add('slum-tile');
      else if(tile.type==='river') hex.classList.add('river-tile');
      else hex.classList.add('wasteland-tile');

      hex.dataset.tileId=tile.id;
      hex.textContent='?';

      const px=tile.x-minX+centerX;
      const py=tile.y-minY+centerY;
      hex.style.left=px+'px';
      hex.style.top=py+'px';

      // 拖曳放置
      hex.ondragover=e=>e.preventDefault();
      hex.ondrop=e=>{
        e.preventDefault();
        const cardId=e.dataTransfer.getData('cardId');
        const cardElem=hand.querySelector(`[data-card-id="${cardId}"]`);
        if(!cardElem)return;
        placeBuildingOnTile(tile, cardElem);
      };
      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  // UI
  function updateRoundDisplay(){ roundNumberElem.innerText=currentRound; }
  function updateResourceDisplay(){
    goldAmountElem.innerText=currentGold;
    roundGoldElem.innerText=roundRevenue;
  }
  function updateRefreshButton(){
    const cost=2*(refreshCount+1);
    refreshBtn.textContent=`刷新卡片(${cost} 金幣)`;
  }

  /***********************************************
   * 卡池：8 張牌 (名稱 / 稀有度 / 標籤 / 產出=6)
   ***********************************************/
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

  // 標籤能力敘述 (hover tooltip 只顯示文字, 不執行效果)
  const labelEffectDesc = {
    "繁華區": "若此建築物蓋在繁華區，則回合結束時此建築的產出+4金幣",
    "貧民窟": "若此建築物蓋在貧民區，相鄰地塊每有一座有貧民窟標籤的建築 => +1金幣",
    "河流":   "若此建築物蓋在河流上，回合結束時此建築+3, 且周圍建築隨機一棟翻倍產出",
    "荒原":   "若此建築物蓋在荒原上, 50%不產出, 50%地塊轉貧民窟"
  };

  function createBuildingCard(cardInfo){
    const {name, rarity, label, baseProduce} = cardInfo;
    const card=document.createElement('div');
    card.className='card';
    card.dataset.type='building';
    card.dataset.produce=baseProduce;
    card.dataset.cardId=++cardIdCounter;

    card.innerHTML=`
      <div class="card-gold-output">${baseProduce}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${name}</div>
      <div class="card-rarity">${rarity}</div>
      <div class="card-label">${label}</div>
      <!-- tooltip -->
      <div class="tooltip">
        ${label}：${labelEffectDesc[label] || ""}
      </div>
    `;

    // 拖曳 => 手排卡片消失
    card.draggable=true;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', name);
      setTimeout(()=>{ card.style.display='none'; },0);
    });
    card.addEventListener('dragend', e=>{
      card.style.display='';
    });

    return card;
  }

  // 從 cardPoolData 中抽 5 張
  function drawCards(){
    cardPool.innerHTML='';
    // 洗牌 => 取5
    const arr = shuffle(cardPoolData.slice());
    const five = arr.slice(0,5);
    five.forEach(info=>{
      const card=createBuildingCard(info);
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
      alert("請至少選擇 2 張卡牌！");
      return;
    }
    selectedCards.forEach(c=>{
      // 依 c 的資料構造新的
      const baseProduce=parseInt(c.dataset.produce)||6;
      const cName=c.querySelector('.card-name').innerText;
      const cRarity=c.querySelector('.card-rarity').innerText;
      const cLabel=c.querySelector('.card-label').innerText;
      // 生成一張卡
      const newCard=document.createElement('div');
      newCard.className='card';
      newCard.dataset.type='building';
      newCard.dataset.produce=baseProduce;
      newCard.dataset.cardId=++cardIdCounter;

      newCard.innerHTML=`
        <div class="card-gold-output">${baseProduce}</div>
        <div class="card-image-area"></div>
        <div class="card-name">${cName}</div>
        <div class="card-rarity">${cRarity}</div>
        <div class="card-label">${cLabel}</div>
        <div class="tooltip">${cLabel}：${labelEffectDesc[cLabel]||""}</div>
      `;
      // 同樣 dragstart => 手排消失
      newCard.draggable=true;
      newCard.addEventListener('dragstart', ee=>{
        ee.dataTransfer.setData('cardId', newCard.dataset.cardId);
        ee.dataTransfer.setData('text/plain', cName);
        setTimeout(()=>{ newCard.style.display='none'; },0);
      });
      newCard.addEventListener('dragend', ee=>{
        newCard.style.display='';
      });

      hand.appendChild(newCard);
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

  /***********************
   * placeBuildingOnTile
   ***********************/
  function placeBuildingOnTile(tile, cardElem){
    console.log(`placeBuildingOnTile => tile#${tile.id}`);
    // 若已有建築 => 扣除舊產出
    if(tile.buildingPlaced){
      roundRevenue-=tile.buildingProduce;
      tile.buildingProduce=0;
      tile.slumBonusGranted=false;
    }

    // 基礎= cardElem.dataset.produce (=6)
    let produceVal=parseInt(cardElem.dataset.produce)||6;
    if(tile.type==='city') produceVal+=2;   // city => +2
    if(tile.type==='river') produceVal-=1; // river => -1

    tile.buildingProduce=produceVal;
    tile.buildingPlaced=true;

    // 更新地塊顯示
    const hex=mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    const bName=cardElem.querySelector('.card-name').innerText;
    hex.textContent=bName;

    // 手排移除
    cardElem.remove();

    // 若是slum => BFS
    if(tile.type==='slum'){
      recalcSlumBonus();
    } else {
      roundRevenue+=tile.buildingProduce;
      updateResourceDisplay();
    }
  }

  // BFS: slum cluster >=3 => +1 (修正)
  function recalcSlumBonus(){
    console.log("recalcSlumBonus()");

    // A) 重置所有 slum tile produce => 6 ± city/river
    tileMap.forEach(t=>{
      if(t.buildingPlaced && t.type==='slum'){
        t.slumBonusGranted=false;
        let base=6;
        // city+slum theoretically not co-exist, but keep for expansion
        if(t.type==='city')  base+=2;
        if(t.type==='river') base-=1;
        t.buildingProduce=base;
      }
    });

    // B) BFS
    const visited=new Set();
    tileMap.forEach(tile=>{
      if(tile.type==='slum' && tile.buildingPlaced && !visited.has(tile.id)){
        let cluster=[];
        let queue=[tile.id];
        while(queue.length>0){
          let currId=queue.shift();
          if(visited.has(currId)) continue;
          visited.add(currId);
          const currTile=tileMap.find(x=>x.id===currId);
          if(currTile && currTile.type==='slum' && currTile.buildingPlaced){
            cluster.push(currTile);
            currTile.adjacency.forEach(nbId=>{
              if(!visited.has(nbId)){
                const nb=tileMap.find(x=>x.id===nbId);
                if(nb && nb.type==='slum' && nb.buildingPlaced){
                  queue.push(nbId);
                }
              }
            });
          }
        }
        console.log("cluster found =>", cluster.map(x=>x.id));
        if(cluster.length>=3){
          cluster.forEach(ct=>{
            if(!ct.slumBonusGranted){
              ct.buildingProduce+=1;
              ct.slumBonusGranted=true;
            }
          });
        }
      }
    });

    // C) 重算 roundRevenue
    recalcRevenueFromScratch();
  }

  function recalcRevenueFromScratch(){
    let sum=0;
    tileMap.forEach(t=>{
      if(t.buildingPlaced){
        sum+=t.buildingProduce;
      }
    });
    roundRevenue=sum;
    updateResourceDisplay();
  }

  // 回合結束 => gold += roundRevenue
  endTurnBtn.addEventListener('click',()=>{
    currentGold+=roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  // StartGame
  document.addEventListener('keydown', e=>{
    if(startScreen.style.display!=='none' && (e.key==='Enter'||e.key==='NumpadEnter')){
      startGame();
    }
  });
  function startGame(){
    startScreen.style.display='none';
    currentRound=1;
    currentGold=0;
    roundRevenue=0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }

  // info
  infoBtn.addEventListener('click',()=>{
    infoModal.style.display='flex';
  });
  closeInfoBtn.addEventListener('click',()=>{
    infoModal.style.display='none';
  });
};
