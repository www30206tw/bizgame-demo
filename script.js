// 回合＆資源
let cardIdCounter = 0;

window.onload = function(){
  let currentRound   = 1;
  let currentGold    = 0; 
  let roundRevenue   = 0; 
  let refreshCount   = 0;

  // DOM 參考
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

  /********************
   * 建立31塊地塊
   ********************/
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
    let tileMap=[];
    let idCounter=1;
    for(let r=0;r<rows.length;r++){
      const count=rows[r];
      for(let c=0;c<count;c++){
        tileMap.push({
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
    return tileMap;
  }
  let tileMap=createTileMap31();

  /********************
   * odd-r offset adjacency
   ********************/
  const directionsEven=[
    {dr:-1,dc:0},{dr:-1,dc:1},{dr:0,dc:-1},{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}
  ];
  const directionsOdd=[
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

  /********************
   * 絕對定位 (簡化)
   ********************/
  function initMapArea(){
    mapArea.innerHTML='';
    const tileWidth=80, tileHeight=80;
    const verticalSpacing=tileHeight*0.75;
    const offsetX=tileWidth/2;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;

    tileMap.forEach(tile=>{
      const shiftLeft=(tile.row%2===1);
      tile.x = tile.col*tileWidth + (shiftLeft? -offsetX:0);
      tile.y = tile.row*verticalSpacing;
      minX=Math.min(minX,tile.x);
      maxX=Math.max(maxX,tile.x);
      minY=Math.min(minY,tile.y);
      maxY=Math.max(maxY,tile.y);
    });

    const shapeW=maxX-minX+tileWidth;
    const shapeH=maxY-minY+tileHeight;
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
        placeBuildingOnTile(tile,cardElem);
      };
      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  /********************
   * UI 更新
   ********************/
  function updateRoundDisplay(){ roundNumberElem.innerText=currentRound; }
  function updateResourceDisplay(){ 
    goldAmountElem.innerText=currentGold;
    roundGoldElem.innerText=roundRevenue;
  }
  function updateRefreshButton(){
    const cost=2*(refreshCount+1);
    refreshBtn.textContent=`刷新卡片(${cost} 金幣)`;
  }

  /********************
   * 建築卡
   ********************/
  function createBuildingCard(name){
    const produceAmount=6;
    const card=document.createElement('div');
    card.className='card';
    card.dataset.type='building';
    card.dataset.produce=produceAmount;
    card.dataset.cardId=++cardIdCounter;

    card.innerHTML=`
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${name}</div>
      <div class="card-rarity">普通</div>
    `;

    // 拖曳: 手排該建築要暫時"消失"
    card.draggable=true;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', name);

      // 讓手排的卡片在拖曳中看起來被拿起 (隱藏)
      setTimeout(()=>{ 
        card.style.display='none';
      },0);
    });
    // 如果使用者放下或取消，顯示回來
    card.addEventListener('dragend', e=>{
      card.style.display='';
    });

    return card;
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function drawCards(){
    cardPool.innerHTML='';
    const pool=["建築A","建築B","建築C","建築D","建築E"];
    const drawn=shuffle(pool.slice()).slice(0,5);
    drawn.forEach(name=>{
      const card=createBuildingCard(name);
      card.onclick=()=>{
        if(selectedCards.includes(card)){
          card.classList.remove('selected');
          selectedCards.splice(selectedCards.indexOf(card),1);
        } else if(selectedCards.length<2){
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
      const copy = createBuildingCard(c.querySelector('.card-name').innerText);
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
    // 若該地塊已有建築 => 先扣除舊產出
    if(tile.buildingPlaced){
      roundRevenue -= tile.buildingProduce; 
      tile.buildingProduce=0;
      tile.slumBonusGranted=false;
    }

    // 基礎產出=6
    let produceVal=parseInt(cardElem.dataset.produce)||6;

    // city => +2
    if(tile.type==='city') produceVal+=2;
    // river => -1
    if(tile.type==='river') produceVal-=1;

    tile.buildingProduce=produceVal;
    tile.buildingPlaced=true;

    // 在地塊上顯示
    const hex=mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hex.textContent = cardElem.querySelector('.card-name').innerText;

    // 手排移除該卡
    cardElem.remove();

    // slum => BFS cluster >=3 => +1
    if(tile.type==='slum'){
      checkSlumClusterAndAddBonus(tile.id);
    }

    // 更新回合收益
    roundRevenue += tile.buildingProduce;
    updateResourceDisplay();
  }

  // BFS：若 cluster>=3 => 連通 slum +1
  function checkSlumClusterAndAddBonus(startId){
    const visited=new Set();
    const queue=[startId];
    const cluster=[];
    while(queue.length>0){
      const currId=queue.shift();
      if(visited.has(currId)) continue;
      visited.add(currId);

      const t=tileMap.find(x=>x.id===currId);
      if(t.type==='slum' && t.buildingPlaced){
        cluster.push(currId);
        // 搜尋相鄰
        t.adjacency.forEach(nbId=>{
          const nb=tileMap.find(xx=>xx.id===nbId);
          if(!visited.has(nbId) && nb.type==='slum' && nb.buildingPlaced){
            queue.push(nbId);
          }
        });
      }
    }
    // 若 cluster>=3 => each +1
    if(cluster.length>=3){
      cluster.forEach(cid=>{
        const slumTile = tileMap.find(xx=>xx.id===cid);
        if(!slumTile.slumBonusGranted){
          roundRevenue -= slumTile.buildingProduce;
          slumTile.buildingProduce +=1;
          slumTile.slumBonusGranted=true;
          roundRevenue += slumTile.buildingProduce;
        }
      });
      updateResourceDisplay();
    }
  }

  // 回合結束
  endTurnBtn.addEventListener('click', ()=>{
    // 結束回合 => 把 roundRevenue 加到 currentGold
    currentGold+=roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    // 進入下一回合抽卡
    window.startDrawPhase();
  });

  // 監聽鍵盤(Enter)開始
  document.addEventListener('keydown', e=>{
    if(startScreen.style.display!=='none' && (e.key==='Enter' || e.key==='NumpadEnter')){
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
  infoBtn.addEventListener('click', ()=>{
    infoModal.style.display='flex';
  });
  closeInfoBtn.addEventListener('click',()=>{
    infoModal.style.display='none';
  });
};
