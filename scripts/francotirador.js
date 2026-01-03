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
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY; // Necesitamos esta key también

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_API_KEY || !TAVILY_API_KEY || !ODDS_API_KEY) {
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

/**
 * Helper: Obtener Scores Oficiales de The Odds API (Dinámico)
 */
async function obtenerScoresOficiales(tickets) {
  console.log('📡 Consultando resultados oficiales en The Odds API...');
  let scoresMap = {}; 

  // 1. Extraer ligas únicas de los tickets pendientes
  const ligasRaw = new Set();
  tickets.forEach(t => {
    t.partidos.forEach(p => {
      if (p.deporte) ligasRaw.add(p.deporte);
    });
  });

  // 2. Mapear a keys de API
  const keysApi = [...new Set([...ligasRaw].map(nombre => MAPA_LIGAS[nombre] || nombre))];
  
  if (keysApi.length === 0) {
    console.log('   ⚠️ No se detectaron ligas conocidas en los tickets.');
    return {};
  }

  console.log(`   🎯 Ligas a consultar: ${keysApi.join(', ')}`);

  for (const ligaKey of keysApi) {
    try {
      // Pedimos scores de los últimos 3 días
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${ligaKey}/scores`, {
        params: {
          apiKey: ODDS_API_KEY,
          daysFrom: 3,
          dateFormat: 'iso'
        }
      });

      response.data.forEach(game => {
        // Guardamos info del partido, esté terminado o no (para tener contexto)
        const key = `${game.home_team} vs ${game.away_team}`;
        
        if (game.scores || !game.completed) {
          const homeScore = game.scores?.find(s => s.name === game.home_team)?.score || 0;
          const awayScore = game.scores?.find(s => s.name === game.away_team)?.score || 0;
          
          scoresMap[key] = {
            marcador: `${homeScore}-${awayScore}`,
            estado: game.completed ? 'Finalizado' : 'En Juego/Pendiente',
            ganador: parseInt(homeScore) > parseInt(awayScore) ? game.home_team : (parseInt(awayScore) > parseInt(homeScore) ? game.away_team : 'Empate')
          };
        }
      });
    } catch (error) {
      console.warn(`   ⚠️ Error obteniendo scores de ${ligaKey}:`, error.message);
    }
  }
  
  console.log(`   ✅ Scores oficiales cargados: ${Object.keys(scoresMap).length} partidos encontrados.`);
  return scoresMap;
}

/**
 * Paso 1: Obtener Tickets con Partidos Pendientes (Incluso si el ticket ya finalizó)
 */
async function obtenerTicketsPendientes() {
  console.log('🔍 Buscando tickets con partidos pendientes...');
  
  // Traemos tickets de los últimos 3 días (para cubrir ayer y hoy)
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 3);
  const fechaStr = fechaLimite.toISOString().split('T')[0];

  // Traemos TODO lo reciente, no solo lo 'pending'
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*, partidos(*)')
    .gte('fecha', fechaStr);

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  const now = new Date();
  
  const ticketsProcesables = tickets.filter(t => {
    // Si no tiene partidos, lo ignoramos
    if (!t.partidos || t.partidos.length === 0) return false;

    // CRITERIO CLAVE: ¿Tiene algún partido individual en 'pending'?
    const tienePartidosPendientes = t.partidos.some(p => p.estado === 'pending');
    if (!tienePartidosPendientes) return false;

    // Verificamos si el último partido del ticket ya debió terminar
    const horasPartidos = t.partidos.map(p => new Date(p.hora).getTime());
    const ultimaHora = Math.max(...horasPartidos);
    const tresHorasDespues = ultimaHora + (3 * 60 * 60 * 1000);
    
    return now.getTime() > tresHorasDespues;
  });

  console.log(`📋 Encontrados ${ticketsProcesables.length} tickets con partidos por verificar.`);
  return ticketsProcesables;
}

/**
 * Paso 2: Investigar Resultados (Híbrido: Odds API + Tavily)
 */
async function investigarResultados(ticket, scoresOficiales) {
  let evidencia = "RESULTADOS OFICIALES (PRIORIDAD MÁXIMA):\n";
  let faltanDatos = false;

  // 1. Buscar en Scores Oficiales primero
  ticket.partidos.forEach(p => {
    // Intentamos match exacto "Local vs Visitante"
    // Nota: En DB guardamos "Local vs Visitante", así que debería coincidir
    const infoOficial = scoresOficiales[p.partido];
    
    if (infoOficial) {
      evidencia += `- ${p.partido}: ${infoOficial.marcador} (Estado: ${infoOficial.estado})\n`;
    } else {
      evidencia += `- ${p.partido}: NO ENCONTRADO EN API OFICIAL.\n`;
      faltanDatos = true;
    }
  });

  // 2. Si faltan datos, complementar con Tavily
  if (faltanDatos) {
    console.log(`   🕵️ Faltan datos oficiales. Complementando con Tavily para Ticket #${ticket.id}...`);
    const partidosStr = ticket.partidos.map(p => `${p.partido} (${p.deporte})`).join(', ');
    const query = `Resultados finales exactos: ${partidosStr}. Fecha: ${ticket.fecha}.`;
    
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic", 
        include_answer: true,
        max_results: 3
      });
      
      const tavilyInfo = response.data.answer || response.data.results.map(r => r.content).join('\n');
      evidencia += `\nRESULTADOS WEB (SECUNDARIO):\n${tavilyInfo}`;
    } catch (error) {
      console.warn(`   ⚠️ Error Tavily:`, error.message);
    }
  }

  return evidencia;
}

/**
 * Paso 3: Analizar con IA (El Francotirador)
 */
