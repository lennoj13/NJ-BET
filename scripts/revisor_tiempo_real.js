import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

// Cargar variables de entorno
dotenv.config();

// Configuración
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_API_KEY || !ODDS_API_KEY) {
  console.error('❌ Faltan variables de entorno críticas.');
  process.exit(1);
}

// Inicializar clientes
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Mapa de nombres de DB a Keys de API (The Odds API)
const MAPA_LIGAS = {
  'Premier League': 'soccer_epl',
  'La Liga': 'soccer_spain_la_liga',
  'Serie A': 'soccer_italy_serie_a',
  'Bundesliga': 'soccer_germany_bundesliga',
  'Ligue 1': 'soccer_france_ligue_one',
  'Champions League': 'soccer_uefa_champs_league',
  'NBA': 'basketball_nba',
  'NFL': 'americanfootball_nfl',
  'MLB': 'baseball_mlb',
  'NHL': 'icehockey_nhl',
  'Eredivisie': 'soccer_netherlands_eredivisie',
  'Primeira Liga': 'soccer_portugal_primeira_liga'
};

// Duración estimada por deporte (en horas) para saber cuándo empezar a revisar
const DURACION_ESTIMADA = {
  'soccer': 2.0,
  'basketball': 2.5,
  'baseball': 3.5,
  'americanfootball': 3.5,
  'icehockey': 2.5,
  'tennis': 2.0,
  'default': 3.0
};

function getCategoriaDeporte(sportKey) {
  if (!sportKey) return 'default';
  
  // Intentamos traducir primero
  const key = MAPA_LIGAS[sportKey] || sportKey;
  const k = key.toLowerCase();
  
  if (k.includes('soccer') || k.includes('football') || k.includes('league') || k.includes('liga') || k.includes('serie')) return 'soccer';
  if (k.includes('nba') || k.includes('basketball')) return 'basketball';
  if (k.includes('baseball') || k.includes('mlb')) return 'baseball';
  if (k.includes('nfl') || k.includes('americanfootball')) return 'americanfootball';
  if (k.includes('hockey') || k.includes('nhl')) return 'icehockey';
  if (k.includes('tennis')) return 'tennis';
  return 'default';
}

/**
 * Paso 1: Obtener Partidos de Tickets VIVOS (PENDING)
 * Lógica de optimización: No traemos partidos de tickets que ya son 'lost' o 'won'.
 */
async function obtenerPartidosPrioritarios() {
  console.log('⏱️  Buscando partidos en tickets VIVOS...');
  
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 5); // Miramos hasta 5 días atrás por seguridad
  
  // JOIN INTELIGENTE:
  // Traemos partidos donde:
  // 1. El partido está 'pending'
  // 2. El TICKET padre está 'pending' (Esto es la clave de tu optimización)
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select(`
      *,
      tickets!inner (
        id,
        estado,
        fecha
      )
    `)
    .eq('estado', 'pending')
    .eq('tickets.estado', 'pending') // <--- FILTRO CRÍTICO: Si el ticket ya perdió, ignoramos sus partidos
    .gte('hora', fechaLimite.toISOString());

  if (error) {
    console.error('Error DB:', error);
    return [];
  }

  const now = new Date();
  
  // Filtramos por tiempo: ¿Ya debió terminar el partido?
  const partidosRevisables = partidos.filter(p => {
    const horaInicio = new Date(p.hora);
    const categoria = getCategoriaDeporte(p.deporte);
    const duracionHoras = DURACION_ESTIMADA[categoria] || DURACION_ESTIMADA['default'];
    const horaFinEstimada = new Date(horaInicio.getTime() + (duracionHoras * 60 * 60 * 1000));
    
    // 1. ¿Ya pasó la hora estimada de fin?
    if (now < horaFinEstimada) {
      // console.log(`   ⏳ [SKIP TIME] ${p.partido} - Fin estimado: ${horaFinEstimada.toLocaleTimeString()}`);
      return false;
    }

    // 2. Lógica de "Backoff" (Evitar spam)
    // Si ya revisamos recientemente, esperamos un intervalo antes de volver a intentar.
    if (p.last_checked_at) {
      const ultimaRevision = new Date(p.last_checked_at);
      const minutosDesdeUltima = (now - ultimaRevision) / 1000 / 60;
      
      // Intervalo progresivo: Si llevamos muchos intentos, esperamos más.
      // Intentos 0-3: cada 30 min
      // Intentos 4-8: cada 60 min
      // Intentos >8: cada 120 min
      const intentos = p.intentos_revision || 0;
      let intervaloMinutos = 30;
      if (intentos > 3) intervaloMinutos = 60;
      if (intentos > 8) intervaloMinutos = 120;

      if (minutosDesdeUltima < intervaloMinutos) {
        console.log(`   ⏳ [SKIP BACKOFF] ${p.partido} (Intento ${intentos}) - Esperando ${Math.round(intervaloMinutos - minutosDesdeUltima)} min`);
        return false;
      }
    }

    // 3. Límite de intentos (Safety break)
    // Si llevamos más de 12 intentos (aprox 12-24 horas post partido), lo dejamos para el Francotirador manual.
    if ((p.intentos_revision || 0) > 12) {
      console.log(`   🛑 [SKIP MAX] ${p.partido} - Excedió límite de intentos.`);
      return false;
    }

    return true;
  });

  console.log(`📋 Encontrados ${partidosRevisables.length} partidos listos para revisión (de tickets vivos).`);
  return partidosRevisables;
}

