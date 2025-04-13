let cardIdCounter = 0;

window.onload = function() {
  // 回合 & 資源
  let currentRound   = 1;
  let currentGold    = 0;
  let roundRevenue   = 0;
  let refreshCount   = 0;

  // DOM 元素
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

  // 建立 31 塊 (7行：4,5,4,5,4,5,4)
  function createTileMap31(){
    const rows=[4,5,4,5,4,5,4];
    const typeMapping={
      1:'wasteland', 2:'wasteland',3:'wasteland',4:'wasteland',
      5:'wasteland',6:'slum',7:'slum',8:'wasteland',9:'river',10:'slum',
      11:'city',12:'slum',13:'river',14:'slum',15:'city',16:'city',
      17:'river',18:'wasteland',19:'slum',20:'slum',21:'river',22:'wasteland',
      23:'wasteland',24:'slum',25:'river',26:'wasteland',27:'wasteland',28:'wasteland',29:'river',
      30:'wasteland',31:'wasteland'
    };
    let tiles=[];
    let idCounter=1;
    for(let r=0;r<rows.length;r++){
      let count=rows[r];
      for(let c=0;c<count;c++){
        tiles.push({
          id:idCounter,
          row:r,
          col:c,
          type:typeMapping[idCounter],
          buildingProduce:0,
          buildingPlaced:false,
          slumBonusGranted:false,
          adjacency:[],
          x:0,y:0
        });
        idCounter++;
      }
    }
    return tiles;
  }
  let tileMap=createTileMap31();

  // 計算鄰接 (odd-r offset)
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
        const nb=tileMap.find(t=>t.row===nr && t.col===nc);
        if(nb){
          tile.adjacency.push(nb.id);
        }
      });
    });
  }
  computeAdjacency();

  // 絕對定位
  function initMapArea(){
    mapArea.innerHTML='';
    const tileWidth=80, tileHeight=80;
    const verticalSpacing=tileHeight*0.75;
    const offsetX=tileWidth/2;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    tileMap.forEach(tile=>{
      const shiftLeft=(tile.row%2===1);
      tile.x=tile.col*tileWidth+(shiftLeft? -offsetX:0);
      tile.y=tile.row*verticalSpacing;
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
      hex.ondragover=e=>e.preventDefault();
      hex.ondrop=e=>{
        e.preventDefault();
        const cardId=e.dataTransfer.getData('cardId');
        const cardElem=hand.querySelector(`[data-card-id="${cardId}"]`);
        if(!cardElem) return;
        placeBuildingOnTile(tile,cardElem);
      };
      mapArea.appendChild(hex);
    });
  }
  initMapArea();

  // 初始化後輸出 tileMap
  console.log("--- tileMap Data ---");
  tileMap.forEach(t=>{
    console.log(`Tile#${t.id}: row=${t.row}, col=${t.col}, type=${t.type}, adj=${t.adjacency}`);
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

  // 建築卡
  function createBuildingCard(buildingName){
    const produceAmount=6;
    const card=document.createElement('div');
    card.className='card';
    card.dataset.type='building';
    card.dataset.produce=produceAmount;
    card.dataset.cardId=++cardIdCounter;
    card.draggable=true;
    card.innerHTML=`
      <div class="card-gold-output">${produceAmount}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${buildingName}</div>
      <div class="card-rarity">普通</div>
      <div class="card-ability"></div>
    `;
    card.addEventListener('dragstart',e=>{
      e.dataTransfer.setData('cardId',card.dataset.cardId);
      e.dataTransfer.setData('text/plain',buildingName);
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
      alert("請至少選擇 2 張卡牌！");
      return;
    }
    selectedCards.forEach(c=>{
      const copy=createBuildingCard(c.querySelector('.card-name').innerText);
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

  // 放置建築 & 計算產出
  function placeBuildingOnTile(tile, cardElem){
    console.log(`placeBuildingOnTile => tile#${tile.id} type=${tile.type}`);
    // 規避重複
    if(tile.buildingPlaced){
      tile.buildingProduce=0;
      tile.slumBonusGranted=false;
    }
    // 基礎產出
    let produceVal=parseInt(cardElem.dataset.produce)||6;
    if(tile.type==='city') produceVal+=2;
    if(tile.type==='river') produceVal-=1;
    tile.buildingProduce=produceVal;
    tile.buildingPlaced=true;

    // 更新地塊顯示
    const hexEl=mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hexEl.textContent=cardElem.querySelector('.card-name').innerText;
    cardElem.remove();

    // 若是貧民窟 => BFS
    if(tile.type==='slum'){
      recalcSlumBonus();
    } else {
      // 如果不是 slum => 不做 BFS
      recalcRevenueFromScratch();
    }
  }

  // BFS: 若集群>=3 => buildingProduce+1 (不即時加減 roundRevenue，最後再重算)
  function recalcSlumBonus(){
    console.log("recalcSlumBonus() 被呼叫");
    // 先把所有 slum tile 的 bonus 重置 (只保留基礎產出)
    tileMap.forEach(t=>{
      if(t.type==='slum' && t.buildingPlaced){
        // 恢復到基礎 (6 or 6±... 由 city/river)
        let base=6;
        if(t.type==='city') base+=2;
        if(t.type==='river') base-=1;
        t.buildingProduce=base;
        t.slumBonusGranted=false;
      }
    });

    // BFS
    let visited=new Set();
    tileMap.forEach(tile=>{
      if(tile.type==='slum' && tile.buildingPlaced && !visited.has(tile.id)){
        let cluster=[];
        let queue=[tile.id];
        while(queue.length>0){
          const currId=queue.shift();
          if(visited.has(currId)) continue;
          visited.add(currId);
          let currTile=tileMap.find(x=>x.id===currId);
          if(currTile && currTile.type==='slum' && currTile.buildingPlaced){
            cluster.push(currTile);
            currTile.adjacency.forEach(nbId=>{
              if(!visited.has(nbId)){
                queue.push(nbId);
              }
            });
          }
        }
        console.log("cluster found", cluster.map(x=>x.id));
        // 集群>=3 => +1
        if(cluster.length>=3){
          cluster.forEach(ct=>{
            ct.buildingProduce++; // 只加 produce
            ct.slumBonusGranted=true;
          });
        }
      }
    });
    // BFS 完成後，重新計算一次 roundRevenue
    recalcRevenueFromScratch();
  }

  // 重新從 tileMap 加總 produce
  function recalcRevenueFromScratch(){
    roundRevenue=0;
    tileMap.forEach(t=>{
      if(t.buildingPlaced){
        roundRevenue+=t.buildingProduce;
      }
    });
    updateResourceDisplay();
  }

  // 回合流程
  function startGame(){
    startScreen.style.display='none';
    currentRound=1;
    currentGold=0;
    roundRevenue=0;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  }
  endTurnBtn.addEventListener('click',()=>{
    currentGold+=roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });
  document.addEventListener('keydown',e=>{
    if(startScreen.style.display!=='none' && (e.key==='Enter'|| e.key==='NumpadEnter')){
      startGame();
    }
  });
  infoBtn.addEventListener('click',()=>{
    infoModal.style.display='flex';
  });
  closeInfoBtn.addEventListener('click',()=>{
    infoModal.style.display='none';
  });
};
