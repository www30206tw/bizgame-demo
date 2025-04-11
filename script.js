
const drawSection = document.getElementById('draw-section');
const cardPoolDiv = document.getElementById('card-pool');
const handDiv = document.getElementById('hand');

let drawCards = [];
let selectedIndices = [];

function startDrawPhase() {
  drawCards = generateCards(5);
  selectedIndices = [];
  renderDrawCards();
  drawSection.style.display = 'block';
}
function generateCards(n) {
  const sample = ['建築卡 A', '建築卡 B', '建築卡 C', '建築卡 D', '科技卡 A', '科技卡 B'];
  const result = [];
  for (let i = 0; i < n; i++) {
    const r = sample[Math.floor(Math.random() * sample.length)];
    result.push(r);
  }
  return result;
}
function renderDrawCards() {
  cardPoolDiv.innerHTML = '';
  drawCards.forEach((card, idx) => {
    const div = document.createElement('div');
    div.className = 'card' + (selectedIndices.includes(idx) ? ' selected' : '');
    div.innerText = card;
    div.onclick = () => toggleSelect(idx);
    cardPoolDiv.appendChild(div);
  });
}
function toggleSelect(idx) {
  if (selectedIndices.includes(idx)) {
    selectedIndices = selectedIndices.filter(i => i !== idx);
  } else if (selectedIndices.length < 2) {
    selectedIndices.push(idx);
  }
  renderDrawCards();
}
function refreshCards() {
  drawCards = generateCards(5);
  selectedIndices = [];
  renderDrawCards();
}
function skipDraw() {
  drawSection.style.display = 'none';
  console.log("跳過抽卡 +10金幣");
}
function confirmDraw() {
  const chosen = selectedIndices.map(i => drawCards[i]);
  chosen.forEach(c => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerText = c;
    handDiv.appendChild(d);
  });
  drawSection.style.display = 'none';
}
