import { useState, useEffect, useRef } from 'react';

const MODE_ICONS = { osu: '🎯', taiko: '🥁', fruits: '🍎', mania: '🎹' };

const patternsData = {
  SingleNote: ['0000', '0010', '0000', '0000'], LongNote:   ['0000', '00L0', '0000', '0000'],
  Chord:      ['0000', '0010', '0000', '0010'], JumpDouble: ['0010', '0010', '0000', '0000'],
  HandTriple: ['0010', '0010', '0010', '0000'], Quad:       ['0010', '0010', '0010', '0010'],
  SingleStream:    ['10001000', '01000100', '00100010', '00010001'], LightJumpstream: ['10002000', '01020020', '02000100', '20010020'],
  DenseJumpstream: ['20201020', '02020202', '20102000', '02000210'], LightHandstream: ['20202020', '02020202', '20102010', '01000100'],
  DenseHandstream: ['20202020', '02020202', '20202020', '01010101'], Quadstream:      ['20202020', '20202020', '20202020', '20202020'],
  Brokenstream:    ['10000010', '00101000', '01000100', '00010001'], Staircase:       ['00010000', '00100001', '01000010', '10000100'],
  Rolls:           ['10001000', '01000100', '00100010', '00010001'], SplitRolls:      ['10001000', '01000100', '00010001', '00100010'],
  TwoHandTrills:   ['10101010', '10101010', '01010101', '01010101'], OneHandTrill:    ['10101010', '01010101', '00000000', '00000000'],
  Jumptrill:       ['10101010', '01010101', '01010101', '10101010'], SplitTrills:     ['10101010', '01010101', '10101010', '01010101'],
  RunningMan:      ['11111111', '01000100', '00100010', '00010001'], Pedaling:        ['11111111', '01000100', '01100110', '00010001'],
  Ladder:          ['10000100', '11000110', '01100011', '00100001'], Flams:           ['00100000', '00010000', '00000100', '00000010'],
  Anchors:         ['10001000', '01010010', '00100001', '00000100'], Minijack:        ['00110000', '00000000', '00000000', '00000000'],
  LongJack:        ['11110000', '00000000', '00000000', '00000000'], Jumpjack:        ['11100000', '11100000', '00011100', '00011100'],
  Chordjack:       ['11101110', '11101110', '11101110', '00000000'], Shield:          ['00000', '01L00', '00000', '00000'],
  ReverseShield:   ['00000', '0L100', '00000', '00000'], Inverse:         ['10L01', 'L010L', '10L01', 'L010L']
};

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  
  const [rankings, setRankings] = useState({ osu: null, taiko: null, fruits: null, mania: null });
  const [loadingRankings, setLoadingRankings] = useState(true);

  const [data, setData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  
  const searchRef = useRef(null);

  const handleSearch = async (username, targetMode = 'default') => {
    const nameToSearch = username || searchQuery;
    if (!nameToSearch) return;
    
    setIsAnalyzing(true); setError(null); setLiveSuggestions([]); setShowAllPatterns(false);

    try {
      const response = await fetch(`/api/osu?action=profile&username=${nameToSearch}&mode=${targetMode}`);
      if (!response.ok) throw new Error();
      const rawData = await response.json();
      
      setData({
        profile: {
          name: rawData.user.username, avatar: rawData.user.avatar_url, country: rawData.user.country_code,
          rank: rawData.user.statistics.global_rank || 0, pp: Math.round(rawData.user.statistics.pp) || 0,
          acc: (rawData.user.statistics.hit_accuracy || 0).toFixed(2), playcount: rawData.user.statistics.play_count,
          level: rawData.user.statistics.level.current,
          levelProgress: rawData.user.statistics.level.progress,
          grades: rawData.user.statistics.grade_counts,
        },
        bestPlays: rawData.bestScores || [], recentPlays: rawData.recentScores || [], currentMode: rawData.actualMode
      });

      const newUrl = `${window.location.pathname}?user=${rawData.user.username}&mode=${rawData.actualMode}`;
      window.history.replaceState({}, '', newUrl);

      if (!recentSearches.includes(nameToSearch)) {
        const newRecent = [nameToSearch, ...recentSearches].slice(0, 6);
        setRecentSearches(newRecent);
        localStorage.setItem('astra_recents_v8', JSON.stringify(newRecent));
      }
    } catch (err) {
      setError(`No se encontraron datos para "${nameToSearch}".`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('astra_recents_v8');
    if (saved) setRecentSearches(JSON.parse(saved));

    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get('user');
    if (urlUser) {
      setSearchQuery(urlUser);
      handleSearch(urlUser, params.get('mode') || 'default');
    }

    const fetchLiveRankings = async () => {
      const modes = ['osu', 'taiko', 'fruits', 'mania'];
      try {
        const promises = modes.map(mode => fetch(`/api/osu?action=rankings&mode=${mode}&country=CL`).then(res => res.json()));
        const results = await Promise.all(promises);
        const fetched = {};
        modes.forEach((mode, i) => { fetched[mode] = { global: results[i].global, local: results[i].local }; });
        setRankings(fetched);
      } catch (err) { console.error("Error cargando rankings"); }
      setLoadingRankings(false);
    };
    fetchLiveRankings();

    const handleClickOutside = (e) => { 
      if (searchRef.current && !searchRef.current.contains(e.target)) setLiveSuggestions([]); 
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchQuery.length < 3) { setLiveSuggestions([]); return; }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/osu?action=search&query=${searchQuery}`);
        if (res.ok) setLiveSuggestions(await res.json());
      } catch (err) { setLiveSuggestions([]); }
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const removeRecentSearch = (nameToRemove, e) => {
    e.stopPropagation();
    const newRecent = recentSearches.filter(n => n !== nameToRemove);
    setRecentSearches(newRecent);
    localStorage.setItem('astra_recents_v8', JSON.stringify(newRecent));
  };

  const calculateProjection = (profile, bestPlays) => {
    if (!bestPlays || bestPlays.length < 5) return null;
    
    const topPP = bestPlays[0].pp;
    const bottomPP = bestPlays[bestPlays.length - 1].pp;
    const momentum = topPP - bottomPP; 
    
    const projectedGain = Math.round((momentum * 0.8) + (profile.acc / 10));
    const projectedTotal = profile.pp + projectedGain;
    
    let message = '';
    let statusColor = '';
    if (momentum > 50) {
      message = "Ritmo de mejora acelerado. Estás rompiendo tu techo de habilidad rápidamente.";
      statusColor = '#10b981'; // Verde
    } else if (momentum > 20) {
      message = "Crecimiento constante. Tus jugadas muestran una progresión sólida y estable.";
      statusColor = '#3b82f6'; // Azul
    } else {
      message = "Posible estancamiento. Tus mejores jugadas tienen un valor muy similar; necesitas jugar mapas más difíciles.";
      statusColor = '#f59e0b'; // Naranja
    }

    return { gain: projectedGain, total: projectedTotal, message, statusColor };
  };

  const calculateMainPattern = (plays) => {
    if (!plays || plays.length === 0) return 'Ninguno';
    let totalLN = 0, totalRice = 0, totalBPM = 0;
    plays.forEach(p => {
      totalLN += p.beatmap.count_sliders || 0;
      totalRice += p.beatmap.count_circles || 0;
      totalBPM += p.beatmap.bpm || 0;
    });
    const lnRatio = totalLN / (totalLN + totalRice);
    const avgBPM = totalBPM / plays.length;

    if (lnRatio > 0.15) return 'LongNote'; 
    if (avgBPM >= 210) return 'DenseJumpstream';
    if (avgBPM >= 170 && avgBPM < 210) return 'Chordjack';
    return 'Staircase';
  };

  const checkMindblock = (recentPlays) => {
    if (!recentPlays || recentPlays.length === 0) return null;
    const mapCounts = {};
    for (const score of recentPlays) {
      if (score.rank === 'F' || score.accuracy < 0.90) {
        mapCounts[score.beatmap.id] = (mapCounts[score.beatmap.id] || 0) + 1;
        if (mapCounts[score.beatmap.id] >= 3) return score.beatmapset.title;
      }
    }
    return null;
  };

  const getTrainingRecommendations = (mode, patternType, bestPlays) => {
    if (!bestPlays || bestPlays.length === 0) return ["Juega más mapas para calcular tu nivel analítico."];
    
    const top5 = bestPlays.slice(0, 5);
    const avgStars = top5.reduce((sum, play) => sum + play.beatmap.difficulty_rating, 0) / top5.length;
    const comfortZone = avgStars.toFixed(2);
    const targetZone = (avgStars + 0.15).toFixed(2); 

    if (mode === 'mania') {
      switch(patternType) {
        case 'LongNote': 
          return [
            `Busca colecciones de "LN Dan Courses" rondando las ${targetZone}★ para mejorar tu control de liberación simultánea.`,
            `Usa el buscador del juego: "keys=4 stars>=${comfortZone} stars<=${targetZone} LN" para filtrar mapas eficientes.`,
            `Consejo de la comunidad: Practica mapas de estilo "Inverse" a ${comfortZone}★ para acostumbrar tus dedos a la tensión de mantener teclas presionadas.`
          ];
        case 'DenseJumpstream':
          return [
            `Tu límite de lectura y stamina ronda las ${targetZone}★. Busca "Stamina Packs" o mapas técnicos largos en este rango.`,
            `Para ganar consistencia, juega mapas de más de 4 minutos dentro de tu zona de confort (${comfortZone}★) sin pausar.`,
            `Consejo de la comunidad: Si sientes tensión aguda en los antebrazos, pausa inmediatamente. Jugar con dolor arruina tu accuracy y genera lesiones.`
          ];
        case 'Chordjack':
          return [
            `Descarga "Chordjack Training Packs" con densidades escalonadas hasta llegar a ${targetZone}★.`,
            `Juega mapas de vibro/jacks en tu zona de confort (${comfortZone}★) usando Hard Rock (HR) para forzar precisión estricta.`,
            `Consejo de la comunidad: Mantén las muñecas altas y relajadas. Tensar la mano en jacks largos rompe tu ritmo natural.`
          ];
        default:
          return [
            `Tu nivel mecánico general se estabiliza en ${comfortZone}★. Intenta empujar tu límite a ${targetZone}★ en sesiones de 30 minutos.`,
            `Busca mapas de "Stream Practice" o "Handstream" adaptados a tu Star Rating para ganar consistencia general.`,
            `Consejo de la comunidad: Evita jugar repetidamente los mismos mapas. La memoria muscular se estanca si no expones tus ojos a patrones nuevos.`
          ];
      }
    } else if (mode === 'osu') {
      return [
        `Tu zona de confort para apuntar (Aim) y mantener el combo está en ${comfortZone}★. Intenta jugar mapas completos de ${targetZone}★ sin usar mods de reducción.`,
        `Para mejorar tu precisión global, juega mapas de ${comfortZone}★ enfocándote en seguir rígidamente el ritmo de la música, no solo reaccionando visualmente al Approach Circle.`,
        `Consejo de la comunidad: Evita el "retry spam" (reiniciar frenéticamente si fallas al inicio). Jugar mapas enteros hasta la pantalla de resultados mejora tu resistencia nerviosa.`
      ];
    } else if (mode === 'taiko') {
      return [
        `Tu capacidad de lectura de colores se estabiliza en ${comfortZone}★. Juega mapas técnicos de ${targetZone}★ para mejorar tu reacción a ráfagas densas.`,
        `Practica la alternancia estricta (Full Alternate) en lugar de depender de una mano dominante, es vital para patrones kddk y dkkd a altas velocidades.`,
        `Consejo de la comunidad: Acostumbra tu vista a mirar la mitad derecha de la pista, en lugar del círculo de golpeo, para anticipar los patrones largos antes de que lleguen.`
      ];
    } else if (mode === 'fruits') {
      return [
        `Tu límite de reacción y control de Hyperdashes está cerca de las ${targetZone}★. Juega mapas en este rango para forzar movimientos precisos.`,
        `Enfócate en atrapar los "droplets" (gotas pequeñas). Fallarlos destruye tu porcentaje de precisión final aunque atrapes las frutas grandes principales.`,
        `Consejo de la comunidad: Controla tu inercia. Es mejor soltar la tecla de dash un milisegundo antes, que pasarte del rango de la fruta y fallar el combo.`
      ];
    }
  };

  const PatternVisualizer = ({ id, name }) => {
    const lanes = patternsData[id] || patternsData.Staircase;
    return (
      <div style={{textAlign: 'center', flex: '1 1 70px', maxWidth: '85px'}}>
        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0f172a', padding: '6px', borderRadius: '4px', border: '1px solid #334155', height: '80px', justifyContent: 'center' }}>
          {lanes.map((lane, i) => (
             <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, justifyContent: 'flex-end' }}>
               {lane.split('').map((char, j) => {
                 if (char === '0') return <div key={j} style={{height: '6px'}}/>;
                 if (char === '1') return <div key={j} style={{backgroundColor: '#e2e8f0', borderRadius: '1px', height: '6px'}}/>;
                 if (char === '2') return <div key={j} style={{backgroundColor: '#f472b6', borderRadius: '1px', height: '6px'}}/>;
                 if (char === 'L') return <div key={j} style={{backgroundColor: '#c084fc', borderRadius: '2px', height: '24px'}}/>;
                 return null;
               })}
             </div>
          ))}
        </div>
        <span style={{fontSize: '0.65em', color: '#94a3b8', display: 'block', marginTop: '5px', wordWrap: 'break-word', lineHeight: '1.2'}}>{name}</span>
      </div>
    );
  };

  const CategoryGroup = ({ title, color, children }) => (
    <div style={{ backgroundColor: '#1e293b', border: `1px solid ${color}`, borderRadius: '8px', overflow: 'hidden', flex: '1 1 250px' }}>
      <div style={{ backgroundColor: color, color: '#fff', padding: '6px 10px', fontSize: '0.8em', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ padding: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>{children}</div>
    </div>
  );

  const mainPatternType = data && data.currentMode === 'mania' ? calculateMainPattern(data.bestPlays) : '';
  const detectedMindblock = data ? checkMindblock(data.recentPlays) : null;
  const recommendations = data ? getTrainingRecommendations(data.currentMode, mainPatternType, data.bestPlays) : [];
  const projection = data ? calculateProjection(data.profile, data.bestPlays) : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.brand} onClick={() => { setData(null); window.history.replaceState({}, '', window.location.pathname); }}>
          <span style={{color: '#3b82f6', fontSize: '1.4em'}}>▲</span> ASTRA Analyzer
        </div>
        
        <div style={{position: 'relative', width: '400px'}} ref={searchRef}>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} style={{display: 'flex'}}>
            <input type="text" placeholder="Buscar jugador en osu!..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={styles.searchInput} />
            <button type="submit" style={styles.searchButton}>Analizar</button>
          </form>
          
          {liveSuggestions.length > 0 && (
            <div style={styles.autocompleteDiv}>
              {liveSuggestions.map(user => (
                <div key={user.id} style={styles.autoItem} onClick={() => { setSearchQuery(user.username); handleSearch(user.username); setLiveSuggestions([]); }}>
                  <img src={user.avatar_url} width="24" style={{borderRadius: '4px'}} alt=""/> 
                  <span style={{fontWeight: 'bold'}}>{user.username}</span>
                </div>
              ))}
            </div>
          )}
          {isSearching && <div style={{...styles.autocompleteDiv, padding: '12px', color: '#94a3b8', fontStyle: 'italic'}}>Buscando en osu!...</div>}
        </div>
      </header>

      <main style={styles.main}>
        {!data && !isAnalyzing && (
          <div style={{maxWidth: '1100px', margin: '0 auto', marginTop: '10vh'}}>
            <div style={{textAlign: 'center', marginBottom: '40px'}}>
              <h1 style={{color: '#fff', fontSize: '2.5em', marginBottom: '10px'}}>Panel Analítico de osu!</h1>
              <p style={{color: '#94a3b8', marginBottom: '40px'}}>Conectado a la base de datos oficial en tiempo real.</p>
            </div>

            <div style={{backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '30px', maxWidth: '600px', margin: '0 auto'}}>
              <h3 style={{color: '#e2e8f0', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>🕒 Búsquedas Recientes</h3>
              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                {recentSearches.length === 0 ? <span style={{color: '#64748b', fontSize: '0.9em'}}>Tu caché está limpia.</span> : 
                  recentSearches.map(name => (
                    <div key={name} style={{backgroundColor: '#0f172a', border: '1px solid #3b82f6', borderRadius: '20px', padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s'}}>
                      <span onClick={() => handleSearch(name)} style={{color: '#e2e8f0', fontSize: '0.95em'}}>{name}</span>
                      <span onClick={(e) => removeRecentSearch(name, e)} style={{color: '#ef4444', fontWeight: 'bold', padding: '0 5px', fontSize: '1.2em'}}>&times;</span>
                    </div>
                  ))
                }
              </div>
            </div>

            <div style={{textAlign: 'center', marginTop: '60px'}}>
              <h2 style={{color: '#fff', fontSize: '2em', marginBottom: '10px'}}>Rankings Oficiales en Tiempo Real</h2>
              <p style={{color: '#94a3b8', marginBottom: '30px'}}>Los mejores jugadores extraídos de la API sin tiempos de espera.</p>
              
              {loadingRankings ? (
                <div style={{color: '#3b82f6', padding: '40px', fontSize: '1.2em'}}>Cargando base de datos mundial...</div>
              ) : (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px'}}>
                  {['osu', 'taiko', 'fruits', 'mania'].map(mode => (
                    <div key={mode} style={{backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden'}}>
                      <div style={{backgroundColor: '#0f172a', padding: '15px', fontWeight: 'bold', color: '#e2e8f0', textTransform: 'uppercase'}}>{mode === 'fruits' ? 'CATCH' : mode.toUpperCase()}</div>
                      <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
                        {rankings[mode]?.global && (
                          <div style={{cursor: 'pointer', textAlign: 'left'}} onClick={() => handleSearch(rankings[mode].global.user.username, mode)}>
                            <div style={{fontSize: '0.8em', color: '#3b82f6', fontWeight: 'bold', marginBottom: '5px'}}>Top 1 Global</div>
                            <div style={{color: '#fff', fontSize: '1.1em'}}>{rankings[mode].global.user.username}</div>
                          </div>
                        )}
                        {rankings[mode]?.local && (
                          <div style={{cursor: 'pointer', textAlign: 'left', borderTop: '1px dashed #334155', paddingTop: '15px'}} onClick={() => handleSearch(rankings[mode].local.user.username, mode)}>
                            <div style={{fontSize: '0.8em', color: '#10b981', fontWeight: 'bold', marginBottom: '5px'}}>Top 1 Nacional (CL)</div>
                            <div style={{color: '#fff', fontSize: '1.1em'}}>{rankings[mode].local.user.username}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isAnalyzing && <div style={{textAlign:'center', marginTop:'10vh', color:'#3b82f6', fontSize: '1.2em'}}>Analizando métricas del jugador...</div>}
        {error && <div style={{textAlign:'center', color:'#ef4444', backgroundColor: '#451a1a', padding: '15px', borderRadius: '8px', maxWidth: '600px', margin: '0 auto'}}>{error}</div>}

        {data && !isAnalyzing && (
          <div style={styles.dashboardLayout}>
            
            {/* COLUMNA IZQUIERDA (Perfil + Progreso) */}
            <div style={{flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
              
              <div style={styles.card}>
                <div style={{display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '25px'}}>
                  <img src={data.profile.avatar} alt="Avatar" style={{width: '90px', height: '90px', borderRadius: '12px', border: '3px solid #3b82f6'}} />
                  <h1 style={{margin: '0', fontSize: '1.8em', color: '#fff', display: 'flex', alignItems: 'center'}}><img src={`https://flagcdn.com/w40/${data.profile.country.toLowerCase()}.png`} width="30" alt="" style={{marginRight: '10px', borderRadius:'4px'}}/>{data.profile.name}</h1>
                </div>

                <div style={{display: 'flex', gap: '5px', backgroundColor: '#0f172a', padding: '5px', borderRadius: '8px', marginBottom: '25px'}}>
                  {['osu', 'taiko', 'fruits', 'mania'].map(m => (
                    <button key={m} onClick={() => handleSearch(data.profile.name, m)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        backgroundColor: data.currentMode === m ? '#3b82f6' : 'transparent', color: data.currentMode === m ? '#fff' : '#64748b', transition: '0.2s' }}>
                      <span style={{fontSize: '1.4em', lineHeight: '1'}}>{MODE_ICONS[m]}</span>
                      <span style={{fontWeight: 'bold', fontSize: '0.7em', letterSpacing: '0.5px'}}>{m === 'fruits' ? 'CATCH' : m.toUpperCase()}</span>
                    </button>
                  ))}
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  <div style={styles.statRow}><span>Rango Global:</span> <strong style={{fontSize: '1.1em'}}>#{data.profile.rank.toLocaleString()}</strong></div>
                  <div style={styles.statRow}><span>Performance:</span> <strong style={{color: '#3b82f6', fontSize: '1.1em'}}>{data.profile.pp.toLocaleString()} PP</strong></div>
                  <div style={styles.statRow}><span>Precisión:</span> <strong style={{fontSize: '1.1em'}}>{data.profile.acc}%</strong></div>
                  <div style={styles.statRow}><span>Jugadas:</span> <strong style={{fontSize: '1.1em'}}>{data.profile.playcount.toLocaleString()}</strong></div>
                </div>
              </div>

              {/* TARJETA 2: Progreso y Rangos (AHORA DENTRO DE LA COLUMNA IZQUIERDA) */}
              <div style={styles.card}>
                <h3 style={{color: '#94a3b8', margin: '0 0 15px 0', fontSize: '0.9em'}}>Progreso y Rangos</h3>
                
                <div style={{marginBottom: '20px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                    <span style={{color: '#e2e8f0', fontWeight: 'bold'}}>Nivel {data.profile.level}</span>
                    <span style={{color: '#94a3b8', fontSize: '0.85em'}}>{data.profile.levelProgress}%</span>
                  </div>
                  <div style={{width: '100%', height: '8px', backgroundColor: '#0f172a', borderRadius: '4px', overflow: 'hidden'}}>
                    <div style={{width: `${data.profile.levelProgress}%`, height: '100%', backgroundColor: '#3b82f6'}}></div>
                  </div>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', textAlign: 'center'}}>
                  <div><span style={{color: '#fde047', fontWeight: 'bold', fontSize: '1.2em', textShadow: '0 0 5px rgba(253,224,71,0.5)'}}>SS</span><div style={{color: '#cbd5e1', fontSize: '0.9em'}}>{data.profile.grades.ss + data.profile.grades.ssh}</div></div>
                  <div><span style={{color: '#fcd34d', fontWeight: 'bold', fontSize: '1.2em'}}>S</span><div style={{color: '#cbd5e1', fontSize: '0.9em'}}>{data.profile.grades.s + data.profile.grades.sh}</div></div>
                  <div><span style={{color: '#4ade80', fontWeight: 'bold', fontSize: '1.2em'}}>A</span><div style={{color: '#cbd5e1', fontSize: '0.9em'}}>{data.profile.grades.a}</div></div>
                </div>
              </div>
              
            </div>

            {/* COLUMNA DERECHA */}
            <div style={{flex: '2.5', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0}}>
              {data.bestPlays.length === 0 ? (
                <div style={{...styles.card, textAlign: 'center', padding: '50px 20px'}}>
                  <span style={{fontSize: '3em'}}>📭</span>
                  <h2 style={{color: '#e2e8f0', margin: '15px 0 5px 0'}}>No hay registros</h2>
                  <p style={{color: '#94a3b8'}}>El jugador no tiene partidas guardadas en <strong>{data.currentMode.toUpperCase()}</strong>.</p>
                </div>
              ) : (
                <>
                  {projection && (
                    <div style={{...styles.card, borderTop: `4px solid ${projection.statusColor}`, backgroundColor: '#1e293b', marginBottom: '0'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <h3 style={{color: projection.statusColor, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>🔮 Proyección a 30 Días</h3>
                          <p style={{color: '#94a3b8', fontSize: '0.9em', margin: 0}}>{projection.message}</p>
                        </div>
                        <div style={{textAlign: 'right', backgroundColor: '#0f172a', padding: '15px 25px', borderRadius: '8px', border: '1px solid #334155'}}>
                          <span style={{color: '#94a3b8', fontSize: '0.8em', display: 'block', marginBottom: '5px'}}>POTENCIAL ESTIMADO</span>
                          <strong style={{color: '#fff', fontSize: '1.8em'}}>{projection.total.toLocaleString()} PP</strong>
                          <span style={{color: '#10b981', fontSize: '0.9em', display: 'block', fontWeight: 'bold'}}>+{projection.gain} PP proyectados</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{...styles.card, borderTop: '4px solid #f59e0b', backgroundColor: '#1e293b', marginBottom: '0'}}>
                    <h3 style={{color: '#fbbf24', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>💡 Diagnóstico y Entrenamiento Algorítmico</h3>
                    
                    {detectedMindblock && (
                      <div style={{backgroundColor: '#451a1a', borderLeft: '4px solid #ef4444', padding: '15px', borderRadius: '4px', marginBottom: '15px'}}>
                        <span style={{color: '#fca5a5', fontWeight: 'bold', fontSize: '0.85em', letterSpacing: '1px'}}>⚠️ MINDBLOCK DETECTADO EN EL HISTORIAL RECIENTE</span>
                        <p style={{color: '#fecaca', margin: '5px 0 0 0', fontSize: '0.95em'}}>
                          Has estado fallando repetidamente o perdiendo precisión severa en <strong>"{detectedMindblock}"</strong>. 
                          La comunidad recomienda borrar este mapa de tu carpeta o ignorarlo por al menos una semana para resetear tu memoria muscular.
                        </p>
                      </div>
                    )}

                    <div style={{backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155'}}>
                      <strong style={{color: '#e2e8f0', display: 'block', marginBottom: '10px'}}>
                        Basado en tus mejores partidas, este es tu plan para {data.currentMode === 'fruits' ? 'CATCH' : data.currentMode.toUpperCase()}:
                      </strong>
                      <ul style={{color: '#94a3b8', paddingLeft: '20px', margin: 0, lineHeight: '1.6'}}>
                        {recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                      </ul>
                    </div>
                  </div>

                  {data.currentMode === 'mania' && (
                    <div style={{...styles.card, borderTop: '4px solid #8b5cf6'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                        <h3 style={{color: '#c4b5fd', margin: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>🧠 Osu!mania Pattern Repository</h3>
                        <button onClick={() => setShowAllPatterns(!showAllPatterns)} style={styles.outlineBtn}>{showAllPatterns ? 'Ocultar repositorio' : 'Explorar todos los patrones'}</button>
                      </div>

                      {showAllPatterns ? (
                        <div style={{marginTop: '20px', paddingTop: '10px'}}>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px'}}>
                            <CategoryGroup title="Note Type" color="#be123c"><PatternVisualizer id="SingleNote" name="Single Note" /><PatternVisualizer id="LongNote" name="Long note (LN)" /><PatternVisualizer id="Chord" name="Chord" /></CategoryGroup>
                            <CategoryGroup title="Density" color="#d97706"><PatternVisualizer id="JumpDouble" name="Jump (Double)" /><PatternVisualizer id="HandTriple" name="Hand (Triple)" /><PatternVisualizer id="Quad" name="Quad" /></CategoryGroup>
                            <CategoryGroup title="Streams" color="#eab308"><PatternVisualizer id="SingleStream" name="Single Stream" /><PatternVisualizer id="LightJumpstream" name="Light Jumpstream" /><PatternVisualizer id="DenseJumpstream" name="Dense Jumpstream" /><PatternVisualizer id="LightHandstream" name="Light Handstream" /><PatternVisualizer id="DenseHandstream" name="Dense Handstream" /><PatternVisualizer id="Quadstream" name="Quadstream" /><PatternVisualizer id="Brokenstream" name="Brokenstream" /></CategoryGroup>
                            <CategoryGroup title="Patterns" color="#22c55e"><PatternVisualizer id="Staircase" name="Staircase" /><PatternVisualizer id="Rolls" name="Rolls" /><PatternVisualizer id="SplitRolls" name="Split Rolls" /><PatternVisualizer id="TwoHandTrills" name="Two Hand Trills" /><PatternVisualizer id="OneHandTrill" name="One Hand Trill" /><PatternVisualizer id="Jumptrill" name="Jumptrill" /><PatternVisualizer id="SplitTrills" name="Split Trills" /><PatternVisualizer id="RunningMan" name="Running Man" /><PatternVisualizer id="Pedaling" name="Pedaling" /><PatternVisualizer id="Ladder" name="Ladder" /><PatternVisualizer id="Flams" name="Flams (Graces)" /><PatternVisualizer id="Anchors" name="Anchors" /></CategoryGroup>
                            <CategoryGroup title="Jacks" color="#06b6d4"><PatternVisualizer id="Minijack" name="Minijack" /><PatternVisualizer id="LongJack" name="Long Jack" /><PatternVisualizer id="Jumpjack" name="Jumpjack" /><PatternVisualizer id="Chordjack" name="Chordjack" /></CategoryGroup>
                            <CategoryGroup title="Long notes" color="#3b82f6"><PatternVisualizer id="Shield" name="Shield" /><PatternVisualizer id="ReverseShield" name="Reverse Shield" /><PatternVisualizer id="Inverse" name="Inverse" /></CategoryGroup>
                          </div>
                        </div>
                      ) : (
                        <div style={{display: 'flex', gap: '25px', alignItems: 'center', backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px'}}>
                          <div style={{flex: '0 0 auto'}}><PatternVisualizer id={mainPatternType} name="TU PATRÓN MAIN" /></div>
                          <div>
                            <h2 style={{color: '#fff', margin: '0 0 5px 0'}}>{mainPatternType === 'LongNote' ? 'Long Notes Dominant' : mainPatternType === 'DenseJumpstream' ? 'Speed & Jumpstreams' : mainPatternType === 'Chordjack' ? 'Chordjack Dominant' : 'Staircase & Balanceado'}</h2>
                            <p style={{color: '#94a3b8', fontSize: '0.95em', margin: 0, lineHeight: '1.5'}}>El algoritmo calculó la densidad de teclas y el BPM de tus top plays reales para identificar este patrón mecánico.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={styles.card}>
                    <h3 style={{color: '#94a3b8', margin: '0 0 15px 0'}}>Mejores Jugadas (Top PP)</h3>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px'}}>
                      {data.bestPlays.slice(0,10).map((play, i) => (
                        <div key={i} style={{backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0}}>
                          <div style={{overflow: 'hidden', paddingRight: '10px'}}>
                            <strong style={{color: '#e2e8f0', fontSize: '0.95em', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{play.beatmapset.title}</strong>
                            <span style={{fontSize: '0.85em', color: '#94a3b8'}}>★ {play.beatmap.difficulty_rating}</span>
                          </div>
                          <div style={{textAlign: 'right', minWidth: '60px'}}>
                            <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '1.1em'}}>{Math.round(play.pp)}pp</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { width: '100%', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  brand: { fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' },
  searchInput: { width: '100%', padding: '12px 15px', borderRadius: '6px 0 0 6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', outline: 'none' },
  searchButton: { padding: '12px 20px', borderRadius: '0 6px 6px 0', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 'bold', cursor: 'pointer' },
  autocompleteDiv: { position: 'absolute', top: '100%', left: 0, right: '90px', backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '0 0 6px 6px', zIndex: 999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' },
  autoItem: { padding: '12px 15px', borderBottom: '1px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#e2e8f0', backgroundColor: '#1e293b' },
  main: { padding: '40px', maxWidth: '1400px', margin: '0 auto', width: '100%' },
  dashboardLayout: { display: 'flex', gap: '30px', alignItems: 'flex-start' },
  card: { backgroundColor: '#1e293b', padding: '30px', borderRadius: '12px', border: '1px solid #334155', width: '100%' },
  statRow: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #334155', paddingBottom: '12px', color: '#cbd5e1' },
  outlineBtn: { backgroundColor: 'transparent', border: '1px solid #8b5cf6', color: '#c4b5fd', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em', transition: 'all 0.2s ease', fontWeight: 'bold' }
};

export default App;