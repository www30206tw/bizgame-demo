document.addEventListener("DOMContentLoaded", () => {
  const hand = document.getElementById("hand");
  const map = document.getElementById("map-area");

  function createCard(name) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerText = name;
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", name);
    });
    return card;
  }

  hand.appendChild(createCard("建築卡 A"));
  hand.appendChild(createCard("科技卡 B"));

  map.addEventListener("dragover", (e) => e.preventDefault());
  map.addEventListener("drop", (e) => {
    e.preventDefault();
    const name = e.dataTransfer.getData("text/plain");
    const block = document.createElement("div");
    block.className = "placed-card";
    block.innerText = name;
    map.appendChild(block);
  });
});
