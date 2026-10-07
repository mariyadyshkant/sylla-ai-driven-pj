const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const MODEL_SIZES = ['tiny', 'base', 'small', 'medium'];
const SEARCH_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
const WHISPER_NAMES = ['whisper-cli', 'whisper-cpp', 'main'];

// Cerca un eseguibile: override da env/impostazioni, poi PATH, poi cartelle comuni (brew).
function findBinary(names, override) {
  if (override && fs.existsSync(override)) return override;
  const dirs = [...(process.env.PATH || '').split(path.delimiter), ...SEARCH_DIRS];
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

function resolveBinaries(settings = {}) {
  return {
    ffmpeg: findBinary(['ffmpeg'], process.env.SYLLA_FFMPEG_PATH || settings.ffmpeg_path),
    whisper: findBinary(WHISPER_NAMES, process.env.SYLLA_WHISPER_PATH || settings.whisper_path),
  };
}

function modelsDir(userDataDir) {
  return path.join(userDataDir, 'models');
}

function modelPath(userDataDir, size) {
  return path.join(modelsDir(userDataDir), `ggml-${size}.bin`);
}

async function ensureModel(userDataDir, size, onProgress) {
  if (!MODEL_SIZES.includes(size)) throw new Error(`Modello whisper non valido: ${size}`);
  const file = modelPath(userDataDir, size);
  if (fs.existsSync(file)) return file;

  fs.mkdirSync(modelsDir(userDataDir), { recursive: true });
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${size}.bin`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download del modello fallito (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;
  const tmp = `${file}.part`;
  const out = fs.createWriteStream(tmp);
  let received = 0;
  try {
    for await (const chunk of res.body) {
      out.write(chunk);
      received += chunk.length;
      if (total) onProgress(Math.round((received / total) * 100));
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  fs.renameSync(tmp, file);
  return file;
}

function run(cmd, args, onStderr) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = '';
    child.stderr.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      if (onStderr) onStderr(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} terminato con codice ${code}: ${stderr.slice(-300)}`));
    });
  });
}

// Estrae l'audio (wav 16 kHz mono, richiesto da whisper.cpp) e trascrive.
// onProgress({ stage, percent }) con stage in: model | audio | transcribing
async function transcribeFile({ inputPath, settings, userDataDir, onProgress }) {
  const { ffmpeg, whisper } = resolveBinaries(settings);
  if (!ffmpeg) throw new Error('ffmpeg non trovato. Installalo (es. "brew install ffmpeg") o indica il percorso nelle Impostazioni.');
  if (!whisper) throw new Error('whisper.cpp non trovato. Installalo (es. "brew install whisper-cpp") o indica il percorso nelle Impostazioni.');

  const size = settings.whisper_model || 'base';
  const language = settings.transcription_language || 'it';

  onProgress({ stage: 'model', percent: 0 });
  const model = await ensureModel(userDataDir, size, (percent) => onProgress({ stage: 'model', percent }));

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-transcribe-'));
  const wav = path.join(workDir, 'audio.wav');
  const outBase = path.join(workDir, 'transcript');
  try {
    onProgress({ stage: 'audio', percent: 0 });
    await run(ffmpeg, ['-y', '-i', inputPath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);

    onProgress({ stage: 'transcribing', percent: 0 });
    await run(
      whisper,
      ['-m', model, '-f', wav, '-l', language, '-nt', '-pp', '-otxt', '-of', outBase],
      (text) => {
        const m = [...text.matchAll(/progress\s*=\s*(\d+)%/g)].pop();
        if (m) onProgress({ stage: 'transcribing', percent: Number(m[1]) });
      }
    );
    return fs.readFileSync(`${outBase}.txt`, 'utf8').trim();
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

module.exports = { MODEL_SIZES, resolveBinaries, transcribeFile };
