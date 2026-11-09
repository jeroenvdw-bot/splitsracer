(function () {
  "use strict";

  const NS = (window.Splitsracer = window.Splitsracer || {});

  const WORLD_WIDTH = 900;
  const PLAYER_ROAD = { left: 100, right: 540 };
  const PLAYER_CENTER = 320;
  const OPPONENT_ROAD = { left: 600, right: 800 };
  const OPPONENT_CENTER = 700;
  const LEFT_BRANCH_X = 193;
  const RIGHT_BRANCH_X = 447;
  const STOP_OFFSET = 120;
  const DIVERGE = 240;
  const MERGE_START = 640;
  const MERGE_END = 900;
  const ISLAND_HALF = 34;
  const CARD_Y_OFFSET = 270;
  const CARD_SIZE = 140;
  const CARD_REVEAL_TIME = 0.7;
  const SIGN_Y_OFFSET = 90;
  const GRASS_COLOR = "#2ab766";
  const ASPHALT = "#9cc0c2";
  const ASPHALT_EDGE = "#86afb2";
  const CURB_WHITE = "#f4f4ee";
  const CURB_ORANGE = "#dd6213";
  const INK = "#173b46";
  const FONT = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function splitGeometry(split) {
    const forkY = split.y;
    return {
      forkY,
      stopY: forkY - STOP_OFFSET,
      divergeEndY: forkY + DIVERGE,
      mergeStartY: forkY + MERGE_START,
      mergeEndY: forkY + MERGE_END,
    };
  }

  function branchX(split, side, y) {
    const geometry = splitGeometry(split);
    const target = side === "left" ? LEFT_BRANCH_X : RIGHT_BRANCH_X;
    if (y <= geometry.forkY || y >= geometry.mergeEndY) return PLAYER_CENTER;
    if (y <= geometry.divergeEndY) {
      const t = smoothstep((y - geometry.forkY) / DIVERGE);
      return PLAYER_CENTER + (target - PLAYER_CENTER) * t;
    }
    if (y <= geometry.mergeStartY) return target;
    const t = smoothstep((y - geometry.mergeStartY) / (MERGE_END - MERGE_START));
    return target + (PLAYER_CENTER - target) * t;
  }

  function cardRect(split, side) {
    const geometry = splitGeometry(split);
    return {
      x: side === "left" ? LEFT_BRANCH_X : RIGHT_BRANCH_X,
      y: geometry.forkY + CARD_Y_OFFSET,
      w: CARD_SIZE,
      h: CARD_SIZE,
    };
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildScenery(finishY, seed) {
    const random = mulberry32(seed || 0x5eed1234);
    const items = [];
    const kinds = ["tree_large", "tree_small", "rock1", "rock2", "rock3"];

    for (let y = -900; y < finishY + 1400; y += 170) {
      if (random() < 0.86) {
        items.push({
          kind: random() < 0.62 ? "tree_large" : "tree_small",
          x: 12 + random() * 58,
          y: y + random() * 90,
          scale: 0.28 + random() * 0.16,
          rot: (random() - 0.5) * 0.5,
        });
      }
      if (random() < 0.86) {
        items.push({
          kind: random() < 0.62 ? "tree_large" : "tree_small",
          x: 830 + random() * 58,
          y: y + random() * 90,
          scale: 0.28 + random() * 0.16,
          rot: (random() - 0.5) * 0.5,
        });
      }
      if (random() < 0.7) {
        const kind = random() < 0.58 ? "tree_small" : kinds[2 + Math.floor(random() * 3)];
        items.push({
          kind,
          x: 555 + random() * 34,
          y: y + random() * 110,
          scale: kind === "tree_small" ? 0.16 + random() * 0.07 : 0.24 + random() * 0.1,
          rot: (random() - 0.5) * 0.7,
        });
      }
    }
    items.sort((a, b) => b.y - a.y);
    return items;
  }

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function drawGrass(ctx, view) {
    const left = 450 - view.viewW / 2;
    const right = 450 + view.viewW / 2;
    const bottom = view.cameraBottomY;
    const top = view.cameraTopY;
    const scale = view.scale;

    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, 0, view.cssW, view.cssH);

    // Graspoljes en bloemetjes op een wereldvast raster: geen zichtbare tegelherhaling.
    const cell = 96;
    const startX = Math.floor(left / cell) * cell;
    const startY = Math.floor(bottom / cell) * cell;
    ctx.save();
    ctx.lineCap = "round";
    for (let worldY = startY; worldY < top + cell; worldY += cell) {
      for (let worldX = startX; worldX < right + cell; worldX += cell) {
        const h = hash2(worldX, worldY);
        if (h < 0.3) continue;
        const x = worldX + hash2(worldY, worldX) * cell;
        const y = worldY + h * cell;
        const height = 5 + hash2(worldX + 7, worldY) * 6;
        ctx.strokeStyle = "rgba(22, 126, 67, 0.34)";
        ctx.lineWidth = 1.7 * scale;
        ctx.beginPath();
        for (let blade = -1; blade <= 1; blade += 1) {
          ctx.moveTo(view.sx(x), view.sy(y));
          ctx.quadraticCurveTo(
            view.sx(x + blade * 2.4),
            view.sy(y + height * 0.55),
            view.sx(x + blade * 4.2),
            view.sy(y + height)
          );
        }
        ctx.stroke();

        if (h > 0.9) {
          ctx.fillStyle = "rgba(255, 246, 186, 0.8)";
          ctx.beginPath();
          ctx.arc(view.sx(x + 3), view.sy(y + 2), 1.8 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawScenery(ctx, view, items, images) {
    if (!items || !items.length) return;
    const bottom = view.cameraBottomY - 220;
    const top = view.cameraTopY + 220;
    for (const item of items) {
      if (item.y < bottom || item.y > top) continue;
      const image = images[item.kind];
      if (!image) continue;
      const width = image.naturalWidth * item.scale * view.scale;
      const height = image.naturalHeight * item.scale * view.scale;
      ctx.save();
      ctx.translate(view.sx(item.x), view.sy(item.y));
      ctx.rotate(item.rot || 0);
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
  }

  function roadGradient(ctx, view, left, right) {
    const gradient = ctx.createLinearGradient(view.sx(left), 0, view.sx(right), 0);
    gradient.addColorStop(0, ASPHALT_EDGE);
    gradient.addColorStop(0.18, ASPHALT);
    gradient.addColorStop(0.5, "#a8cbcd");
    gradient.addColorStop(0.82, ASPHALT);
    gradient.addColorStop(1, ASPHALT_EDGE);
    return gradient;
  }

  function fillVerticalRoad(ctx, view, left, right, top, bottom) {
    const x = view.sx(left);
    const width = (right - left) * view.scale;
    const y = view.sy(top);
    const height = (top - bottom) * view.scale;
    ctx.fillStyle = roadGradient(ctx, view, left, right);
    ctx.fillRect(x, y, width, height);
  }

  function drawCheckerBand(ctx, view, x0, x1, y, rows, square) {
    const left = view.sx(x0);
    const right = view.sx(x1);
    const cell = square * view.scale;
    const top = view.sy(y + (rows * square) / 2);
    const height = rows * cell;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, height);
    ctx.clip();
    ctx.fillStyle = "#f4f4ee";
    ctx.fillRect(left, top, right - left, height);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column * cell < right - left; column += 1) {
        if ((row + column) % 2 === 0) {
          ctx.fillStyle = "#243336";
          ctx.fillRect(left + column * cell, top + row * cell, cell, cell);
        }
      }
    }
    ctx.strokeStyle = "rgba(22, 44, 48, 0.35)";
    ctx.lineWidth = Math.max(1, 2 * view.scale);
    ctx.strokeRect(left, top, right - left, height);
    ctx.restore();
  }

  function drawRoadBase(ctx, view, race) {
    const top = view.cameraTopY + 400;
    const bottom = view.cameraBottomY - 400;

    fillVerticalRoad(ctx, view, PLAYER_ROAD.left, PLAYER_ROAD.right, top, bottom);
    fillVerticalRoad(ctx, view, OPPONENT_ROAD.left, OPPONENT_ROAD.right, top, bottom);

    // Start- en finishlijn op beide banen.
    if (race.startLineY !== null && race.startLineY !== undefined) {
      if (race.startLineY < top && race.startLineY > bottom) {
        drawCheckerBand(ctx, view, PLAYER_ROAD.left, PLAYER_ROAD.right, race.startLineY, 2, 20);
        drawCheckerBand(ctx, view, OPPONENT_ROAD.left, OPPONENT_ROAD.right, race.startLineY, 2, 20);
      }
    }
    if (race.finishY && race.finishY < top && race.finishY > bottom) {
      drawCheckerBand(ctx, view, PLAYER_ROAD.left, PLAYER_ROAD.right, race.finishY, 3, 20);
      drawCheckerBand(ctx, view, OPPONENT_ROAD.left, OPPONENT_ROAD.right, race.finishY, 3, 20);
    }
  }

  function drawVerticalCurb(ctx, view, x) {
    const top = view.cameraTopY + 400;
    const bottom = view.cameraBottomY - 400;
    const screenX = view.sx(x);
    const y0 = view.sy(top);
    const y1 = view.sy(bottom);
    const scale = view.scale;

    ctx.save();
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(screenX, y0);
    ctx.lineTo(screenX, y1);

    ctx.strokeStyle = "rgba(44, 70, 74, 0.55)";
    ctx.lineWidth = 16 * scale;
    ctx.stroke();

    ctx.strokeStyle = CURB_WHITE;
    ctx.lineWidth = 12 * scale;
    ctx.stroke();

    ctx.strokeStyle = CURB_ORANGE;
    ctx.lineWidth = 12 * scale;
    ctx.setLineDash([20 * scale, 20 * scale]);
    ctx.lineDashOffset = -view.cameraBottomY * scale;
    ctx.stroke();
    ctx.restore();
  }

  function drawCenterLines(ctx, view, race) {
    const top = view.cameraTopY + 400;
    const bottom = view.cameraBottomY - 400;
    const scale = view.scale;

    ctx.save();
    ctx.strokeStyle = "rgba(248, 248, 242, 0.85)";
    ctx.lineWidth = 6 * scale;
    ctx.setLineDash([26 * scale, 26 * scale]);
    ctx.lineDashOffset = -view.cameraBottomY * scale;

    for (const x of [PLAYER_CENTER, OPPONENT_CENTER]) {
      ctx.beginPath();
      ctx.moveTo(view.sx(x), view.sy(top));
      ctx.lineTo(view.sx(x), view.sy(bottom));
      ctx.stroke();
    }
    ctx.restore();
  }

  function islandPath(ctx, view, split) {
    const geometry = splitGeometry(split);
    const left = PLAYER_CENTER - ISLAND_HALF;
    const right = PLAYER_CENTER + ISLAND_HALF;
    const tip = geometry.forkY;
    const full = geometry.divergeEndY;
    const mergeStart = geometry.mergeStartY;
    const mergeEnd = geometry.mergeEndY;

    ctx.beginPath();
    ctx.moveTo(view.sx(PLAYER_CENTER), view.sy(tip));
    ctx.quadraticCurveTo(view.sx(left), view.sy(tip + 74), view.sx(left), view.sy(full));
    ctx.lineTo(view.sx(left), view.sy(mergeStart));
    ctx.quadraticCurveTo(view.sx(left), view.sy(mergeEnd - 74), view.sx(PLAYER_CENTER), view.sy(mergeEnd));
    ctx.quadraticCurveTo(view.sx(right), view.sy(mergeEnd - 74), view.sx(right), view.sy(mergeStart));
    ctx.lineTo(view.sx(right), view.sy(full));
    ctx.quadraticCurveTo(view.sx(right), view.sy(tip + 74), view.sx(PLAYER_CENTER), view.sy(tip));
    ctx.closePath();
  }

  function drawIslands(ctx, view, race, now) {
    const scale = view.scale;
    for (const split of race.splits) {
      const geometry = splitGeometry(split);
      if (geometry.mergeEndY < view.cameraBottomY - 100) continue;
      if (geometry.forkY > view.cameraTopY + 100) continue;

      islandPath(ctx, view, split);
      ctx.fillStyle = "#249f59";
      ctx.fill();

      // Grastextuur op het eilandje.
      ctx.save();
      islandPath(ctx, view, split);
      ctx.clip();
      ctx.globalAlpha = 0.22;
      const random = mulberry32(Math.floor(split.y));
      for (let i = 0; i < 14; i += 1) {
        const x = PLAYER_CENTER - ISLAND_HALF + random() * ISLAND_HALF * 2;
        const y = geometry.forkY + 80 + random() * (MERGE_START - 100);
        ctx.fillStyle = i % 2 ? "#1c8a4c" : "#44c579";
        ctx.beginPath();
        ctx.arc(view.sx(x), view.sy(y), (2 + random() * 4) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      islandPath(ctx, view, split);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(44, 70, 74, 0.55)";
      ctx.lineWidth = 17 * scale;
      ctx.stroke();

      islandPath(ctx, view, split);
      ctx.strokeStyle = CURB_WHITE;
      ctx.lineWidth = 12 * scale;
      ctx.stroke();

      islandPath(ctx, view, split);
      ctx.strokeStyle = CURB_ORANGE;
      ctx.lineWidth = 12 * scale;
      ctx.setLineDash([20 * scale, 20 * scale]);
      ctx.lineDashOffset = -view.cameraBottomY * scale;
      ctx.stroke();
      ctx.setLineDash([]);

      // Gestippelde rijbaanlijnen op de aftakkingen.
      for (const side of ["left", "right"]) {
        ctx.beginPath();
        let started = false;
        for (let y = geometry.forkY + 90; y <= geometry.mergeEndY - 90; y += 30) {
          const x = branchX(split, side, y);
          if (!started) {
            ctx.moveTo(view.sx(x), view.sy(y));
            started = true;
          } else {
            ctx.lineTo(view.sx(x), view.sy(y));
          }
        }
        ctx.strokeStyle = "rgba(248, 248, 242, 0.62)";
        ctx.lineWidth = 4.5 * scale;
        ctx.setLineDash([18 * scale, 22 * scale]);
        ctx.lineDashOffset = -view.cameraBottomY * scale;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawCards(ctx, view, race, now) {
    const scale = view.scale;
    for (const split of race.splits) {
      const geometry = splitGeometry(split);
      if (geometry.mergeEndY < view.cameraBottomY - 120) continue;
      if (geometry.forkY > view.cameraTopY + 120) continue;

      let reveal = 1;
      if (split.resolved) {
        reveal = 1 - (now - split.resolvedAt) / CARD_REVEAL_TIME;
        if (reveal <= 0) continue;
      }

      const active =
        race.currentSplit === split ||
        (!split.resolved && race.splits[race.nextSplitIndex] === split);

      for (const side of ["left", "right"]) {
        const rect = cardRect(split, side);
        const chosen = split.resolved && split.chosenSide === side;
        const correctHere = chosen && split.correct;
        const wrongHere = chosen && !split.correct;
        const pulse = active ? 1 + Math.sin(now * 4 + (side === "left" ? 0 : 1.7)) * 0.025 : 1;
        const width = rect.w * scale * pulse;
        const height = rect.h * scale * pulse;
        const centerX = view.sx(rect.x);
        const centerY = view.sy(rect.y);

        ctx.save();
        ctx.globalAlpha = clamp(reveal, 0, 1);

        // Schaduw.
        ctx.fillStyle = "rgba(18, 44, 38, 0.28)";
        ctx.beginPath();
        ctx.roundRect(
          centerX - width / 2 + 6 * scale,
          centerY - height / 2 + 10 * scale,
          width,
          height,
          18 * scale
        );
        ctx.fill();

        // Kaart.
        ctx.fillStyle = correctHere ? "#d8f6de" : wrongHere ? "#ffd9c7" : "#fff9ec";
        ctx.beginPath();
        ctx.roundRect(centerX - width / 2, centerY - height / 2, width, height, 18 * scale);
        ctx.fill();

        // Rand.
        let border = CURB_ORANGE;
        if (correctHere) border = "#1f9d55";
        if (wrongHere) border = "#d9412b";
        ctx.strokeStyle = border;
        ctx.lineWidth = 10 * scale * pulse;
        ctx.stroke();

        // Binnenrandje.
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.roundRect(
          centerX - width / 2 + 8 * scale,
          centerY - height / 2 + 8 * scale,
          width - 16 * scale,
          height - 16 * scale,
          12 * scale
        );
        ctx.stroke();

        // Getal.
        ctx.fillStyle = correctHere ? "#116b3a" : wrongHere ? "#9c2b1c" : INK;
        ctx.font = "900 " + Math.round(86 * scale * pulse) + "px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(side === "left" ? split.left : split.right), centerX, centerY + 4 * scale);

        ctx.restore();
      }
    }
  }

  function drawGantry(ctx, view, centerX, y, width, boardWidth, boardHeight, color) {
    const scale = view.scale;
    const left = centerX - width / 2;
    const right = centerX + width / 2;
    const topY = y + boardHeight * 0.42;
    const bottomY = y - boardHeight * 0.6;

    ctx.save();
    ctx.fillStyle = "rgba(38, 66, 70, 0.9)";
    const postWidth = 13 * scale;
    ctx.fillRect(view.sx(left) - postWidth / 2, view.sy(topY), postWidth, (topY - bottomY) * scale);
    ctx.fillRect(view.sx(right) - postWidth / 2, view.sy(topY), postWidth, (topY - bottomY) * scale);
    ctx.fillRect(
      view.sx(left) - postWidth / 2,
      view.sy(topY) - 8 * scale,
      (right - left) * scale + postWidth,
      14 * scale
    );

    // Bord.
    const boardLeft = view.sx(centerX) - (boardWidth / 2) * scale;
    const boardTop = view.sy(y + boardHeight / 2);
    const boardW = boardWidth * scale;
    const boardH = boardHeight * scale;
    ctx.fillStyle = "rgba(18, 44, 38, 0.25)";
    ctx.beginPath();
    ctx.roundRect(boardLeft + 6 * scale, boardTop + 9 * scale, boardW, boardH, 16 * scale);
    ctx.fill();
    ctx.fillStyle = color || "#fff9ec";
    ctx.beginPath();
    ctx.roundRect(boardLeft, boardTop, boardW, boardH, 16 * scale);
    ctx.fill();
    ctx.strokeStyle = CURB_ORANGE;
    ctx.lineWidth = 8 * scale;
    ctx.stroke();
    ctx.restore();
  }

  function drawSplitSigns(ctx, view, race, now) {
    const scale = view.scale;
    for (const split of race.splits) {
      const geometry = splitGeometry(split);
      if (geometry.mergeEndY < view.cameraBottomY - 160) continue;
      if (geometry.forkY > view.cameraTopY + 160) continue;

      const y = geometry.forkY + SIGN_Y_OFFSET;
      drawGantry(ctx, view, 320, y, 480, 280, 150);

      const centerX = view.sx(320);
      const centerY = view.sy(y);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Totaal.
      ctx.fillStyle = INK;
      ctx.font = "900 " + Math.round(68 * scale) + "px " + FONT;
      ctx.fillText(String(split.total), centerX, centerY - 27 * scale);

      // Splitsdiagram.
      ctx.strokeStyle = "rgba(23, 59, 70, 0.65)";
      ctx.lineWidth = 4 * scale;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 3 * scale);
      ctx.lineTo(centerX, centerY + 17 * scale);
      ctx.moveTo(centerX, centerY + 17 * scale);
      ctx.lineTo(centerX - 48 * scale, centerY + 34 * scale);
      ctx.moveTo(centerX, centerY + 17 * scale);
      ctx.lineTo(centerX + 48 * scale, centerY + 34 * scale);
      ctx.stroke();

      ctx.font = "900 " + Math.round(42 * scale) + "px " + FONT;
      ctx.fillStyle = INK;
      ctx.fillText(String(split.given), centerX - 48 * scale, centerY + 52 * scale);

      const reveal = split.resolved && now - split.resolvedAt < 1.2;
      if (reveal) {
        ctx.fillStyle = split.correct ? "#147a43" : "#b3311f";
        ctx.font = "900 " + Math.round(44 * scale) + "px " + FONT;
        ctx.fillText(String(split.answer), centerX + 48 * scale, centerY + 52 * scale);
      } else {
        ctx.fillStyle = CURB_ORANGE;
        ctx.font = "900 " + Math.round(48 * scale) + "px " + FONT;
        ctx.fillText("?", centerX + 48 * scale, centerY + 52 * scale);
      }
      ctx.restore();
    }
  }

  function drawFinishBanner(ctx, view, race) {
    if (!race.finishY) return;
    if (race.finishY < view.cameraBottomY - 200 || race.finishY > view.cameraTopY + 200) return;

    const y = race.finishY + 190;
    drawGantry(ctx, view, 450, y, 760, 700, 120);
    const scale = view.scale;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.font = "900 " + Math.round(66 * scale) + "px " + FONT;
    ctx.fillText("FINISH", view.sx(450), view.sy(y) + 4 * scale);
    ctx.restore();
  }

  function drawWorld(ctx, view, race, images, now) {
    drawGrass(ctx, view);
    drawScenery(ctx, view, race.scenery, images);
    drawRoadBase(ctx, view, race);
    drawCenterLines(ctx, view, race);
    drawIslands(ctx, view, race, now);
    drawCards(ctx, view, race, now);

    drawVerticalCurb(ctx, view, PLAYER_ROAD.left);
    drawVerticalCurb(ctx, view, PLAYER_ROAD.right);
    drawVerticalCurb(ctx, view, OPPONENT_ROAD.left);
    drawVerticalCurb(ctx, view, OPPONENT_ROAD.right);
  }

  function drawOverlays(ctx, view, race, now) {
    drawSplitSigns(ctx, view, race, now);
    drawFinishBanner(ctx, view, race);
  }

  NS.Road = {
    WORLD_WIDTH,
    PLAYER_ROAD,
    PLAYER_CENTER,
    OPPONENT_ROAD,
    OPPONENT_CENTER,
    LEFT_BRANCH_X,
    RIGHT_BRANCH_X,
    STOP_OFFSET,
    DIVERGE,
    MERGE_START,
    MERGE_END,
    ISLAND_HALF,
    CARD_Y_OFFSET,
    CARD_SIZE,
    CARD_REVEAL_TIME,
    splitGeometry,
    branchX,
    cardRect,
    buildScenery,
    drawWorld,
    drawOverlays,
  };
})();
