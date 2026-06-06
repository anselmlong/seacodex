import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const deckPath = process.argv[2];

if (!deckPath) {
  console.error("Usage: node scripts/validate-pptx.mjs <deck.pptx>");
  process.exit(1);
}

if (!fs.existsSync(deckPath)) {
  console.error(`Missing deck: ${deckPath}`);
  process.exit(1);
}

const size = fs.statSync(deckPath).size;
if (size < 50_000) {
  console.error(`Deck is unexpectedly small: ${size} bytes`);
  process.exit(1);
}

const listing = execFileSync("unzip", ["-l", deckPath], { encoding: "utf8" });
const slideMatches = listing.match(/ppt\/slides\/slide\d+\.xml/g) ?? [];
const mediaMatches = listing.match(/ppt\/media\/image[\w-]*\.\w+/g) ?? [];
const uniqueSlides = new Set(slideMatches);

if (uniqueSlides.size < 8) {
  console.error(`Expected at least 8 slides; found ${uniqueSlides.size}`);
  process.exit(1);
}

if (mediaMatches.length < 1) {
  console.error("Expected at least one embedded image asset.");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      deck: path.resolve(deckPath),
      bytes: size,
      slides: uniqueSlides.size,
      mediaFiles: mediaMatches.length,
      status: "ok"
    },
    null,
    2
  )
);
