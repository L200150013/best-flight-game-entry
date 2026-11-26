// main.ts — the entry program for POS LANGIT (best-flight-game-20261126-0057).
// Node 22, standard library only. Copies game/ and screenshots/ from this
// repository into the output directory (MAKEFUN_OUTPUT_DIR outside the
// grader, /output inside it) and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. Deterministic: the same
// repository always writes the same bytes.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The caps below are the bounty's gate values from RULES.txt: the dossier
// text holds at most 160 KiB, at most 4 screenshots of at most 256 KiB,
// game/ at most 993 entries and 48 MiB, every game path at most 1,000 bytes.
// Passing them here makes this program fail exactly where the scorer would.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
