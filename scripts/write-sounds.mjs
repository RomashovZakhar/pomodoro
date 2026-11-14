import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "sounds");
mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;
const amplitude = 0.35;

function writeWav(name, frequency, durationMs) {
  const samples = Math.round((sampleRate * durationMs) / 1000);
  const pcm = Buffer.alloc(samples * 2);
  const fade = Math.round(sampleRate * 0.012);
  for (let i = 0; i < samples; i++) {
    const attack = Math.min(1, i / fade);
    const release = Math.min(1, (samples - 1 - i) / fade);
    const envelope = Math.min(attack, release);
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * envelope;
    const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    pcm.writeInt16LE(value, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(outDir, name), Buffer.concat([header, pcm]));
}

writeWav("focus-end.wav", 880, 180);
writeWav("break-end.wav", 660, 120);
