/********************
 * Slum BFS: fix double-add issue
 ********************/
let cardIdCounter=0;
window.onload=function(){
  let currentRound=1;
  let currentGold=0;
  let roundRevenue=0;
  let refreshCount=0;

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

  const selectedCards=[];

  // 1) 建立31塊
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
  let tileMap=createTileMap31();

  // 2) adjacency
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
        const nb=tileMap.find(t=>t.row===nr && t.col===nc);
        if(nb){
          tile.adjacency.push(nb.id);
        }
      });
    });
  }
  computeAdj();

  // 3) 絕對定位
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

      hex.ondragover=e=>e.preventDefault();
      hex.ondrop=e=>{
        e.preventDefault();
        const cardId=e.dataTransfer.getData('cardId');
        const cardElem=hand.querySelector(`[data-card-id="${cardId}"]`);
        if(!cardElem) return;
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

  // 建築卡
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
    card.draggable=true;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', name);
      // 手排的卡在拖曳時隱藏
      setTimeout(()=>{ card.style.display='none'; },0);
    });
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
    const possible=["建築A","建築B","建築C","建築D","建築E"];
    const drawn=shuffle(possible.slice()).slice(0,5);
    drawn.forEach(name=>{
      const card=createBuildingCard(name);
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

  /*******************
   * placeBuildingOnTile
   *******************/
  function placeBuildingOnTile(tile, cardElem){
    // 若已有建築 => 先扣除舊產出
    if(tile.buildingPlaced){
      roundRevenue-=tile.buildingProduce;
      tile.buildingProduce=0;
      tile.slumBonusGranted=false;
    }
    let produceVal=parseInt(cardElem.dataset.produce)||6;
    if(tile.type==='city') produceVal+=2;
    if(tile.type==='river') produceVal-=1;

    tile.buildingProduce=produceVal;
    tile.buildingPlaced=true;
    const hex=mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    hex.textContent= cardElem.querySelector('.card-name').innerText;
    cardElem.remove();

    if(tile.type==='slum'){
      recalcSlumBonus(); 
    } else {
      // 若不是 slum => 直接更新回合收益
      roundRevenue += tile.buildingProduce;
      updateResourceDisplay();
    }
  }

  // BFS：修正 => 先把所有 slum tile produce 重置，再統一 +1
  function recalcSlumBonus(){
    console.log("recalcSlumBonus()");
    // A) 先重置所有slum tile的產出(基礎:6 ± city/river)
    tileMap.forEach(t=>{
      if(t.buildingPlaced && t.type==='slum'){
        t.slumBonusGranted=false;
        let base=6;
        // city => +2 => 這裡沒有 city+slum 同時出現理論? (若地圖可同時 city+slum？那就 base+2)
        // 但如果地圖類型只單選: city / slum / river / wasteland
        // -> 只要保留這裡給未來擴充
        if(t.type==='city')  base+=2;
        if(t.type==='river') base-=1;
        t.buildingProduce=base;
      }
    });

    // B) BFS => cluster >=3 => +1
    const visited=new Set();
    tileMap.forEach(tile=>{
      if(tile.type==='slum' && tile.buildingPlaced && !visited.has(tile.id)){
        let cluster=[];
        let queue=[tile.id];
        while(queue.length>0){
          let curr=queue.shift();
          if(visited.has(curr)) continue;
          visited.add(curr);
          const currTile=tileMap.find(x=>x.id===curr);
          if(currTile && currTile.type==='slum' && currTile.buildingPlaced){
            cluster.push(currTile);
            currTile.adjacency.forEach(nbId=>{
              if(!visited.has(nbId)){
                const nbT = tileMap.find(x=>x.id===nbId);
                if(nbT && nbT.type==='slum' && nbT.buildingPlaced){
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

    // C) 統一重新計算 roundRevenue
    recalcRevenueFromScratch();
  }

  // 重新計算回合收益
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

  // 回合結束 => 把 roundRevenue 加到 currentGold
  endTurnBtn.addEventListener('click', ()=>{
    currentGold += roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    // 進下一回合
    window.startDrawPhase();
  });

  // 監聽鍵盤 => startGame
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
  closeInfoBtn.addEventListener('click', ()=>{
    infoModal.style.display='none';
  });
};