async function analizarTicketConIA(ticket, contextoBusqueda) {
  console.log(`   🧠 Analizando Ticket #${ticket.id} con IA...`);

  const partidosInfo = ticket.partidos.map(p => ({
    id: p.id,
    partido: p.partido,
    seleccion: p.seleccion,
    liga: p.deporte
  }));

  const prompt = `
    Eres el FRANCOTIRADOR DE APUESTAS, un auditor implacable.
    Tu trabajo es verificar si las apuestas se ganaron o perdieron basándote en los resultados encontrados.

    ────────────────────────
    INFORMACIÓN DEL TICKET
    ────────────────────────
    ${JSON.stringify(partidosInfo, null, 2)}

    ────────────────────────
    RESULTADOS DE BÚSQUEDA (EVIDENCIA)
    ────────────────────────
    ${contextoBusqueda}

    ────────────────────────
    INSTRUCCIONES
    ────────────────────────
    1. Para CADA partido, busca su marcador final en la evidencia.
    2. Compara la "seleccion" con el resultado real.
       - Ejemplo: Si selección es "Over 2.5" y quedaron 2-1 (Total 3), es WON.
       - Ejemplo: Si selección es "Real Madrid" y quedaron 1-1, es LOST.
    3. Si NO encuentras el resultado de un partido (o no se jugó), marca estado como "PENDING".
    4. IMPORTANTE: Debes devolver el resultado de TODOS los partidos del ticket.
    5. PROHIBIDO usar "Unknown" como estado. Usa "PENDING" si no sabes.
    6. Si el partido ya pasó hace mucho y no hay info, asume que la búsqueda falló y pon "PENDING" para reintentar luego, o busca pistas de cancelación.

    ────────────────────────
    FORMATO JSON DE SALIDA
    ────────────────────────
    Devuelve SOLO un JSON con este formato:
    {
      "analisis_global": "Breve resumen de lo que pasó en el ticket",
      "partidos_actualizados": [
        {
          "id": 123, (Mismo ID que en la entrada)
          "marcador_final": "2-1", (O "Postponed", "Sin Info")
          "estado": "WON" | "LOST" | "PENDING" | "VOID"
        }
      ]
    }
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0, // Temperatura 0 para máxima precisión
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0].message.content;
    console.log(`   🤖 [IA Output]: ${rawContent}`); // Log completo para debug
    return JSON.parse(rawContent);
  } catch (error) {
    console.error('Error en análisis de IA:', error);
    return null;
  }
}

/**
 * Paso 4: Actualizar Base de Datos
 */
async function actualizarBaseDeDatos(ticket, resultadoIA) {
  if (!resultadoIA || !resultadoIA.partidos_actualizados) return;

  console.log(`   💾 Actualizando DB para Ticket #${ticket.id}...`);

  let todosGanados = true;
  let algunoPerdido = false;
  let algunoPendiente = false;

  // 1. Actualizar cada partido
  for (const pUpdate of resultadoIA.partidos_actualizados) {
    console.log(`      > Partido ${pUpdate.id}: ${pUpdate.estado} (${pUpdate.marcador_final})`);
    
    // Actualizamos estado y marcador en la tabla partidos
    const { error } = await supabase
      .from('partidos')
      .update({
        estado: pUpdate.estado.toLowerCase(), // won, lost, pending
        resultado: pUpdate.marcador_final
      })
      .eq('id', pUpdate.id);

    if (error) console.error(`Error actualizando partido ${pUpdate.id}:`, error);

    // Lógica para estado global del ticket
    if (pUpdate.estado === 'LOST') algunoPerdido = true;
    if (pUpdate.estado === 'PENDING') algunoPendiente = true;
    if (pUpdate.estado !== 'WON' && pUpdate.estado !== 'VOID') todosGanados = false;
  }

  // 2. Determinar estado del Ticket
  let nuevoEstadoTicket = 'pending';
  
  if (algunoPerdido) {
    nuevoEstadoTicket = 'lost'; // Si uno pierde, el ticket pierde (Parlay)
  } else if (todosGanados && !algunoPendiente) {
    nuevoEstadoTicket = 'won'; // Todos ganados (o void) y ninguno pendiente
  } else {
    nuevoEstadoTicket = 'pending'; // Aún falta info
  }

  // Solo actualizamos el ticket si cambia de estado o si queremos guardar el log
  if (nuevoEstadoTicket !== ticket.estado) {
    const { error: tError } = await supabase
      .from('tickets')
      .update({
        estado: nuevoEstadoTicket
      })
      .eq('id', ticket.id);
      
    if (tError) console.error('Error actualizando ticket:', tError);
    else console.log(`   ✅ Ticket #${ticket.id} actualizado a: ${nuevoEstadoTicket.toUpperCase()}`);
  } else {
    console.log(`   ℹ️ Ticket #${ticket.id} se mantiene en: ${nuevoEstadoTicket.toUpperCase()}`);
  }
}

async function main() {
  try {
    // 1. Obtener Tickets PRIMERO para saber qué ligas consultar
    const tickets = await obtenerTicketsPendientes();
    
    if (tickets.length === 0) {
      console.log('😴 No hay tickets pendientes para verificar.');
      return;
    }

    // 2. Cargar Scores Oficiales (Basado en los tickets encontrados)
    const scoresOficiales = await obtenerScoresOficiales(tickets);

    for (const ticket of tickets) {
      // Pausa pequeña
      await new Promise(r => setTimeout(r, 500));

      // Pasamos los scores oficiales a la investigación
      const contexto = await investigarResultados(ticket, scoresOficiales);
      
      const analisis = await analizarTicketConIA(ticket, contexto);
      if (analisis) {
        await actualizarBaseDeDatos(ticket, analisis);
      }
    }
    
    console.log('🏁 Francotirador finalizó su ronda.');

  } catch (error) {
    console.error('Fatal:', error);
  }
}

main();
