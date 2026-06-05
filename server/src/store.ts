import fs from 'node:fs';
import path from 'node:path';
import type { EmpireState } from '@spacebuilding/shared';

const DATA_DIR = path.resolve(process.cwd(), '../data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function saveEmpire(state: EmpireState): void {
  ensureDataDir();
  fs.writeFileSync(path.join(DATA_DIR, `${state.id}.json`), JSON.stringify(state, null, 2));
}

export function loadEmpire(id: string): EmpireState | null {
  ensureDataDir();
  const file = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as EmpireState;
}

export function listEmpires(): Array<{ id: string; empireName: string; tick: number }> {
  ensureDataDir();
  return fs
    .readdirSync(DATA_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const state = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')) as EmpireState;
      return { id: state.id, empireName: state.empireName, tick: state.tick };
    });
}

export function deleteEmpire(id: string): boolean {
  ensureDataDir();
  const file = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    return false;
  }
  fs.unlinkSync(file);
  return true;
}
