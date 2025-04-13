let cardIdCounter = 0;

window.onload = function() {
  let currentRound = 1;
  let currentGold = 0;
  let roundRevenue = 0;
  let refreshCount = 0;

  console.log("Script Loaded: in onload.");

  // DOM
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

  // 8張卡池
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
    "繁華區":"若此建築蓋在city地塊,回合結束+4",
    "貧民窟":"若在slum地塊,相鄰帶貧民窟=>+1",
    "河流":"若在river地塊,回合結束+3&翻倍(暫不)",
    "荒原":"50%不產出,50%轉slum(暫不)"
  };

  // 建立地塊
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
      let count=rows[r];
      for(let c=0;c<count;c++){
        map.push({
          id:idCounter,
          row:r,
          col:c,
          type:typeMapping[idCounter],
          buildingProduce:0,
          buildingPlaced:false,
          slumBonusGranted:false,
          adjacency:[],
          label:""
        });
        idCounter++;
      }
    }
    return map;
  }
  let tileMap=createTileMap31();

  // adjacency
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
    console.log("initMapArea() called");
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

      // 拖曳
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

  // 洗牌
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  // 生成卡牌 DOM
  function createBuildingCard(info){
    const card=document.createElement('div');
    card.className='card';
    card.dataset.type='building';
    card.dataset.produce=info.baseProduce; 
    card.dataset.cardId=++cardIdCounter;
    card.dataset.label=info.label;

    card.innerHTML=`
      <div class="card-gold-output">${info.baseProduce}</div>
      <div class="card-image-area"></div>
      <div class="card-name">${info.name}</div>
      <div class="card-rarity">${info.rarity}</div>
      <div class="card-label">${info.label}</div>
      <div class="tooltip">${info.label}：${labelEffectDesc[info.label]||""}</div>
    `;
    card.draggable=true;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('cardId', card.dataset.cardId);
      e.dataTransfer.setData('text/plain', info.name);
      setTimeout(()=>{ card.style.display='none'; },0);
    });
    card.addEventListener('dragend', e=>{
      card.style.display='';
    });
    return card;
  }

  function drawCards(){
    console.log("drawCards() called.");
    cardPool.innerHTML='';
    const arr=shuffle(cardPoolData.slice());
    const five=arr.slice(0,5);
    five.forEach(info=>{
      const card=createBuildingCard(info);
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
    console.log("refreshCards() called");
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
    console.log("skipDraw() called");
    currentGold+=10;
    updateResourceDisplay();
    drawSection.style.display='none';
  };

  window.confirmDraw=function(){
    console.log("confirmDraw() called, selectedCards=", selectedCards.length);
    if(selectedCards.length<2){
      alert("請至少選 2 張卡牌!");
      return;
    }
    selectedCards.forEach(c=>{
      const baseP=parseInt(c.dataset.produce)||6;
      const cName=c.querySelector('.card-name').innerText;
      const cRarity=c.querySelector('.card-rarity').innerText;
      const cLabel=c.querySelector('.card-label').innerText;

      const newC=document.createElement('div');
      newC.className='card';
      newC.dataset.type='building';
      newC.dataset.produce=baseP;
      newC.dataset.cardId=++cardIdCounter;
      newC.dataset.label=cLabel;

      newC.innerHTML=`
        <div class="card-gold-output">${baseP}</div>
        <div class="card-image-area"></div>
        <div class="card-name">${cName}</div>
        <div class="card-rarity">${cRarity}</div>
        <div class="card-label">${cLabel}</div>
        <div class="tooltip">${cLabel}：${labelEffectDesc[cLabel]||""}</div>
      `;
      newC.draggable=true;
      newC.addEventListener('dragstart', ee=>{
        ee.dataTransfer.setData('cardId', newC.dataset.cardId);
        ee.dataTransfer.setData('text/plain', cName);
        setTimeout(()=>{ newC.style.display='none'; },0);
      });
      newC.addEventListener('dragend', ee=>{
        newC.style.display='';
      });
      hand.appendChild(newC);
    });
    drawSection.style.display='none';
  };

  window.startDrawPhase=function(){
    console.log("startDrawPhase()");
    refreshCount=0;
    selectedCards.length=0;
    updateRefreshButton();
    drawSection.style.display='flex';
    drawCards();
  };

  /*********************
   * placeBuildingOnTile
   *********************/
  function placeBuildingOnTile(tile, cardElem){
    console.log("placeBuildingOnTile => tile#"+tile.id,"type=",tile.type);
    if(tile.buildingPlaced){
      roundRevenue-=tile.buildingProduce;
      tile.buildingProduce=0;
      tile.slumBonusGranted=false;
    }
    let produceVal=parseInt(cardElem.dataset.produce)||6;
    // city => +1
    if(tile.type==='city') produceVal+=1;
    // river => -1
    if(tile.type==='river') produceVal-=1;

    tile.buildingProduce=produceVal;
    tile.buildingPlaced=true;
    tile.label=cardElem.dataset.label;

    const hex=mapArea.querySelector(`[data-tile-id="${tile.id}"]`);
    const bName=cardElem.querySelector('.card-name').innerText;
    hex.textContent=bName;
    cardElem.remove();

    if(tile.type==='slum'){
      checkSlumClusterAndAddBonus(tile.id);
    } else {
      roundRevenue+=tile.buildingProduce;
      updateResourceDisplay();
    }
  }

  // BFS => slum cluster >=3 => +1
  function checkSlumClusterAndAddBonus(startId){
    console.log("checkSlumCluster start from tile#"+startId);
    const visited=new Set();
    const queue=[startId];
    const cluster=[];
    while(queue.length>0){
      const currId=queue.shift();
      if(visited.has(currId)) continue;
      visited.add(currId);
      const t=tileMap.find(x=>x.id===currId);
      if(t && t.type==='slum' && t.buildingPlaced){
        cluster.push(t);
        t.adjacency.forEach(nbId=>{
          const nb=tileMap.find(xx=>xx.id===nbId);
          if(nb && nb.type==='slum' && nb.buildingPlaced && !visited.has(nbId)){
            queue.push(nbId);
          }
        });
      }
    }
    console.log("cluster =>", cluster.map(x=>x.id));
    if(cluster.length>=3){
      cluster.forEach(ct=>{
        if(!ct.slumBonusGranted){
          roundRevenue-=ct.buildingProduce;
          ct.buildingProduce+=1;
          ct.slumBonusGranted=true;
          roundRevenue+=ct.buildingProduce;
        }
      });
      updateResourceDisplay();
    }
  }

  // 回合結束 => label effect => recalc => gold += roundRevenue
  endTurnBtn.addEventListener('click', ()=>{
    console.log("endTurn => apply label effect => recalc => add gold");
    applyLabelEffects();
    recalcRevenueFromScratch();
    currentGold+=roundRevenue;
    currentRound++;
    updateRoundDisplay();
    updateResourceDisplay();
    window.startDrawPhase();
  });

  function applyLabelEffects(){
    tileMap.forEach(tile=>{
      if(tile.buildingPlaced){
        // "繁華區"標籤 + city地塊 => +4
        if(tile.label==='繁華區' && tile.type==='city'){
          tile.buildingProduce+=4;
        }
      }
    });
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

  // 監聽鍵盤 => 進入遊戲
  document.addEventListener('keydown', e=>{
    console.log("keydown =>", e.key,"startScreen?", startScreen.style.display);
    if(startScreen.style.display!=='none' && (e.key==='Enter' || e.key==='NumpadEnter')){
      startGame();
    }
  });
  startBtn.addEventListener('click', e=>{
    console.log("startBtn clicked");
    startGame();
  });

  function startGame(){
    console.log("startGame() called");
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

  console.log("Script loaded: end of onload.");
};
