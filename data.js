/**
 * data.js — Base de datos de precios para ML Pedidos POS
 * Contiene los precios por institución, categoría, prenda y talla.
 *
 * Estructura de cada producto:
 *   id: identificador único
 *   nombre: nombre de la prenda
 *   categoria: 'diario' | 'deportivo' | 'kit' | 'gala'
 *   genero: 'mixto' | 'masc' | 'feme'  (cuando hay diferencia por género)
 *   tallas: { 'Talla 2-6': precio, 'Talla 8-12': precio, ... }
 */

const INSTITUCIONES = [
  {
    id: 'abedul',
    nombre: 'Abedul de la Sabiduria',
    color: '#7B1929',
    productos: [
      // ── KIT DE UNIFORMES ────────────────────────────────────────────
      {
        id: 'abedul_kit_2_6',
        nombre: 'Kit Completo',
        categoria: 'kit',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 297000,
          'Talla 8-12 Masc': 315000,
          'Talla 8-12 Feme': 320000,
          'Talla 14-16 Masc': 330000,
          'Talla 14-16 Feme': 334000,
        }
      },
      // ── UNIFORME DIARIO ─────────────────────────────────────────────
      {
        id: 'abedul_diario_kit',
        nombre: 'Kit Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 118000,
          'Talla 8-12 Masc': 123000,
          'Talla 8-12 Feme': 128000,
          'Talla 14-16 Masc': 128000,
          'Talla 14-16 Feme': 132000,
        }
      },
      {
        id: 'abedul_camisa_diario',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 62000,
          'Talla 8-12': 64000,
          'Talla 14-16': 66000,
        }
      },
      {
        id: 'abedul_pantalon_diario',
        nombre: 'Pantalón Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 56000,
          'Talla 8-12': 59000,
          'Talla 14-16': 62000,
        }
      },
      {
        id: 'abedul_jardinera_diario',
        nombre: 'Jardinera / Falda Diario',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 56000,
          'Talla 8-12': 64000,
          'Talla 14-16': 66000,
        }
      },
      // ── UNIFORME DEPORTIVO ──────────────────────────────────────────
      {
        id: 'abedul_kit_deportivo',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 118000,
          'Talla 8-12': 128000,
          'Talla 14-16': 136000,
        }
      },
      {
        id: 'abedul_sueter_dep',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 68000,
        }
      },
      {
        id: 'abedul_sudadera_dep',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 68000,
        }
      },
      // ── CAMISA DE GALA ──────────────────────────────────────────────
      {
        id: 'abedul_camisa_gala',
        nombre: 'Camisa de Gala',
        categoria: 'gala',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 61000,
          'Talla 8-12': 64000,
          'Talla 14-16': 66000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'dc',
    nombre: 'Descubriendo Conocimientos',
    color: '#7B1929',
    productos: [
      // ── KIT ─────────────────────────────────────────────────────────
      {
        id: 'dc_kit',
        nombre: 'Kit Completo',
        categoria: 'kit',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 273000,
          'Talla 8-12': 285000,
          'Talla 14-16': 299000,
        }
      },
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'dc_kit_diario',
        nombre: 'Kit Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 113000,
          'Talla 8-12': 117000,
          'Talla 14-16': 123000,
        }
      },
      {
        id: 'dc_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 70000,
          'Talla 14-16': 73000,
        }
      },
      {
        id: 'dc_pantalon_falda',
        nombre: 'Pantalón / Falda Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 45000,
          'Talla 8-12': 47000,
          'Talla 14-16': 50000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'dc_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 101000,
          'Talla 8-12': 107000,
          'Talla 14-16': 112000,
        }
      },
      {
        id: 'dc_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 56000,
          'Talla 8-12': 60000,
          'Talla 14-16': 62000,
        }
      },
      {
        id: 'dc_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 45000,
          'Talla 8-12': 47000,
          'Talla 14-16': 50000,
        }
      },
      // ── GALA ────────────────────────────────────────────────────────
      {
        id: 'dc_gala',
        nombre: 'Camisa de Gala',
        categoria: 'gala',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 61000,
          'Talla 14-16': 64000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'gardner',
    nombre: 'Colegio Gardner',
    color: '#7B1929',
    productos: [
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'gardner_kit_diario',
        nombre: 'Kit Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 186000,
          'Talla 8-12': 198000,
          'Talla 14-16': 212000,
        }
      },
      {
        id: 'gardner_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 70000,
          'Talla 14-16': 75000,
        }
      },
      {
        id: 'gardner_pantalon_jardinera',
        nombre: 'Pantalón / Jardinera Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 70000,
        }
      },
      {
        id: 'gardner_sueter_diario',
        nombre: 'Sueter Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 67000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'gardner_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 109000,
          'Talla 8-12': 118000,
          'Talla 14-16': 125000,
        }
      },
      {
        id: 'gardner_sueter_dep',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 67000,
        }
      },
      {
        id: 'gardner_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 50000,
          'Talla 8-12': 54000,
          'Talla 14-16': 58000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'giv',
    nombre: 'GIV',
    color: '#7B1929',
    productos: [
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'giv_kit_diario_masc',
        nombre: 'Kit Diario Masculino',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 121000,
          'Talla 8-12': 132000,
          'Talla 14-16': 142000,
        }
      },
      {
        id: 'giv_kit_diario_feme',
        nombre: 'Kit Diario Femenino',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 130000,
          'Talla 8-12': 138000,
          'Talla 14-16': 144000,
        }
      },
      {
        id: 'giv_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 62000,
          'Talla 8-12': 68000,
          'Talla 14-16': 72000,
        }
      },
      {
        id: 'giv_pantalon',
        nombre: 'Pantalón Diario',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 59000,
          'Talla 8-12': 64000,
          'Talla 14-16': 70000,
        }
      },
      {
        id: 'giv_falda',
        nombre: 'Falda Diario',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 70000,
          'Talla 14-16': 72000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'giv_kit_dep',
        nombre: 'Kit Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 132000,
          'Talla 8-12': 142000,
          'Talla 14-16': 152000,
        }
      },
      {
        id: 'giv_sueter_dep',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 56000,
          'Talla 8-12': 60000,
          'Talla 14-16': 64000,
        }
      },
      {
        id: 'giv_sudadera_dep',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 51000,
          'Talla 8-12': 54000,
          'Talla 14-16': 58000,
        }
      },
      {
        id: 'giv_pantaloneta',
        nombre: 'Pantaloneta Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 25000,
          'Talla 8-12': 28000,
          'Talla 14-16': 30000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'increart',
    nombre: 'Increart',
    color: '#7B1929',
    productos: [
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'increart_kit_diario_masc',
        nombre: 'Kit Diario Masculino',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 101000,
          'Talla 8-12': 109000,
          'Talla 14-16': 113000,
        }
      },
      {
        id: 'increart_kit_diario_feme',
        nombre: 'Kit Diario Femenino',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 107000,
          'Talla 8-12': 115000,
          'Talla 14-16': 120000,
        }
      },
      {
        id: 'increart_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 56000,
          'Talla 8-12': 62000,
          'Talla 14-16': 64000,
        }
      },
      {
        id: 'increart_pantalon',
        nombre: 'Pantalón Diario',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 45000,
          'Talla 8-12': 47000,
          'Talla 14-16': 49000,
        }
      },
      {
        id: 'increart_jardinera',
        nombre: 'Jardinera / Falda Diario',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 51000,
          'Talla 8-12': 53000,
          'Talla 14-16': 56000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'increart_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 96000,
          'Talla 8-12': 102000,
          'Talla 14-16': 110000,
        }
      },
      {
        id: 'increart_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 51000,
          'Talla 8-12': 56000,
          'Talla 14-16': 59000,
        }
      },
      {
        id: 'increart_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 45000,
          'Talla 8-12': 46000,
          'Talla 14-16': 51000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'juguemos',
    nombre: 'Juguemos a Aprender',
    color: '#7B1929',
    productos: [
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'jug_kit_diario_masc',
        nombre: 'Kit Diario Masculino',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 111000,
          'Talla 8-12': 122000,
          'Talla 14-16': 132000,
        }
      },
      {
        id: 'jug_kit_diario_feme',
        nombre: 'Kit Diario Femenino',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 120000,
          'Talla 8-12': 128000,
          'Talla 14-16': 134000,
        }
      },
      {
        id: 'jug_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 57000,
          'Talla 8-12': 63000,
          'Talla 14-16': 67000,
        }
      },
      {
        id: 'jug_pantalon',
        nombre: 'Pantalón Diario',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 2-6': 54000,
          'Talla 8-12': 59000,
          'Talla 14-16': 65000,
        }
      },
      {
        id: 'jug_falda',
        nombre: 'Falda Diario',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 2-6': 63000,
          'Talla 8-12': 65000,
          'Talla 14-16': 67000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'jug_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 97000,
          'Talla 8-12': 104000,
          'Talla 14-16': 112000,
        }
      },
      {
        id: 'jug_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 51000,
          'Talla 8-12': 55000,
          'Talla 14-16': 59000,
        }
      },
      {
        id: 'jug_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 46000,
          'Talla 8-12': 49000,
          'Talla 14-16': 53000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'megacolegio',
    nombre: 'Megacolegio',
    color: '#7B1929',
    // Nota: Megacolegio usa tallas 4-12, 14-16 y XS-L (adultos)
    productos: [
      // ── DIARIO (precios diferenciales por género) ───────────────────
      {
        id: 'mega_kit_diario_masc',
        nombre: 'Kit Diario Masculino',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 4-12': 90000,
          'Talla 14-16': 96000,
          'Talla XS-L': 102000,
        }
      },
      {
        id: 'mega_kit_diario_feme',
        nombre: 'Kit Diario Femenino',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 4-12': 140000,
          'Talla 14-16': 146000,
          'Talla XS-L': 157000,
        }
      },
      {
        id: 'mega_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 45000,
          'Talla 14-16': 48000,
          'Talla XS-L': 52000,
        }
      },
      {
        id: 'mega_pantalon',
        nombre: 'Pantalón Diario',
        categoria: 'diario',
        genero: 'masc',
        tallas: {
          'Talla 4-12': 45000,
          'Talla 14-16': 48000,
          'Talla XS-L': 50000,
        }
      },
      {
        id: 'mega_jardinera',
        nombre: 'Jardinera / Falda Diario',
        categoria: 'diario',
        genero: 'feme',
        tallas: {
          'Talla 4-12': 95000,
          'Talla 14-16': 98000,
          'Talla XS-L': 105000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'mega_kit_dep_2pzas',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 79000,
          'Talla 14-16': 85000,
          'Talla XS-L': 90000,
        }
      },
      {
        id: 'mega_kit_dep_4pzas',
        nombre: 'Kit Deportivo (4 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 119000,
          'Talla 14-16': 131000,
          'Talla XS-L': 140000,
        }
      },
      {
        id: 'mega_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 41000,
          'Talla 14-16': 43000,
          'Talla XS-L': 45000,
        }
      },
      {
        id: 'mega_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 38000,
          'Talla 14-16': 42000,
          'Talla XS-L': 45000,
        }
      },
      {
        id: 'mega_camisilla',
        nombre: 'Camisilla Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 20000,
          'Talla 14-16': 23000,
          'Talla XS-L': 25000,
        }
      },
      {
        id: 'mega_pantaloneta',
        nombre: 'Pantaloneta Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 4-12': 20000,
          'Talla 14-16': 23000,
          'Talla XS-L': 25000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'mundocolores',
    nombre: 'Mundo de Colores',
    color: '#7B1929',
    productos: [
      // ── KINDER ──────────────────────────────────────────────────────
      {
        id: 'mc_kit_kinder',
        nombre: 'Kit Kinder',
        categoria: 'kit',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 141000,
          'Talla 8-12': 143000,
        }
      },
      {
        id: 'mc_camisa_kinder',
        nombre: 'Camisa Kinder',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 70000,
        }
      },
      {
        id: 'mc_overol_kinder',
        nombre: 'Overol Kinder',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 73000,
          'Talla 8-12': 73000,
        }
      },
      // ── TRANSICION-PRIMARIA ─────────────────────────────────────────
      {
        id: 'mc_kit_primaria',
        nombre: 'Kit Diario Transición-Primaria',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 130000,
          'Talla 8-12': 134000,
          'Talla 14-16': 140000,
        }
      },
      {
        id: 'mc_camisa_primaria',
        nombre: 'Camisa Transición-Primaria',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 70000,
          'Talla 14-16': 72000,
        }
      },
      {
        id: 'mc_pantalon_primaria',
        nombre: 'Pantalón / Falda Transición-Primaria',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 62000,
          'Talla 8-12': 64000,
          'Talla 14-16': 68000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'mc_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 128000,
          'Talla 8-12': 140000,
          'Talla 14-16': 146000,
        }
      },
      {
        id: 'mc_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 64000,
          'Talla 8-12': 70000,
          'Talla 14-16': 73000,
        }
      },
      {
        id: 'mc_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 64000,
          'Talla 8-12': 70000,
          'Talla 14-16': 73000,
        }
      },
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  {
    id: 'peniel',
    nombre: 'Peniel',
    color: '#7B1929',
    productos: [
      // ── DIARIO ──────────────────────────────────────────────────────
      {
        id: 'peniel_kit_diario',
        nombre: 'Kit Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 130000,
          'Talla 8-12': 137000,
          'Talla 14-16': 147000,
        }
      },
      {
        id: 'peniel_camisa',
        nombre: 'Camisa Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 68000,
          'Talla 8-12': 73000,
          'Talla 14-16': 79000,
        }
      },
      {
        id: 'peniel_pantalon_falda',
        nombre: 'Pantalón / Falda Diario',
        categoria: 'diario',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 62000,
          'Talla 8-12': 64000,
          'Talla 14-16': 68000,
        }
      },
      // ── DEPORTIVO ───────────────────────────────────────────────────
      {
        id: 'peniel_kit_dep',
        nombre: 'Kit Deportivo (2 pzas)',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 128000,
          'Talla 8-12': 138000,
          'Talla 14-16': 144000,
        }
      },
      {
        id: 'peniel_sueter',
        nombre: 'Sueter Deportivo',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 64000,
          'Talla 8-12': 69000,
          'Talla 14-16': 72000,
        }
      },
      {
        id: 'peniel_sudadera',
        nombre: 'Sudadera Deportiva',
        categoria: 'deportivo',
        genero: 'mixto',
        tallas: {
          'Talla 2-6': 64000,
          'Talla 8-12': 69000,
          'Talla 14-16': 72000,
        }
      },
    ]
  },
];

/**
 * Formatea un número como precio en pesos colombianos.
 * Ejemplo: 62000 → "$ 62.000"
 * @param {number} valor
 * @returns {string}
 */
function formatearPrecio(valor) {
  return '$ ' + valor.toLocaleString('es-CO');
}

/**
 * Obtiene una institución por su ID.
 * @param {string} id
 * @returns {object|undefined}
 */
function getInstitucion(id) {
  return INSTITUCIONES.find(inst => inst.id === id);
}
