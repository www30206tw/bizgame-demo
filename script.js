
const allCards = ["科技卡 A", "科技卡 B", "建築卡 A", "建築卡 B", "建築卡 C", "建築卡 D"];

function startDrawPhase() {
  document.getElementById("draw-section").style.display = "flex";
  drawCards();
}

function drawCards() {
  const cardPool = document.getElementById("card-pool");
  cardPool.innerHTML = "";
  const selected = [];
  while (selected.length < 5) {
    const random = allCards[Math.floor(Math.random() * allCards.length)];
    if (!selected.includes(random)) selected.push(random);
  }
  for (let name of selected) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = name;
    div.onclick = () => {
      const currentlySelected = document.querySelectorAll(".card.selected");
      if (div.classList.contains("selected")) {
        div.classList.remove("selected");
      } else if (currentlySelected.length < 2) {
        div.classList.add("selected");
      }
    };
    cardPool.appendChild(div);
  }
}

function refreshCards() {
  drawCards();
}

function skipDraw() {
  alert("跳過抽卡，本回合 +10 金幣");
  document.getElementById("draw-section").style.display = "none";
}

function confirmDraw() {
  const selected = document.querySelectorAll(".card.selected");
  if (selected.length !== 2) {
    alert("請選擇 2 張卡片");
    return;
  }
  const hand = document.querySelector(".hand-cards");
  selected.forEach(card => {
    const clone = card.cloneNode(true);
    clone.classList.remove("selected");
    hand.appendChild(clone);
  });
  document.getElementById("draw-section").style.display = "none";
}
