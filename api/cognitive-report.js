// api/cognitive-report.js — Vercel Serverless Function
// BPM Basketball™ AI Cognitive Scouting Report with Percentile Rankings

var SB_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoc3N6aXJ0Ynl2YWx1Z21iZWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Mjg3MzUsImV4cCI6MjA5MDMwNDczNX0.MK3sYXhbdVtijzAkXJXvMlF1t0xfk6bRumBnovbQkRs';

async function sbFetch(table, params) {
  var url = SB_URL + '/rest/v1/' + table + '?' + params;
  var resp = await fetch(url, {
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) return [];
  return resp.json();
}

async function calculatePercentiles(playerScores, position) {
  // Fetch all cognitive scores from database
  var allScores = await sbFetch('cognitive_scores', 'select=player_id,test_name,level,score');
  
  // Fetch all players to get positions for position-based percentiles
  var allPlayers = await sbFetch('players', 'select=id,position');
  
  // Build position map
  var positionMap = {};
  allPlayers.forEach(function(p) { positionMap[p.id] = p.position; });
  
  // Build best-level-per-drill for each player
  var playerBests = {}; // { player_id: { drill: best_level } }
  allScores.forEach(function(s) {
    if (!playerBests[s.player_id]) playerBests[s.player_id] = {};
    if (!playerBests[s.player_id][s.test_name] || s.level > playerBests[s.player_id][s.test_name]) {
      playerBests[s.player_id][s.test_name] = s.level;
    }
  });
  
  var drills = ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'];
  var percentiles = {};
  var totalPlayers = Object.keys(playerBests).length;
  
  // Position-filtered player IDs
  var posPlayerIds = [];
  if (position) {
    allPlayers.forEach(function(p) {
      if (p.position === position && playerBests[p.id]) posPlayerIds.push(p.id);
    });
  }
  var totalPosPlayers = posPlayerIds.length;
  
  drills.forEach(function(drill) {
    var s = playerScores[drill];
    if (!s || !s.level) return;
    var myLevel = s.level;
    
    // Overall percentile for this drill
    var allLevels = [];
    Object.keys(playerBests).forEach(function(pid) {
      if (playerBests[pid][drill]) allLevels.push(playerBests[pid][drill]);
    });
    
    var belowCount = allLevels.filter(function(l) { return l < myLevel; }).length;
    var equalCount = allLevels.filter(function(l) { return l === myLevel; }).length;
    var overallPct = allLevels.length > 0 ? Math.round(((belowCount + equalCount * 0.5) / allLevels.length) * 100) : 0;
    
    // Position percentile for this drill
    var posPct = null;
    if (position && totalPosPlayers > 1) {
      var posLevels = [];
      posPlayerIds.forEach(function(pid) {
        if (playerBests[pid] && playerBests[pid][drill]) posLevels.push(playerBests[pid][drill]);
      });
      if (posLevels.length > 1) {
        var posBelowCount = posLevels.filter(function(l) { return l < myLevel; }).length;
        var posEqualCount = posLevels.filter(function(l) { return l === myLevel; }).length;
        posPct = Math.round(((posBelowCount + posEqualCount * 0.5) / posLevels.length) * 100);
      }
    }
    
    percentiles[drill] = {
      overall: overallPct,
      overallPool: allLevels.length,
      position: posPct,
      positionPool: position ? totalPosPlayers : 0,
      positionName: position || ''
    };
  });
  
  // Overall BPM percentile
  var myOverallLevels = [];
  drills.forEach(function(d) { if (playerScores[d] && playerScores[d].level) myOverallLevels.push(playerScores[d].level); });
  var myAvg = myOverallLevels.length > 0 ? myOverallLevels.reduce(function(a, b) { return a + b; }, 0) / myOverallLevels.length : 0;
  
  var allAvgs = [];
  Object.keys(playerBests).forEach(function(pid) {
    var levels = [];
    drills.forEach(function(d) { if (playerBests[pid][d]) levels.push(playerBests[pid][d]); });
    if (levels.length > 0) allAvgs.push(levels.reduce(function(a, b) { return a + b; }, 0) / levels.length);
  });
  
  var overallBelowCount = allAvgs.filter(function(a) { return a < myAvg; }).length;
  var overallEqualCount = allAvgs.filter(function(a) { return Math.abs(a - myAvg) < 0.01; }).length;
  var overallBpmPct = allAvgs.length > 0 ? Math.round(((overallBelowCount + overallEqualCount * 0.5) / allAvgs.length) * 100) : 0;
  
  // Position overall percentile
  var posOverallPct = null;
  if (position && posPlayerIds.length > 1) {
    var posAvgs = [];
    posPlayerIds.forEach(function(pid) {
      var levels = [];
      drills.forEach(function(d) { if (playerBests[pid] && playerBests[pid][d]) levels.push(playerBests[pid][d]); });
      if (levels.length > 0) posAvgs.push(levels.reduce(function(a, b) { return a + b; }, 0) / levels.length);
    });
    if (posAvgs.length > 1) {
      var posBelowAvg = posAvgs.filter(function(a) { return a < myAvg; }).length;
      var posEqualAvg = posAvgs.filter(function(a) { return Math.abs(a - myAvg) < 0.01; }).length;
      posOverallPct = Math.round(((posBelowAvg + posEqualAvg * 0.5) / posAvgs.length) * 100);
    }
  }
  
  percentiles._overall = {
    percentile: overallBpmPct,
    pool: allAvgs.length,
    positionPercentile: posOverallPct,
    positionPool: posPlayerIds.length,
    positionName: position || ''
  };
  
  return percentiles;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  var body = req.body;

  var playerName = body.name || 'Player';
  var position = body.position || '';
  var age = body.age || '';
  var height = body.height || '';
  var weight = body.weight || '';
  var wingspan = body.wingspan || '';
  var dominantHand = body.dominant_hand || '';
  var playStyle = body.play_style || '';
  var competitionLevel = body.competition_level || '';
  var yearsPlaying = body.years_playing || '';

  var totalSeasons = body.total_seasons || 0;
  var totalGames = body.total_games || 0;
  var totalAwards = body.total_awards || 0;
  var seasonHistory = body.season_history || '';

  var scores = body.scores || {};

  var testDescriptions = {
    react: {
      name: 'THE REACT',
      dimension: 'React',
      measures: 'Reaction & Rhythm',
      detail: 'Measures how fast the player processes and responds to visual stimuli at game speed. Tests rhythmic timing, anticipation, and the ability to play on tempo under pressure. Higher levels indicate a player who can operate at 120 BPM game pace without mental breakdown.',
      courtImpact: 'Fast break decisions, steal anticipation, help defense rotations, shot clock awareness, clutch-moment composure'
    },
    recall: {
      name: 'THE RECALL',
      dimension: 'Recall',
      measures: 'Working Memory',
      detail: 'Measures how many positions, assignments, and reads the player can hold in active memory simultaneously. Scales from 5 to 14 elements. Higher levels indicate a player who can execute complex offensive sets while tracking defensive assignments.',
      courtImpact: 'Play execution, offensive set memorization, defensive assignment recall, in-game adjustment retention, coach instruction implementation'
    },
    reflex: {
      name: 'THE REFLEX',
      dimension: 'Reflex',
      measures: 'Visual Processing / Court Vision',
      detail: 'Measures the ability to capture an entire scene in a split second — all player positions, open lanes, and spacing — in flash times as short as 0.8 seconds. This is the closest measurable analog to elite court vision.',
      courtImpact: 'Skip passes, no-look assists, drive-and-kick reads, fast break outlet vision, defensive rotations, reading the full floor in transition'
    },
    replay: {
      name: 'THE REPLAY',
      dimension: 'Replay',
      measures: 'Sequence Memory / Play Recall',
      detail: 'Measures the ability to memorize and execute multi-step sequences under increasing complexity and speed. Sequences scale from 5 to 25 steps with unique audio-visual encoding.',
      courtImpact: 'Running plays from memory, executing complex sets, adapting to in-game play calls, film study retention, automating offensive actions'
    },
    ritmo: {
      name: 'THE RITMO',
      dimension: 'Ritmo',
      measures: 'Change Detection',
      detail: 'Measures how quickly and accurately a player detects subtle changes in a visual pattern — the cognitive foundation of reading defensive rotations and identifying mismatches in real time.',
      courtImpact: 'Reading defensive shifts, identifying the open man after a rotation, noticing backdoor cuts, pick-and-roll coverage reads, zone defense gap identification'
    },
    beat: {
      name: 'THE BEAT',
      dimension: 'Beat',
      measures: 'Game Rhythm & Timing',
      detail: 'Measures internal rhythm and timing synchronization across multiple Latin-influenced musical patterns (Reggaeton, Bomba, Plena, Salsa, Clave, Merengue). Tests the player\'s ability to stay on beat under changing tempos — the cognitive foundation of flow state.',
      courtImpact: 'Dribble cadence control, pick-and-roll timing, shot rhythm consistency, transition pace management, game tempo control, clutch-moment rhythm maintenance'
    }
  };

  var ratingLabels = {
    1: 'Rookie', 2: 'Developing', 3: 'Solid', 4: 'Advanced', 5: 'Elite',
    6: 'Pro', 7: 'All-Star', 8: 'MVP', 9: 'Hall of Fame', 10: 'GOAT'
  };

  var speedLabels = {
    slow: 'Training (60 BPM)',
    med: 'Tempo (90 BPM)',
    fast: 'Elite (120 BPM)'
  };

  // Build detailed score analysis
  var scoreLines = [];
  var strengthTests = [];
  var weakTests = [];
  var totalLevel = 0;
  var testCount = 0;

  ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'].forEach(function(test) {
    var s = scores[test];
    var desc = testDescriptions[test];
    if (s && s.level) {
      var rating = ratingLabels[s.level] || 'Level ' + s.level;
      var speed = speedLabels[s.speed] || s.speed;
      scoreLines.push(
        desc.dimension + ': ' + desc.name + ' — ' + desc.measures +
        '\n  Level: L' + s.level + ' (' + rating + ') | Speed: ' + speed + ' | Score: ' + s.score + ' pts' +
        '\n  What it measures: ' + desc.detail +
        '\n  Court impact: ' + desc.courtImpact
      );
      totalLevel += s.level;
      testCount++;
      if (s.level >= 7) strengthTests.push({ test: test, level: s.level, name: desc.name, dim: desc.dimension });
      if (s.level <= 5) weakTests.push({ test: test, level: s.level, name: desc.name, dim: desc.dimension });
    }
  });

  var overallLevel = testCount > 0 ? Math.round(totalLevel / testCount) : 0;
  var overallRating = ratingLabels[overallLevel] || 'Not Rated';

  // Calculate dominant BPM speed across all drills
  var speedCount = { slow: 0, med: 0, fast: 0 };
  ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'].forEach(function(t) {
    if (scores[t] && scores[t].speed) speedCount[scores[t].speed]++;
  });
  var dominantSpeed = 'slow';
  if (speedCount.fast >= speedCount.med && speedCount.fast >= speedCount.slow) dominantSpeed = 'fast';
  else if (speedCount.med >= speedCount.slow) dominantSpeed = 'med';
  var dominantSpeedLabel = speedLabels[dominantSpeed] || 'Training (60 BPM)';
  var dominantBPM = dominantSpeed === 'fast' ? '120' : dominantSpeed === 'med' ? '90' : '60';

  if (scoreLines.length === 0) {
    return res.status(400).json({ error: 'No cognitive scores to analyze' });
  }

  // === PERCENTILE RANKINGS ===
  var percentiles = {};
  var percentileContext = '';
  try {
    percentiles = await calculatePercentiles(scores, position);
    
    percentileContext = '\nPERCENTILE RANKINGS (among all BPM Basketball players):\n';
    
    // Overall
    if (percentiles._overall) {
      var ov = percentiles._overall;
      percentileContext += 'Overall BPM: ' + ov.percentile + 'th percentile (out of ' + ov.pool + ' players)';
      if (ov.positionPercentile !== null && ov.positionName) {
        percentileContext += ' | Among ' + ov.positionName + 's: ' + ov.positionPercentile + 'th percentile (out of ' + ov.positionPool + ' ' + ov.positionName + 's)';
      }
      percentileContext += '\n';
    }
    
    // Per drill
    ['react', 'recall', 'reflex', 'replay', 'ritmo', 'beat'].forEach(function(drill) {
      if (percentiles[drill]) {
        var p = percentiles[drill];
        var desc = testDescriptions[drill];
        percentileContext += desc.dimension + ': ' + p.overall + 'th percentile (pool: ' + p.overallPool + ')';
        if (p.position !== null && p.positionName) {
          percentileContext += ' | Among ' + p.positionName + 's: ' + p.position + 'th percentile (pool: ' + p.positionPool + ')';
        }
        percentileContext += '\n';
      }
    });
    
    percentileContext += '\nIMPORTANT: Use these percentile rankings prominently in the report. When discussing strengths, say things like "places him in the 94th percentile among all point guards on BPM Basketball." Percentiles make the report powerful for coaches — they show relative performance, not just absolute scores. If the pool size is small (under 20), mention the pool is growing but still reference the percentile.\n';
    
  } catch (err) {
    console.error('Percentile calculation error:', err);
    percentileContext = '\n[Percentile data unavailable — write report without percentile references]\n';
  }

  // Build player context section
  var profileContext = 'PLAYER PROFILE:\n';
  profileContext += 'Name: ' + playerName + '\n';
  if (position) profileContext += 'Position: ' + position + '\n';
  if (age) profileContext += 'Age: ' + age + '\n';
  if (height) profileContext += 'Height: ' + height + '\n';
  if (weight) profileContext += 'Weight: ' + weight + '\n';
  if (wingspan) profileContext += 'Wingspan: ' + wingspan + '\n';
  if (dominantHand) profileContext += 'Dominant Hand: ' + dominantHand + '\n';
  if (playStyle) profileContext += 'Play Style: ' + playStyle + '\n';
  if (competitionLevel) profileContext += 'Competition Level: ' + competitionLevel + '\n';
  if (yearsPlaying) profileContext += 'Years Playing Basketball: ' + yearsPlaying + '\n';

  var timelineContext = '';
  if (totalSeasons > 0 || totalGames > 0) {
    timelineContext = '\nBASKETBALL HISTORY:\n';
    if (totalSeasons) timelineContext += 'Total Seasons: ' + totalSeasons + '\n';
    if (totalGames) timelineContext += 'Total Games Played: ' + totalGames + '\n';
    if (totalAwards) timelineContext += 'Awards/Recognitions: ' + totalAwards + '\n';
    if (seasonHistory) timelineContext += 'Season Details:\n' + seasonHistory + '\n';
  }

  var strengthSummary = '';
  if (strengthTests.length > 0) {
    strengthSummary = '\nIDENTIFIED STRENGTHS (L7+): ' + strengthTests.map(function(s) { return s.name + ' (L' + s.level + ')'; }).join(', ');
  }
  var weakSummary = '';
  if (weakTests.length > 0) {
    weakSummary = '\nIDENTIFIED DEVELOPMENT AREAS (L5 or below): ' + weakTests.map(function(s) { return s.name + ' (L' + s.level + ')'; }).join(', ');
  }

  // === THE PROMPT ===
  var prompt = 'You are an elite basketball cognitive performance analyst for BPM Basketball™. You write professional scouting reports using the BPM Basketball™ Cognitive Performance System — the only system in basketball that measures how a player thinks on the court.\n\n' +

    'BPM Basketball™ measures 6 cognitive dimensions:\n' +
    'React (Reaction & Rhythm)\n' +
    'Recall (Working Memory)\n' +
    'Reflex (Visual Processing / Court Vision)\n' +
    'Replay (Sequence Memory / Play Recall)\n' +
    'Ritmo (Change Detection)\n' +
    'Beat (Game Rhythm & Timing)\n\n' +

    'Scale: L1 (Rookie) → L10 (GOAT). Each level is earned through verified drill performance — players cannot fake these scores.\n' +
    'BPM Speeds: Training (60 BPM), Tempo (90 BPM), Elite (120 BPM). The speed at which a player achieved their level matters — an L7 at 120 BPM is significantly more impressive than an L7 at 60 BPM. Always mention the BPM speed alongside the level.\n\n' +

    profileContext +
    timelineContext +
    strengthSummary +
    weakSummary + '\n\n' +

    percentileContext + '\n' +

    'BPM COGNITIVE SCORES:\n' +
    'Overall: L' + overallLevel + ' (' + overallRating + ') @ ' + dominantBPM + ' BPM | Dominant Speed: ' + dominantSpeedLabel + ' | Tests Completed: ' + testCount + '/6\n\n' +
    scoreLines.join('\n\n') + '\n\n' +

    'GENERATE THE REPORT using these exact section headers:\n\n' +

    '🧠 COGNITIVE SCOUTING REPORT\n' +
    'Player: [name] | Position: [pos] | Overall BPM: L[X] [Rating] @ [BPM Speed]\n' +
    (dominantHand ? 'Hand: [hand] | ' : '') +
    (playStyle ? 'Style: [style] | ' : '') +
    (competitionLevel ? 'Level: [competition] | ' : '') +
    (yearsPlaying ? 'Experience: [X] years' : '') + '\n\n' +

    '📊 EXECUTIVE SUMMARY\n' +
    '3-4 sentences. Define this player\'s cognitive identity. What kind of basketball mind are they? How do they process the game differently from average players at their competition level? Be specific to their position' + (position ? ' (' + position + ')' : '') + '. Include their overall percentile ranking prominently. Mention the BPM speed they operate at — a player processing at 120 BPM thinks the game at elite tempo.\n\n' +

    '💪 COGNITIVE STRENGTHS\n' +
    'Top 2-3 strengths. For EACH strength:\n' +
    '- Name the BPM dimension, level, AND the BPM speed it was achieved at (e.g., "L8 React at 120 BPM")\n' +
    '- Include the percentile ranking (e.g., "94th percentile among point guards on BPM Basketball")\n' +
    '- Translate into 2-3 specific basketball scenarios where this shows up\n' +
    '- Reference their position, ' + (dominantHand ? 'dominant hand (' + dominantHand + '), ' : '') + 'and competition level\n' +
    '- Use specific basketball language (pick-and-roll, drive-and-kick, weak-side rotation, skip pass, etc.)\n\n' +

    '⚡ AREAS FOR DEVELOPMENT\n' +
    '1-2 weakest dimensions. For EACH:\n' +
    '- Name the BPM dimension, level, AND the BPM speed\n' +
    '- Include the percentile ranking to show where they stand\n' +
    '- Explain what this means on the court (specific game situations where this shows)\n' +
    '- Give a specific training recommendation using BPM Basketball drills — suggest increasing BPM speed as a progression path\n' +
    '- Frame constructively — development opportunity, not weakness\n\n' +

    '🏀 ON-COURT TRANSLATION\n' +
    'Break down what a coach should expect in these specific situations:\n' +
    '- Transition (offense AND defense)\n' +
    '- Half-court offense (specific to their position and play style)\n' +
    '- Defensive assignments and reads\n' +
    '- Pressure situations (close games, final minutes)\n' +
    '- Team dynamics (communication, leadership potential based on cognitive profile)\n' +
    (dominantHand ? '- How their dominant hand (' + dominantHand + ') combines with their cognitive strengths\n' : '') +
    '\n' +

    '🎯 COACH RECOMMENDATION\n' +
    '3-4 specific, actionable recommendations:\n' +
    '- Offensive role and responsibilities\n' +
    '- Defensive assignment type\n' +
    '- Ideal lineup role (starter, spark plug, closer, etc.)\n' +
    '- Play types that maximize their cognitive profile\n' +
    (competitionLevel ? '- Recommendations calibrated to ' + competitionLevel + ' competition\n' : '') +
    '\n' +

    '📈 DEVELOPMENT PATH\n' +
    '- Current overall: L' + overallLevel + ' @ ' + dominantBPM + ' BPM. Target: L' + Math.min(overallLevel + 2, 10) + ' @ ' + (dominantSpeed === 'fast' ? '120' : dominantSpeed === 'med' ? '120' : '90') + ' BPM\n' +
    '- Specific BPM Basketball drills to prioritize (name THE REACT, THE RECALL, etc.)\n' +
    '- Recommend progressing to the next BPM speed tier as a key development goal\n' +
    '- Recommended training frequency and duration\n' +
    '- What reaching the next level AND speed would unlock on the court\n' +
    '- How their percentile ranking would change with improvement\n' +
    '- Timeline estimate (e.g., "4-6 weeks of focused training")\n\n' +

    'WRITING RULES:\n' +
    '- Write like an elite professional scout, not an AI — direct, confident, specific\n' +
    '- Every sentence must reference a basketball scenario, play, or situation\n' +
    '- ALWAYS pair a level with its BPM speed — never say "L7 React" without also saying the BPM speed (e.g., "L7 React at 90 BPM")\n' +
    '- NEVER use generic phrases like "shows promise" or "has potential" without specific context\n' +
    '- Use basketball terminology naturally: pick-and-roll, iso, drive-and-kick, weak-side, help defense, closeout, skip pass, outlet, drag screen, etc.\n' +
    '- Reference their BPM dimensions by drill name (React, Recall, Reflex, Replay, Ritmo, Beat)\n' +
    '- ALWAYS include percentile rankings when discussing strengths and development areas — this is what makes the report valuable to coaches\n' +
    (position ? '- Write EVERY section specific to their position (' + position + '). A PG report should read completely different from a C report.\n' : '') +
    (dominantHand ? '- Reference their dominant hand (' + dominantHand + ') in offensive and defensive analysis\n' : '') +
    (playStyle ? '- Write through the lens of their play style (' + playStyle + ')\n' : '') +
    (competitionLevel ? '- Calibrate all analysis to their competition level (' + competitionLevel + ') — don\'t compare a rec league player to NBA standards\n' : '') +
    (age ? '- Consider their age (' + age + ') — cognitive development context matters for younger players\n' : '') +
    '- Keep total report between 500-700 words\n' +
    '- Do NOT use markdown formatting — use plain text with the emoji headers\n' +
    '- This report will be shared with coaches, scouts, and family — make it worth the premium price\n' +
    '- End with a memorable one-line summary of this player\'s cognitive identity that includes their BPM speed';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(500).json({ error: 'Report generation failed' });
    }

    var data = await response.json();
    var reportText = '';
    if (data.content && data.content.length) {
      data.content.forEach(function(block) {
        if (block.type === 'text') reportText += block.text;
      });
    }

    return res.status(200).json({
      report: reportText,
      overall_level: overallLevel,
      overall_rating: overallRating,
      dominant_speed: dominantSpeedLabel,
      dominant_bpm: dominantBPM,
      tests_completed: testCount,
      percentiles: percentiles,
      strengths: strengthTests.map(function(s) { return s.name + ' L' + s.level; }),
      development: weakTests.map(function(s) { return s.name + ' L' + s.level; }),
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};
