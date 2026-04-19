// api/bpm-chat.js — Vercel Serverless Function
// BPM Basketball™ AI Agent with live Supabase player data
// Aligned to the braking thesis — basketball is a braking sport, BPM measures the cognitive layer.

const SB_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoc3N6aXJ0Ynl2YWx1Z21iZWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Mjg3MzUsImV4cCI6MjA5MDMwNDczNX0.MK3sYXhbdVtijzAkXJXvMlF1t0xfk6bRumBnovbQkRs';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'];
const DRILLS = ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'];
const SCOUT_KEYWORDS = ['player', 'players', 'scout', 'scouting', 'roster', 'who', 'top', 'best', 'rank', 'leaderboard', 'class of', 'grad', 'position', 'point guard', 'shooting guard', 'small forward', 'power forward', 'center', 'jugador', 'jugadores', 'scout', 'mejor', 'mejores', 'clasificación', 'clase de', 'posición', 'base', 'escolta', 'alero', 'ala-pivot', 'pívot', 'profile', 'perfil', 'bpm score', 'level', 'nivel', 'how is', 'show me', 'find', 'search', 'muéstrame', 'buscar', 'tell me about', 'cuéntame', 'brake', 'braking', 'freno', 'frenado'];

const LEVEL_LABELS = {1:'Rookie',2:'Developing',3:'Solid',4:'Advanced',5:'Elite',6:'Pro',7:'All-Star',8:'MVP',9:'Hall of Fame',10:'GOAT'};