/**
 * Paso 2: Obtener Scores (The Odds API)
 * Es más barato y rápido que Tavily. Tavily queda para el Francotirador.
 */
async function obtenerScoresTargeted(partidos) {
  const nombresLigas = [...new Set(partidos.map(p => p.deporte).filter(Boolean))];
  
  // Mapeamos a keys de API y eliminamos duplicados
  const keysApi = [...new Set(nombresLigas.map(nombre => MAPA_LIGAS[nombre] || nombre))];

  if (keysApi.length === 0) return {};

  console.log(`📡 Consultando scores para ligas: ${keysApi.join(', ')}`);
  let scoresMap = {};

  for (const ligaKey of keysApi) {
    try {
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${ligaKey}/scores`, {
        params: {
          apiKey: ODDS_API_KEY,
          daysFrom: 3,
          dateFormat: 'iso'
        }
      });

      response.data.forEach(game => {
        // Clave compuesta para búsqueda exacta
        const key = `${game.home_team} vs ${game.away_team}`;
        
        // Guardamos info del partido, esté terminado o no
        if (game.scores || !game.completed) {
          const homeScore = game.scores?.find(s => s.name === game.home_team)?.score || 0;
          const awayScore = game.scores?.find(s => s.name === game.away_team)?.score || 0;
          
          scoresMap[key] = {
            marcador: `${homeScore}-${awayScore}`,
            estado: game.completed ? 'Finalizado' : 'En Juego/Pendiente',
            completed: game.completed,
            home_team: game.home_team,
            away_team: game.away_team,
            home_score: parseInt(homeScore),
            away_score: parseInt(awayScore)
          };
        }
      });
    } catch (error) {
      console.warn(`   ⚠️ Skip liga ${ligaKey}: ${error.message}`);
    }
  }
  
  return scoresMap;
}

/**
 * Paso 3: Evaluar y "Matar" Tickets al instante
 */
async function procesarPartidos(partidos, scoresMap) {
  for (const partido of partidos) {
    const key = partido.partido;
    const scoreData = scoresMap[key];

    if (!scoreData) {
      // CASO 1: No encontrado en la API (Nombre incorrecto o fecha muy lejana)
      // Incrementamos contador para eventualmente rendirnos
      console.log(`   ❓ No encontrado en API: ${key}`);
      await actualizarContadorRevision(partido);
      continue;
    }

    if (!scoreData.completed) {
      // CASO 2: Encontrado pero NO terminado (Juego en curso o No iniciado)
      // Esto protege contra errores de zona horaria. Si revisamos muy temprano,
      // la API nos dice "Hey, esto no ha terminado".
      // Solo actualizamos la fecha de revisión para no spamear, pero NO incrementamos los intentos de fallo.
      console.log(`   ⚽ En Juego / No Iniciado: ${key} [${scoreData.marcador}]`);
      await actualizarCheckSinIncrementar(partido);
      continue;
    }

    // CASO 3: Partido Terminado -> Evaluamos
    console.log(`   🎯 Evaluando: ${key} [${scoreData.marcador}]`);

    // 1. Evaluación Matemática (Rápida)
    let resultado = evaluarMatematicamente(partido, scoreData);

    // 2. Evaluación IA (Fallback si es compleja)
    if (!resultado) {
      resultado = await evaluarConIA(partido, scoreData);
    }

    // 3. Actualización Crítica
    if (resultado) {
      await actualizarSistema(partido, resultado, scoreData.marcador);
    }
  }
}

async function actualizarCheckSinIncrementar(partido) {
  // Solo actualizamos el timestamp para que el Backoff funcione (esperar 30 min),
  // pero mantenemos el contador de intentos igual para no "quemar" oportunidades.
  await supabase
    .from('partidos')
    .update({ 
      last_checked_at: new Date().toISOString()
    })
    .eq('id', partido.id);
}

async function actualizarContadorRevision(partido) {
  const nuevosIntentos = (partido.intentos_revision || 0) + 1;
  await supabase
    .from('partidos')
    .update({ 
      last_checked_at: new Date().toISOString(),
      intentos_revision: nuevosIntentos
    })
    .eq('id', partido.id);
}

function evaluarMatematicamente(partido, scoreData) {
  const seleccion = partido.seleccion;
  const home = scoreData.home_team;
  const away = scoreData.away_team;
  const hScore = scoreData.home_score;
  const aScore = scoreData.away_score;

  // Ganador Directo
  if (seleccion === home) return hScore > aScore ? 'won' : 'lost';
  if (seleccion === away) return aScore > hScore ? 'won' : 'lost';
  if (seleccion === 'Draw' || seleccion === 'Empate') return hScore === aScore ? 'won' : 'lost';

  // Totales (Over/Under) - Ejemplo simple
  if (seleccion.includes('Over') || seleccion.includes('Más de')) {
    const linea = parseFloat(seleccion.match(/[\d\.]+/)?.[0]);
    if (linea) return (hScore + aScore) > linea ? 'won' : 'lost';
  }
  
  return null; // Requiere IA
}

async function evaluarConIA(partido, scoreData) {
  console.log(`      🤖 [IA START] Consultando: "${partido.seleccion}" en ${scoreData.home_team} vs ${scoreData.away_team} (${scoreData.marcador})`);
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ 
        role: 'user', 
        content: `Juez de apuestas.
          Partido: ${scoreData.home_team} vs ${scoreData.away_team}
          Marcador Final: ${scoreData.marcador}
          Apuesta: "${partido.seleccion}"
          
          Responde SOLO: "WON", "LOST" o "VOID".` 
      }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0
    });
    
    const res = completion.choices[0].message.content.trim().toUpperCase();
    console.log(`      🤖 [IA END] Respuesta: ${res}`);
    return ['WON', 'LOST', 'VOID'].includes(res) ? res.toLowerCase() : null;
  } catch (e) {
    console.error('      ❌ Error IA:', e.message);
    return null;
  }
}

/**
 * Actualiza el partido y, si es LOST, mata el ticket entero.
 */
async function actualizarSistema(partido, nuevoEstado, marcador) {
  console.log(`      💾 Resultado: ${nuevoEstado.toUpperCase()}`);

  // 1. Actualizar Partido
  const { error } = await supabase
    .from('partidos')
    .update({ estado: nuevoEstado, resultado: marcador })
    .eq('id', partido.id);

  if (error) return console.error('Error update partido:', error);

  // 2. Lógica de "Muerte Súbita" del Ticket
  if (nuevoEstado === 'lost') {
    // Si un partido se pierde, el ticket se pierde INMEDIATAMENTE.
    // Esto activa la optimización: en la próxima ejecución, este ticket ya no será "pending",
    // por lo que sus otros partidos NO se consultarán.
    await supabase
      .from('tickets')
      .update({ estado: 'lost' })
      .eq('id', partido.ticket_id);
      
    console.log(`      💀 Ticket #${partido.ticket_id} marcado como LOST (Optimización activada).`);
  } 
  else {
    // Si ganó, verificamos si completó el ticket
    verificarVictoriaTicket(partido.ticket_id);
  }
}

async function verificarVictoriaTicket(ticketId) {
  // Buscamos si quedan partidos pendientes o perdidos en este ticket
  const { data: partidos } = await supabase
    .from('partidos')
    .select('estado')
    .eq('ticket_id', ticketId);

  if (!partidos) return;

  const algunPendiente = partidos.some(p => p.estado === 'pending');
  const algunPerdido = partidos.some(p => p.estado === 'lost');

  if (algunPerdido) {
    // Ya debería estar marcado como lost, pero por si acaso
    await supabase.from('tickets').update({ estado: 'lost' }).eq('id', ticketId);
  } else if (!algunPendiente) {
    // Si no hay pendientes y no hay perdidos -> WON
    await supabase.from('tickets').update({ estado: 'won' }).eq('id', ticketId);
    console.log(`      🎉 Ticket #${ticketId} completado: WON!`);
  }
}

async function main() {
  try {
    const partidos = await obtenerPartidosPrioritarios();
    if (partidos.length === 0) {
      console.log('💤 Todo al día. Esperando nuevos partidos terminados...');
      return;
    }

    const scoresMap = await obtenerScoresTargeted(partidos);
    await procesarPartidos(partidos, scoresMap);
    
    console.log('⚡ Ciclo de revisión finalizado.');
  } catch (error) {
    console.error('Fatal:', error);
  }
}

main();
