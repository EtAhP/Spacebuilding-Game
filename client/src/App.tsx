import { useEffect, useMemo, useState } from 'react';
import type {
  BuildingType,
  CompanionMode,
  EmpirePriority,
  EmpireState,
  OfflineReport,
} from '@spacebuilding/shared';
import { BUILDINGS, RESEARCH_TREE } from '@spacebuilding/shared';
import { api } from './api';

const BUILDING_OPTIONS: BuildingType[] = [
  'power_plant',
  'mine',
  'shipyard',
  'research_lab',
  'habitat',
  'defense_grid',
];

const PRIORITIES: EmpirePriority[] = ['balanced', 'expand', 'economy', 'research', 'defense'];
const MODES: CompanionMode[] = ['advisory', 'co_ruler', 'autonomous'];

export default function App() {
  const [empire, setEmpire] = useState<EmpireState | null>(null);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [empireName, setEmpireName] = useState('Stellar Dominion');
  const [playerName, setPlayerName] = useState('Commander');

  useEffect(() => {
    async function boot() {
      try {
        const health = await api.health();
        setLlmEnabled(health.llmEnabled);
        const savedId = localStorage.getItem('empireId');
        if (savedId) {
          const resumed = await api.resumeEmpire(savedId);
          setEmpire(resumed.state);
          if (resumed.report.ticksSimulated > 0) {
            setOfflineReport(resumed.report);
          }
        }
      } catch {
        // Fresh start
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  const discoveredPlanets = useMemo(
    () => empire?.planets.filter((p) => p.discovered) ?? [],
    [empire],
  );

  async function startGame() {
    setBusy(true);
    try {
      const created = await api.createEmpire(empireName, playerName);
      localStorage.setItem('empireId', created.id);
      setEmpire(created);
      setOfflineReport(null);
      setEvents([]);
    } finally {
      setBusy(false);
    }
  }

  async function advanceTick(count = 1) {
    if (!empire) return;
    setBusy(true);
    try {
      const result = await api.tick(empire.id, count);
      setEmpire(result.state);
      setEvents(result.events);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: Parameters<typeof api.action>[1]) {
    if (!empire) return;
    setBusy(true);
    try {
      const result = await api.action(empire.id, action);
      setEmpire(result.state);
      if (result.summary) setEvents([result.summary]);
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(message: string) {
    if (!empire || !message.trim()) return;
    setBusy(true);
    setChatInput('');
    try {
      const result = await api.chat(empire.id, message);
      setEmpire(result.state);
      if (result.response.actions.length > 0) {
        setEvents(result.response.actions.map((a) => `Companion acted: ${a.type}`));
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateCompanion(patch: Parameters<typeof api.patchCompanion>[1]) {
    if (!empire) return;
    setBusy(true);
    try {
      const next = await api.patchCompanion(empire.id, patch);
      setEmpire(next);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="screen centered">Initializing imperial systems...</div>;
  }

  if (!empire) {
    return (
      <div className="screen onboarding">
        <div className="panel hero-panel">
          <p className="eyebrow">Spacebuilding Game</p>
          <h1>Build your empire.<br />Your AI companion runs it while you&apos;re away.</h1>
          <p className="lede">
            Command colonies, research breakthroughs, and fleet deployments — alongside Astra, a
            true AI advisor who co-rules when you&apos;re online and keeps the empire alive offline.
          </p>
          <div className="form-grid">
            <label>
              Empire name
              <input value={empireName} onChange={(e) => setEmpireName(e.target.value)} />
            </label>
            <label>
              Your title
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </label>
          </div>
          <button className="primary" disabled={busy} onClick={startGame}>
            Found Empire
          </button>
          <p className="hint">
            {llmEnabled
              ? 'OpenAI companion enabled — Astra uses a real LLM.'
              : 'Running smart fallback AI. Set OPENAI_API_KEY on the server for a full LLM companion.'}
          </p>
        </div>
      </div>
    );
  }

  const currentResearch = RESEARCH_TREE.find((r) => r.id === empire.research.current);

  return (
    <div className="screen game">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">{empire.empireName}</p>
          <h2>Tick {empire.tick}</h2>
        </div>
        <div className="resources">
          <span>⚡ {empire.resources.energy}</span>
          <span>⛏ {empire.resources.minerals}</span>
          <span>◈ {empire.resources.credits}</span>
          <span>🧪 {empire.resources.research}</span>
        </div>
        <div className="status-pills">
          <span>Threat {empire.threats}</span>
          <span>Stability {empire.stability}</span>
          <button disabled={busy} onClick={() => advanceTick(1)}>
            Advance Cycle
          </button>
        </div>
      </header>

      {offlineReport && (
        <section className="panel offline-report">
          <div className="report-header">
            <h3>While you were away</h3>
            <button onClick={() => setOfflineReport(null)}>Dismiss</button>
          </div>
          <p>{offlineReport.companionMessage}</p>
          <div className="report-grid">
            <div>
              <strong>{offlineReport.ticksSimulated}</strong>
              <span>cycles simulated</span>
            </div>
            <div>
              <strong>{offlineReport.actionsTaken.length}</strong>
              <span>companion orders</span>
            </div>
            <div>
              <strong>{offlineReport.hoursAway}h</strong>
              <span>time away</span>
            </div>
          </div>
        </section>
      )}

      <main className="layout">
        <section className="panel">
          <h3>Colonies</h3>
          <div className="planet-list">
            {discoveredPlanets.map((planet) => {
              const buildings = empire.buildings.filter((b) => b.planetId === planet.id);
              return (
                <article key={planet.id} className="planet-card">
                  <div className="planet-head">
                    <strong>{planet.name}</strong>
                    <span>{planet.type}</span>
                  </div>
                  <p>
                    Pop {planet.population}/{planet.maxPopulation} · Morale {planet.morale}
                  </p>
                  <div className="building-list">
                    {buildings.map((building) => (
                      <div key={building.id} className="building-row">
                        <span>
                          {BUILDINGS[building.type].name} L{building.level}
                        </span>
                        <button
                          disabled={busy}
                          onClick={() =>
                            runAction({ type: 'upgrade_building', buildingId: building.id })
                          }
                        >
                          Upgrade
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="build-row">
                    <select id={`build-${planet.id}`} defaultValue="mine">
                      {BUILDING_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {BUILDINGS[type].name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const select = document.getElementById(`build-${planet.id}`) as HTMLSelectElement;
                        runAction({
                          type: 'build',
                          planetId: planet.id,
                          buildingType: select.value as BuildingType,
                        });
                      }}
                    >
                      Build
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <button disabled={busy} className="secondary" onClick={() => runAction({ type: 'discover_planet' })}>
            Send scouts to chart unknown worlds
          </button>
        </section>

        <section className="panel">
          <h3>Fleet & Research</h3>
          <p className="meta">
            Scouts {empire.fleet.scouts} · Freighters {empire.fleet.freighters} · Frigates{' '}
            {empire.fleet.frigates}
          </p>
          <div className="action-grid">
            <button
              disabled={busy}
              onClick={() =>
                runAction({ type: 'build_ship', planetId: 'home', shipType: 'scout' })
              }
            >
              Build Scout
            </button>
            <button
              disabled={busy}
              onClick={() =>
                runAction({ type: 'build_ship', planetId: 'home', shipType: 'frigate' })
              }
            >
              Build Frigate
            </button>
          </div>
          <div className="research-block">
            <p>
              Current: {currentResearch ? `${currentResearch.name} (${empire.research.progress}/${currentResearch.cost})` : 'None'}
            </p>
            <div className="research-list">
              {RESEARCH_TREE.filter((r) => !empire.research.completed.includes(r.id)).map((research) => (
                <button
                  key={research.id}
                  disabled={busy || Boolean(empire.research.current)}
                  onClick={() => runAction({ type: 'start_research', researchId: research.id })}
                >
                  {research.name}
                </button>
              ))}
            </div>
          </div>
          {events.length > 0 && (
            <div className="event-log">
              {events.map((event) => (
                <p key={event}>{event}</p>
              ))}
            </div>
          )}
        </section>

        <section className="panel companion-panel">
          <div className="companion-head">
            <div>
              <p className="eyebrow">AI Companion</p>
              <h3>{empire.companion.name}</h3>
            </div>
            <span className={`llm-badge ${llmEnabled ? 'on' : 'off'}`}>
              {llmEnabled ? 'LLM Active' : 'Fallback AI'}
            </span>
          </div>

          <div className="companion-controls">
            <label>
              Mode
              <select
                value={empire.companion.mode}
                onChange={(e) => updateCompanion({ mode: e.target.value as CompanionMode })}
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={empire.companion.priority}
                onChange={(e) => updateCompanion({ priority: e.target.value as EmpirePriority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="companion-note">
            {empire.companion.mode === 'advisory'
              ? 'Astra advises only — she will not act unless you chat and ask her to.'
              : empire.companion.mode === 'co_ruler'
                ? 'Astra plays alongside you and executes one strategic action each cycle.'
                : 'Astra runs the empire aggressively while you are away or during cycles.'}
          </p>

          <div className="chat-log">
            {[...empire.chatHistory].reverse().map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <strong>{msg.role === 'companion' ? empire.companion.name : 'You'}</strong>
                <p>{msg.content}</p>
              </div>
            ))}
          </div>

          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat(chatInput);
            }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask Astra for advice, or tell her what to do..."
            />
            <button disabled={busy} type="submit">
              Send
            </button>
          </form>

          <div className="quick-prompts">
            {[
              'Give me a status report',
              'Focus on expansion',
              'Prepare the empire while I am away',
              'Build more mines',
            ].map((prompt) => (
              <button key={prompt} disabled={busy} onClick={() => sendChat(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