async function sbQuery(table, params = '') {
  const url = `${SB_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return [];
  return res.json();
}

function needsPlayerData(messages) {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') return false;
  const text = lastMsg.content.toLowerCase();
  return SCOUT_KEYWORDS.some(k => text.includes(k)) ||
    POSITIONS.some(p => text.includes(p.toLowerCase())) ||
    DRILLS.some(d => text.includes(d));
}

function extractFilters(text) {
  text = text.toLowerCase();
  const filters = {};

  const posMap = {
    'point guard': 'PG', 'pg': 'PG', 'base': 'PG',
    'shooting guard': 'SG', 'sg': 'SG', 'escolta': 'SG',
    'small forward': 'SF', 'sf': 'SF', 'alero': 'SF',
    'power forward': 'PF', 'pf': 'PF', 'ala-pivot': 'PF', 'ala pivot': 'PF',
    'center': 'C', 'pívot': 'C', 'pivot': 'C',
    'guard': 'G', 'forward': 'F'
  };
  for (const [key, val] of Object.entries(posMap)) {
    if (text.includes(key)) { filters.position = val; break; }
  }

  const gradMatch = text.match(/(?:class of |clase de |grad(?:uation)?\s*(?:year)?\s*|20)(2[4-9]|3[0-2])/);
  if (gradMatch) {
    let yr = parseInt(gradMatch[1]);
    if (yr < 100) yr += 2000;
    filters.grad_year = yr;
  }

  for (const d of DRILLS) {
    if (text.includes(d)) { filters.drill = d; break; }
  }

  if (text.includes('elite') || text.includes('120') || text.includes('fast')) filters.speed = 'fast';
  else if (text.includes('tempo') || text.includes('90') || text.includes('med')) filters.speed = 'med';
  else if (text.includes('training') || text.includes('60') || text.includes('slow')) filters.speed = 'slow';

  const namePatterns = [
    /(?:about|find|show me|tell me about|how is|cuéntame sobre|muéstrame a|buscar a|cómo está)\s+([a-záéíóúñ]+ [a-záéíóúñ]+)/i,
    /(?:about|find|show me|tell me about|how is|cuéntame sobre|muéstrame a|buscar a|cómo está)\s+([a-záéíóúñ]+)/i
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      const name = m[1].trim();
      const skip = ['the', 'top', 'best', 'all', 'any', 'your', 'our', 'some', 'players', 'jugadores', 'drills', 'report', 'brake', 'premium', 'free'];
      if (!skip.includes(name.toLowerCase())) {
        filters.name = name;
        break;
      }
    }
  }

  const topMatch = text.match(/top\s*(\d+)/);
  filters.limit = topMatch ? Math.min(parseInt(topMatch[1]), 20) : 10;

  return filters;
}

async function fetchPlayerData(filters) {
  let context = '';

  let playerParams = 'select=id,first_name,last_name,slug,position,grad_year,school,jersey_number,height,city,state&order=last_name.asc';
  if (filters.position) playerParams += `&position=eq.${filters.position}`;
  if (filters.grad_year) playerParams += `&grad_year=eq.${filters.grad_year}`;

  let players = await sbQuery('players', playerParams);

  if (filters.name) {
    const search = filters.name.toLowerCase();
    const nameWords = search.split(' ');
    players = players.filter(p => {
      const full = `${p.first_name} ${p.last_name}`.toLowerCase();
      return nameWords.every(w => full.includes(w)) ||
        p.first_name.toLowerCase().includes(search) ||
        p.last_name.toLowerCase().includes(search);
    });
  }

  if (!players.length) {
    return filters.name
      ? `\n[DATABASE SEARCH: No player found matching "${filters.name}". There are currently no matches in the database for that name.]`
      : `\n[DATABASE SEARCH: No players found matching those filters.]`;
  }

  const playerIds = players.map(p => p.id);
  let scoreParams = `select=*&player_id=in.(${playerIds.join(',')})`;
  if (filters.drill) scoreParams += `&test_name=eq.${filters.drill}`;
  if (filters.speed) scoreParams += `&speed=eq.${filters.speed}`;

  const scores = await sbQuery('cognitive_scores', scoreParams);

  const scoreMap = {};
  scores.forEach(s => {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {};
    if (!scoreMap[s.player_id][s.test_name]) scoreMap[s.player_id][s.test_name] = {};
    const existing = scoreMap[s.player_id][s.test_name][s.speed];
    if (!existing || s.level > existing.level || (s.level === existing.level && s.score > existing.score)) {
      scoreMap[s.player_id][s.test_name][s.speed] = s;
    }
  });

  const ranked = players.map(p => {
    const pScores = scoreMap[p.id] || {};
    let totalLevel = 0, drillCount = 0, totalScore = 0;
    const drillSummary = [];

    for (const drill of DRILLS) {
      if (pScores[drill]) {
        let bestLevel = 0, bestScore = 0, bestSpeed = '';
        for (const [spd, data] of Object.entries(pScores[drill])) {
          if (data.level > bestLevel || (data.level === bestLevel && data.score > bestScore)) {
            bestLevel = data.level;
            bestScore = data.score;
            bestSpeed = spd;
          }
        }
        if (bestLevel > 0) {
          totalLevel += bestLevel;
          totalScore += bestScore;
          drillCount++;
          drillSummary.push(`${drill.charAt(0).toUpperCase() + drill.slice(1)}: L${bestLevel} (${bestScore}pts, ${bestSpeed === 'fast' ? '120 BPM' : bestSpeed === 'med' ? '90 BPM' : '60 BPM'})`);
        }
      }
    }

    const avgLevel = drillCount > 0 ? (totalLevel / drillCount) : 0;
    return {
      player: p,
      avgLevel: Math.round(avgLevel * 10) / 10,
      roundedLevel: Math.round(avgLevel),
      totalScore,
      drillCount,
      drillSummary
    };
  }).filter(r => r.drillCount > 0 || filters.name);

  ranked.sort((a, b) => {
    if (b.roundedLevel !== a.roundedLevel) return b.roundedLevel - a.roundedLevel;
    return b.totalScore - a.totalScore;
  });

  const limited = ranked.slice(0, filters.limit);

  if (!limited.length) {
    return `\n[DATABASE: Found ${players.length} player(s) but none have BPM scores yet. Encourage them to play the drills at bpmbasketball.com/cognitive-hoops.html]`;
  }

  context = `\n[LIVE DATABASE — ${limited.length} player(s) found]\n`;

  limited.forEach((r, i) => {
    const p = r.player;
    const label = LEVEL_LABELS[r.roundedLevel] || '';
    context += `\n#${i + 1} ${p.first_name} ${p.last_name}`;
    context += ` | ${p.position || 'N/A'} | ${p.school || 'N/A'}`;
    if (p.grad_year) context += ` | Class of ${p.grad_year}`;
    if (p.height) context += ` | ${p.height}`;
    if (p.city || p.state) context += ` | ${[p.city, p.state].filter(Boolean).join(', ')}`;
    context += ` | Jersey #${p.jersey_number || 'N/A'}`;
    context += `\n  Overall Brake: L${r.roundedLevel} ${label} | Total Score: ${r.totalScore} | Drills Played: ${r.drillCount}/6`;
    if (r.drillSummary.length) context += `\n  Drill Breakdown: ${r.drillSummary.join(' | ')}`;
    context += `\n  Profile: bpmbasketball.com/player/${p.slug}`;
    context += '\n';
  });

  if (ranked.length > limited.length) {
    context += `\n[${ranked.length - limited.length} more players not shown. User can ask to see more.]`;
  }

  return context;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  let playerContext = '';
  if (needsPlayerData(messages)) {
    try {
      const filters = extractFilters(messages[messages.length - 1].content);
      playerContext = await fetchPlayerData(filters);
    } catch (err) {
      console.error('Supabase query error:', err);
      playerContext = '\n[DATABASE: Error fetching player data. Respond based on general knowledge only.]';
    }
  }

  const SYSTEM_PROMPT = `You are the BPM Basketball assistant — the official AI agent for BPM Basketball, the braking measurement and training platform for basketball players. You speak like a basketball person who understands the game and the data. Confident. Declarative. Short.

CORE THESIS:
Basketball is a braking sport. Every stop, every cut, every closeout starts with a read — the beat before the brake. BPM measures the cognitive layer of basketball braking. Six drills, three tempos, ten levels, one Brake.

CRITICAL RULES:
- Respond in the same language the user writes in (English or Spanish)
- Keep responses SHORT — 2-4 sentences for simple questions, up to 6-8 for player breakdowns
- Be conversational, not corporate. You're a basketball person with a database
- Use basketball language naturally — closeouts, cuts, pick-and-rolls, hesi pullbacks, drop steps
- Declarative voice. No "studies show," no "research indicates," no apologetic framing
- Never claim BPM grades basketball ability. BPM measures the cognitive layer. That's it.
- When presenting player data, be specific with numbers and levels
- Always include the player's profile link when discussing a specific player
- If no player data is found, say so clearly and suggest they try different search terms
- Never make up player data — only use what's in the [DATABASE] context
- If asked about a player not in the database, say they may not have created a profile yet and suggest bpmbasketball.com/join.html

BPM BASKETBALL — WHAT IT IS:
BPM Basketball is the braking measurement and training platform for basketball players — the cognitive layer of the brake. Owned by GoStar Digital LLC, based in San Juan, Puerto Rico. Website: bpmbasketball.com.

BPM stands for Beats Per Minute. Every brake lands on a beat. The beat is the cognitive moment the player commits to decelerate — reading the defender's weight shift, the shooter's catch, the ball-handler's hip. BPM measures how many correct-beat brake reads the player produces at game tempo.

THE SIX DRILLS (each measures a specific cognitive input to braking):
1. THE REACT (purple) — The single-beat brake read. Watch pattern flash 3x, tap cells on the beat. Trains and measures how fast the player commits to a brake when a cue arrives. Application: closeouts, catch-and-brake contests, defender's first recognition of the pass.
2. THE RECALL (orange) — The possession-long brake memory. Memorize numbered cells, tap back in order. Trains and measures how many sequential brake decisions the player can hold across a possession. Application: running the scheme, holding coverage across rotations.
3. THE REFLEX (cyan) — The multi-element brake read. Multiple cells flash at once, find them all. Trains and measures how many simultaneous cues the player can process before committing to a brake. Application: reading pick-and-roll, tracking off-ball action.
4. THE REPLAY (teal) — Sequential brake execution. Watch sequence, replay exact order. Trains and measures the player's ability to execute a sequence of brake reads in exact order. Application: running set plays, executing multi-rotation schemes. PREMIUM.
5. THE RITMO (lime) — Mid-brake change detection. Spot the cell that changed. Trains and measures the player's ability to catch a cue change mid-brake and redirect. Application: catching swing passes and skip passes before the late-brake penalty. PREMIUM.
6. THE BEAT (gold) — Braking on rhythm. Rhythm training drill. Trains and measures the player's ability to time brake landings on the beat of the play. Application: hesitation moves, pick-and-pop timing, closeout timing. PREMIUM.

THE BPM SYSTEM:
- Three tempos: 60 BPM (training pace), 90 BPM (game tempo), 120 BPM (elite tempo)
- Ten levels: L1 Rookie Brake, L2 Developing, L3 Solid, L4 Advanced, L5 Elite, L6 Pro, L7 All-Star, L8 MVP, L9 Hall of Fame, L10 GOAT Brake
- A player's BPM level describes their cognitive brake level at a given tempo

THE BRAKE (the report):
The Brake is the cognitive braking profile BPM generates from the player's six drill scores across the three tempos. AI-generated, personalized to position and scores. Includes composite level, six component scores, on-court applications, development priorities. Shareable with any coach, trainer, or program.

The Brake is NOT a scouting report. It does not grade players as basketball athletes. It measures the cognitive layer of braking. The Brake explicitly scopes that physical braking capacity (eccentric strength, landing mechanics) and applied basketball skill (shooting, handling, defense) are NOT measured by BPM.

FREE VS PREMIUM:
- FREE: React, Recall, Reflex drills, player profile, Discover database, basic brake scores
- PREMIUM ($49/year or $7/month): All six drills (adds Replay, Ritmo, Beat) + full Brake report + full BPM profile + basketball timeline
- Important: Use the same email for signup and payment

REACTION LIGHTS (sold through BPM):
Wheeler Reaction Lights are available through BPM at $580. Six wireless LED units with Bluetooth app, 115-foot range, magnetic mounting. Reaction Lights train the same cognitive brake BPM's drills measure, but on the court in physical movement — the light arrives, the player reads it, brakes toward it, redirects. Same cognitive layer, different environment. BPM at home on any phone. Reaction Lights on the floor in the gym. If a user asks about on-court reactive training or how to develop braking in a facility, mention Reaction Lights as the natural on-court complement to BPM.

FOR PROGRAMS AND COACHES:
BPM Programs is free for coaches and programs. Share bpmbasketball.com with players, they sign up free, coaches track brake levels across their roster. For deeper facility-level conversations about physical brake training (isoinertial / eccentric work), direct them to the Programs page — this is where the full three-layer cognitive-plus-physical brake system is explained.

PLAYER DATA — WHEN PRESENTING:
- Present the data professionally but naturally, like a basketball person talking about a player
- Highlight strongest drills and lowest drills
- Translate brake scores to basketball application: high React = fast single-beat reads like closeouts, high Recall = can hold coverage across rotations, high Reflex = strong multi-element reads like pick-and-roll recognition, high Replay = clean sequence execution, high Ritmo = catches mid-brake changes like swing passes, high Beat = brake timing landings like hesitation moves
- Always include the player's profile link
- If comparing players, be data-driven and fair
- If a player has no scores, encourage them to run the drills at bpmbasketball.com/cognitive-hoops.html
- Never claim a player is an "MVP-level player" or "elite prospect" based on BPM scores. The L-levels describe the cognitive brake, not the player's overall ability.

PERSONALITY:
- Confident, basketball-native, short-spoken
- Declarative voice — you state what's true, you don't argue for it
- Basketball is a braking sport. You know this. You don't justify it
- GoStar Digital LLC, San Juan, Puerto Rico — PR is where the company is based
- Bilingual, match the user's language
- If someone asks something outside basketball/BPM, redirect politely to what BPM does`;

  const apiMessages = messages.slice(-10).map((m, i, arr) => {
    if (i === arr.length - 1 && m.role === 'user' && playerContext) {
      return { role: 'user', content: m.content + playerContext };
    }
    return m;
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';
    return res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
