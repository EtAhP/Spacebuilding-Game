import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAction,
  createNewEmpire,
  runCompanionTurn,
  simulateOfflineProgress,
  simulateTick,
} from '@spacebuilding/shared';
import type { CompanionConfig, EmpireState, GameAction } from '@spacebuilding/shared';
import { chatWithCompanion } from './companion.js';
import { deleteEmpire, listEmpires, loadEmpire, saveEmpire } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    llmEnabled: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.get('/api/empires', (_req, res) => {
  res.json(listEmpires());
});

app.post('/api/empires', (req, res) => {
  const empireName = String(req.body.empireName ?? 'Stellar Dominion').slice(0, 40);
  const playerName = String(req.body.playerName ?? 'Commander').slice(0, 30);
  const state = createNewEmpire(empireName, playerName);
  saveEmpire(state);
  res.status(201).json(state);
});

app.get('/api/empires/:id', (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }
  res.json(state);
});

app.delete('/api/empires/:id', (req, res) => {
  const ok = deleteEmpire(req.params.id);
  res.status(ok ? 204 : 404).end();
});

app.post('/api/empires/:id/resume', (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }

  const report = simulateOfflineProgress(state);
  const updated = report.updatedState ?? state;
  saveEmpire(updated);
  res.json({ state: updated, report });
});

app.post('/api/empires/:id/tick', (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }

  let current = state;
  const events: string[] = [];
  const count = Math.min(Number(req.body.count ?? 1), 10);

  for (let i = 0; i < count; i += 1) {
    const tickResult = simulateTick(current);
    current = tickResult.state;
    events.push(...tickResult.events);
    if (current.companion.mode !== 'advisory') {
      current = runCompanionTurn(current);
    }
  }

  current = { ...current, lastActiveAt: new Date().toISOString() };
  saveEmpire(current);
  res.json({ state: current, events });
});

app.post('/api/empires/:id/actions', (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }

  const action = req.body.action as GameAction;
  const result = applyAction(state, action, 'player');
  const next = { ...result.state, lastActiveAt: new Date().toISOString() };
  saveEmpire(next);
  res.json({ state: next, ok: result.ok, summary: result.summary });
});

app.patch('/api/empires/:id/companion', (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }

  const patch = req.body as Partial<CompanionConfig>;
  const next: EmpireState = {
    ...state,
    companion: { ...state.companion, ...patch },
    lastActiveAt: new Date().toISOString(),
  };
  saveEmpire(next);
  res.json(next);
});

app.post('/api/empires/:id/chat', async (req, res) => {
  const state = loadEmpire(req.params.id);
  if (!state) {
    res.status(404).json({ error: 'Empire not found' });
    return;
  }

  const message = String(req.body.message ?? '').slice(0, 1000);
  if (!message.trim()) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  try {
    const { state: chatted, response } = await chatWithCompanion(state, message);
    let current = chatted;

    for (const action of response.actions) {
      const result = applyAction(current, action, 'companion');
      if (result.ok) {
        current = result.state;
      }
    }

    current = { ...current, lastActiveAt: new Date().toISOString() };
    saveEmpire(current);
    res.json({ state: current, response });
  } catch (error) {
    res.status(500).json({ error: 'Companion failed to respond', details: String(error) });
  }
});

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Client not built yet. Run npm run dev in client workspace.' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Spacebuilding server running on http://localhost:${PORT}`);
  console.log(`LLM companion: ${process.env.OPENAI_API_KEY ? 'enabled' : 'rule-based fallback'}`);
});
