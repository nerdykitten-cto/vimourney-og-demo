-- Draws every sprite of Buffer Overflow with Aseprite's scripting API.
-- Run: game/art/build.sh   (aseprite -b --script build.lua)
local OUT = app.params["out"] or "."

local P = {
  ["."] = nil,
  o = "#0b0f16", a = "#5af78e", A = "#2fa65a", b = "#57c7ff", B = "#2b7fb0",
  y = "#f3d36b", Y = "#b08d2c", r = "#ff5c57", R = "#a2312f", p = "#ff6ac1",
  P = "#9c3a7c", w = "#e8eef6", g = "#64748b", G = "#2b3b50", s = "#3d5470",
  d = "#1c2736", f = "#0d131a", F = "#111923", n = "#ffb86c", N = "#b36f2c",
  v = "#8b5cf6", V = "#4c2d9c",
}

local function color(ch)
  local hex = P[ch]
  if not hex then return nil end
  return Color{ r = tonumber(hex:sub(2, 3), 16), g = tonumber(hex:sub(4, 5), 16), b = tonumber(hex:sub(6, 7), 16), a = 255 }
end

local function put(img, x, y, ch)
  local c = color(ch)
  if c and x >= 0 and y >= 0 and x < img.width and y < img.height then img:putPixel(x, y, c) end
end

local function rect(img, x, y, w, h, ch)
  for j = y, y + h - 1 do for i = x, x + w - 1 do put(img, i, j, ch) end end
end

-- A sprite is `rows` of left-half strings, mirrored to the right.
local function mirrored(img, rows, ox, oy)
  for y, row in ipairs(rows) do
    local n = #row
    for x = 1, n do
      local ch = row:sub(x, x)
      put(img, ox + x - 1, oy + y - 1, ch)
      put(img, ox + 2 * n - x, oy + y - 1, ch)
    end
  end
end

local function full(img, rows, ox, oy)
  for y, row in ipairs(rows) do
    for x = 1, #row do put(img, ox + x - 1, oy + y - 1, row:sub(x, x)) end
  end
end

--- Make a sprite with `frames` frames; `draw(img, frame)` paints a fresh image per frame.
local function make(name, w, h, frames, draw)
  local s = Sprite(w, h, ColorMode.RGB)
  for f = 1, frames do
    if f > 1 then s:newEmptyFrame() end
    local img = Image(w, h, ColorMode.RGB)
    draw(img, f)
    s:newCel(s.layers[1], f, img, Point(0, 0))
    s.frames[f].duration = 0.4
  end
  s:saveAs(OUT .. "/" .. name .. ".aseprite")
  s:close()
end

-- Actor bob: frame 2 is the body one pixel lower with a shadow row kept.
local function actor(name, rows, extra)
  make(name, 16, 16, 2, function(img, f)
    mirrored(img, rows, 0, f == 2 and 1 or 0)
    if extra then extra(img, f) end
  end)
end

actor("player", {
  "........", "........", "....oooo", "...obbbb", "..obbbbb", "..obwwbb", "..obwoBb", "..obbbbb",
  "..oBBBBB", "...obbbb", "..oobbbb", "..obbBBB", "..oBBooo", "...oo...", "........", "........",
})
actor("sentry", {
  "........", "....oooo", "...onnnn", "..onnnnn", ".onnwwww", ".onwwwoo", ".onwwwoo", ".onnwwww",
  ".onnnnnn", "..oNNNNN", "..oNnnnn", "..oNNNNN", "..oNNooo", "..ooo...", "........", "........",
})
actor("patrol", {
  "........", "........", "...ooooo", "..oyyyyy", ".oyyyyyy", ".oyooooo", ".oyorrrr", ".oyooooo",
  ".oyyyyyy", ".oYYYYYY", ".oYyyyyy", ".oYYYYYY", "..ogggoo", "..ooooo.", "........", "........",
})
actor("stalker", {
  "........", "..o.....", "..ro....", "..rroooo", "..orrrrr", ".orrrrrr", ".orwwoor", ".orrrrrr",
  ".orwrwrw", "..orRRRR", "..orrrrr", "..oRRRRR", "..orooRo", "..oo..oo", "........", "........",
})
actor("crawler", {  -- a beetle: wide low body, many legs
  "........", "........", "........", "........", "....oooo", "..ooAAAA", ".oAAAaaa", ".oAaaaaa",
  ".oAAAAAa", "ooAoAoAo", "o.o.o.o.", "........", "........", "........", "........", "........",
})
actor("blinker", {  -- a ghost: hooded, hollow eyes, ragged hem
  "........", "....oooo", "...ovvvv", "..ovvvvv", "..ovwwvv", ".ovvwowv", ".ovvwowv", ".ovvvvvv",
  ".ovvvvvv", ".ovvVVVV", ".ovvvvvv", ".ovVvVvV", ".ovo.oVo", "..o....o", "........", "........",
})
actor("lesson", {  -- a signpost
  "........", "........", "..oooooo", "..oaaaaa", "..oaAAAA", "..oaAooo", "..oaAoAA", "..oaaaaa",
  "..oooooo", ".....oNN", ".....oNN", ".....oNN", ".....oNN", "....ooNN", "........", "........",
})

