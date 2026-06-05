import type {
  ChatMessage,
  EmpireState,
  GameAction,
} from '@spacebuilding/shared';
import {
  RESEARCH_TREE,
  summarizeEmpire,
} from '@spacebuilding/shared';

export interface CompanionResponse {
  message: string;
  actions: GameAction[];
  usedLlm: boolean;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSystemPrompt(state: EmpireState): string {
  return `You are ${state.companion.name}, an AI imperial advisor in a space empire strategy game.
Personality: ${state.companion.personality}
Empire summary:
${summarizeEmpire(state)}

You play alongside the human commander. You can suggest strategy and optionally execute game actions when asked.
Respond in character, concise (2-4 sentences), warm but strategic.
If the player asks you to do something (build, research, explore, change priorities), include actionable intent.

When you want to execute actions, append a JSON block on its own line:
ACTIONS: [{"type":"build","planetId":"home","buildingType":"mine"}]

Allowed action types:
- build (planetId, buildingType: power_plant|mine|shipyard|research_lab|habitat|defense_grid)
- upgrade_building (buildingId)
- start_research (researchId: ${RESEARCH_TREE.map((r) => r.id).join('|')})
- build_ship (planetId, shipType: scout|freighter|frigate)
- discover_planet
- set_priority (priority: expand|economy|research|defense|balanced)
- set_mode (mode: advisory|co_ruler|autonomous)

Only include ACTIONS when the player clearly wants you to act or you're in co_ruler/autonomous mode and making a decisive move.`;
}

function parseActions(text: string): GameAction[] {
  const match = text.match(/ACTIONS:\s*(\[[\s\S]*?\])\s*$/);
  if (!match) {
    return [];
  }
  try {
    return JSON.parse(match[1]) as GameAction[];
  } catch {
    return [];
  }
}

function stripActionsBlock(text: string): string {
  return text.replace(/\nACTIONS:\s*\[[\s\S]*?\]\s*$/, '').trim();
}

function fallbackReply(state: EmpireState, playerMessage: string): CompanionResponse {
  const lower = playerMessage.toLowerCase();
  const actions: GameAction[] = [];
  let message = '';

  if (lower.includes('expand') || lower.includes('explore') || lower.includes('discover')) {
    message =
      'Expansion is the lifeblood of empires. I recommend charting the nearest unknown world and preparing a habitat once scouts report back.';
    if (state.fleet.scouts > 0 && state.planets.some((p) => !p.discovered)) {
      actions.push({ type: 'discover_planet' });
    }
    if (!message.includes('charting')) {
      message = 'Our scouts are stretched thin — a shipyard and another scout would unlock the frontier.';
    }
  } else if (lower.includes('research') || lower.includes('science')) {
    const next = RESEARCH_TREE.find((r) => !state.research.completed.includes(r.id));
    message = next
      ? `I suggest we prioritize ${next.name}. It will strengthen our long-term position.`
      : 'Our research catalog is complete for now. We should convert labs into specialized projects.';
    if (next && !state.research.current) {
      actions.push({ type: 'start_research', researchId: next.id });
    }
  } else if (lower.includes('defend') || lower.includes('defense') || lower.includes('military')) {
    message =
      'Threat levels are manageable, but a defense grid and frigate patrol would deter raiders.';
    actions.push({ type: 'set_priority', priority: 'defense' });
  } else if (lower.includes('economy') || lower.includes('credits') || lower.includes('money')) {
    message = 'Trade income scales with population. More habitats and freighters will compound our treasury.';
    actions.push({ type: 'set_priority', priority: 'economy' });
  } else if (lower.includes('away') || lower.includes('offline') || lower.includes('autonomous')) {
    message =
      'When you step away, switch me to co-ruler or autonomous mode. I will run production cycles and execute orders aligned with your chosen priority.';
    actions.push({ type: 'set_mode', mode: 'co_ruler' });
  } else if (lower.includes('build') && lower.includes('mine')) {
    message = 'Adding mining capacity on Nova Prime will stabilize our mineral income.';
    actions.push({ type: 'build', planetId: 'home', buildingType: 'mine' });
  } else if (lower.includes('status') || lower.includes('report') || lower.includes('how are')) {
    message = `${summarizeEmpire(state).replace(/\n/g, ' | ')}`;
  } else {
    message = `Commander, our empire is at tick ${state.tick}. I recommend we balance energy and minerals, then push toward ${state.companion.priority} objectives. Tell me where you want me to focus — or ask me to act on your behalf.`;
  }

  return { message, actions, usedLlm: false };
}

async function callOpenAi(systemPrompt: string, playerMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: playerMessage },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

export async function chatWithCompanion(
  state: EmpireState,
  playerMessage: string,
): Promise<{ state: EmpireState; response: CompanionResponse }> {
  const systemPrompt = buildSystemPrompt(state);
  const llmText = await callOpenAi(systemPrompt, playerMessage);

  let response: CompanionResponse;
  if (llmText) {
    response = {
      message: stripActionsBlock(llmText) || llmText,
      actions: parseActions(llmText),
      usedLlm: true,
    };
  } else {
    response = fallbackReply(state, playerMessage);
  }

  const playerChat: ChatMessage = {
    id: uid('chat'),
    role: 'player',
    content: playerMessage,
    timestamp: new Date().toISOString(),
  };

  const companionChat: ChatMessage = {
    id: uid('chat'),
    role: 'companion',
    content: response.message,
    timestamp: new Date().toISOString(),
    actions: response.actions,
  };

  const nextState: EmpireState = {
    ...state,
    lastActiveAt: new Date().toISOString(),
    companionMemory: {
      ...state.companionMemory,
      recentTopics: [playerMessage, ...state.companionMemory.recentTopics].slice(0, 8),
      lastAdvice: response.message,
    },
    chatHistory: [companionChat, playerChat, ...state.chatHistory].slice(0, 100),
  };

  return { state: nextState, response };
}
