
function onDragStart(event) {
  event.dataTransfer.setData("text/plain", event.target.dataset.card);
}

function allowDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add("highlight");
}

function onDrop(event) {
  event.preventDefault();
  const cardName = event.dataTransfer.getData("text/plain");
  event.currentTarget.textContent = cardName;
  event.currentTarget.classList.remove("highlight");
}

function onDragLeave(event) {
  event.currentTarget.classList.remove("highlight");
}

function initTiles() {
  const container = document.getElementById("tiles-container");
  for (let i = 0; i < 6; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.ondragover = allowDrop;
    tile.ondrop = onDrop;
    tile.ondragleave = onDragLeave;
    container.appendChild(tile);
  }
}

window.onload = initTiles;