actor("sniper", {  -- a round head with a crosshair eye
  "........", "...ooooo", "..obbbbb", ".obbbbbb", ".obwwwww", ".obwoooo", ".obwooor", ".obwoooo",
  ".obwwwww", ".obbbbbb", "..oBBBBB", "..oBbbbb", "..oBBooo", "..ooo...", "........", "........",
})
actor("hopper", {  -- a frog: eyes on top, wide mouth
  "........", "........", "..oooo..", ".owwwwo.", ".owowwo.", ".oAAAAAA", ".oAaaaaa", ".oAaaaaa",
  ".oAAAAAA", ".oAooooo", ".oAaaaaa", ".oAAAAAA", "oaaoAAAA", "ooo.oo..", "........", "........",
})

-- the Seeker: a one-eyed horned head, 32x32
make("seeker", 32, 32, 2, function(img, f)
  local half = {
    "................", "......oo........", ".....obbo.......", ".....obbbooooooo", "......obbbbbbbbb",
    ".....obbbbbbbbbb", "....obbbbbbbbbbb", "...obbbbwwwwwwww", "...obbbwwwwwwwww", "...obbwwwwwwwwww",
    "...obbwwwvvvvvvv", "...obbwwvvoooooo", "...obbwwvvoooooo", "...obbwwwvvvvvvv", "...obbwwwwwwwwww",
    "...obbbbbbbbbbbb", "....obbBBBBBBBBB", "....obboooooooo", "....oBBbbbbbbbbb", ".....oBBBBBBBBBB",
    ".....ooBBBBBBBBB", "......ooBBBBBBBB", ".......oooooooBB",
  }
  mirrored(img, half, 0, f == 2 and 1 or 0)
end)

-- the Warden: 32x32, two frames (crown flicker)
make("warden", 32, 32, 2, function(img, f)
  local half = {
    "................",
    "..........o.....",
    "....o....opo..o.",
    "....op..oppo.opo",
    "....oppooppppppo",
    "....opppppppppyo",
    "....ooppppppppoo",
    "......oPPPPPPPPP",
    "....ooPPppppppPP",
    "...oPPpppwwwpppp",
    "...oPPppwwoowppp",
    "...oPPppwwoowppp",
    "...oPPpppwwwpppp",
    "...oPPPppppppppp",
    "...oPPPoooooooop",
    "....oPPowoWwoWwo",
    "....oPPPooooooPP",
    "...ooPPPPPPPPPPP",
    "..oGGoPPPPPPPPPP",
    "..oGsGoPPppppppp",
    "..oGsGoPPppppppp",
    "..oGGGoPPPPPPPPP",
    "...ooooPPPPPPPPP",
    ".....oPPPPPPPPPP",
    ".....oPPoooooooo",
    "....oPPPo.......",
    "....ooooo.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  }
  -- clean the quick-draft glyphs: W is a stray; treat as white
  P["W"] = "#e8eef6"
  mirrored(img, half, 0, f == 2 and 1 or 0)
  -- crown gems flicker
  put(img, 15, 2 + (f == 2 and 1 or 0), f == 1 and "y" or "w")
  put(img, 16, 2 + (f == 2 and 1 or 0), f == 1 and "y" or "w")
end)

-- Tiles 16x16, one frame each, seeded so the art is stable between builds.
local seed = 7
local function rnd(n) seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n end

local function tile(name, painter)
  make(name, 16, 16, 1, function(img) painter(img) end)
end

tile("floor0", function(img) rect(img, 0, 0, 16, 16, "f"); for i = 1, 4 do put(img, rnd(16), rnd(16), "F") end end)
tile("floor1", function(img)
  rect(img, 0, 0, 16, 16, "f")
  for x = 2, 12 do put(img, x, 8, "F") end  -- a circuit trace
  put(img, 12, 7, "F"); put(img, 12, 6, "F"); put(img, 13, 6, "d"); put(img, 2, 9, "d")
end)
tile("floor2", function(img)
  rect(img, 0, 0, 16, 16, "f")
  rect(img, 5, 5, 6, 6, "F"); rect(img, 6, 6, 4, 4, "f"); put(img, 8, 8, "d")
  put(img, 3, 3, "d"); put(img, 12, 12, "d")
end)
tile("wall", function(img)
  rect(img, 0, 0, 16, 16, "G")
  for row = 0, 3 do
    local y = row * 4
    rect(img, 0, y, 16, 1, "s")           -- top highlight of each course
    rect(img, 0, y + 3, 16, 1, "d")       -- mortar
    local off = (row % 2) * 4
    for x = off, 15, 8 do rect(img, x, y, 1, 4, "d") end
  end
  rect(img, 0, 15, 16, 1, "o")
end)
tile("doorClosed", function(img)
  rect(img, 0, 0, 16, 16, "R"); rect(img, 0, 0, 16, 1, "o"); rect(img, 0, 15, 16, 1, "o")
  for x = 2, 13, 4 do rect(img, x, 1, 2, 14, "r") end
  rect(img, 0, 6, 16, 2, "o"); put(img, 7, 7, "y"); put(img, 8, 7, "y")
end)
tile("doorOpen", function(img)
  rect(img, 0, 0, 16, 16, "f"); rect(img, 0, 0, 2, 16, "R"); rect(img, 14, 0, 2, 16, "R")
  rect(img, 2, 0, 12, 1, "d"); for x = 3, 12, 3 do put(img, x, 8, "p") end
end)
