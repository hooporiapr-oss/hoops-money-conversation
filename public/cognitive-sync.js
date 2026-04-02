// cognitive-sync.js — Saves BPM Basketball™ scores to Supabase for logged-in Hooporia players
// Include this AFTER the game's own <script> block
// Each game must set window.COGNITIVE_TEST_NAME to: 'react', 'recall', 'reflex', or 'replay'
(function(){
  var SB_URL='https://rhsszirtbyvalugmbecm.supabase.co';
  var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoc3N6aXJ0Ynl2YWx1Z21iZWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Mjg3MzUsImV4cCI6MjA5MDMwNDczNX0.MK3sYXhbdVtijzAkXJXvMlF1t0xfk6bRumBnovbQkRs';
  var sb=null, playerId=null, testName=window.COGNITIVE_TEST_NAME||'unknown';
  async function initSync(){
    if(typeof window.supabase==='undefined'){
      // Load Supabase if not already loaded
      await new Promise(function(res,rej){
        var s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload=res;s.onerror=rej;document.head.appendChild(s);
      });
    }
    sb=window.supabase.createClient(SB_URL,SB_KEY);
    try{
      var{data:{user}}=await sb.auth.getUser();
      if(!user)return;
      var{data:players}=await sb.from('players').select('id').eq('auth_user_id',user.id);
      if(players&&players.length>0){
        playerId=players[0].id;
        console.log('🧠 Cognitive sync active for player:',playerId,'test:',testName);
      }
    }catch(e){console.log('Cognitive sync: not logged in')}
  }
  window.syncCognitiveScore=async function(speed,level,score,streak,tier){
    if(!playerId||!sb)return;
    try{
      var{error}=await sb.from('cognitive_scores').upsert({
        player_id:playerId,
        test_name:testName,
        speed:speed,
        level:level,
        score:score,
        streak:streak||0,
        tier:tier||1,
        updated_at:new Date().toISOString()
      },{onConflict:'player_id,test_name,speed'});
      if(error)console.error('Cognitive sync error:',error);
      else console.log('🧠 Score synced:',testName,speed,'L'+level,score+'pts');
    }catch(e){console.error('Cognitive sync error:',e)}
  };
  // Initialize when page loads
  if(document.readyState==='complete')initSync();
  else window.addEventListener('load',initSync);
})();
