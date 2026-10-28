// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Isla del buscador: combobox accesible sobre public/data/indice.json (se descarga al primer uso).
// Busca por nombre (primero los que empiezan con el texto, después los que lo contienen) y por criador.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { navigate } from 'astro:transitions/client';
import { TIPO_TXT, nf, norm, type Resumen } from '../lib/datos.ts';
import { cargarIndice } from '../lib/navegacion.ts';
import { swatchCSS } from '../lib/bud.ts';

const MAX = 30;
interface Entrada extends Resumen { n: string; c: string }

function buscar(variedades: Entrada[], texto: string): Entrada[] {
  const t = norm(texto.trim());
  if (!t) return [];
  const empieza: Entrada[] = [], contiene: Entrada[] = [], criador: Entrada[] = [];
  for (const v of variedades) {
    if (v.n.startsWith(t)) empieza.push(v);
    else if (v.n.includes(t)) contiene.push(v);
    else if (v.c.includes(t)) criador.push(v);
    if (empieza.length >= MAX) break;
  }
  return [...empieza, ...contiene, ...criador];
}

export default function Buscador() {
  const [variedades, setVariedades] = useState<Entrada[] | null>(null);
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');   // el texto con un respiro de 80 ms (no busca en cada tecla)
  const [abierta, setAbierta] = useState(false);
  const [activo, setActivo] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  const hallados = useMemo(() => (variedades ? buscar(variedades, consulta) : []), [variedades, consulta]);
  const visibles = hallados.slice(0, MAX);

  const cargar = (): void => {
    if (variedades) return;
    void cargarIndice().then((vs) => setVariedades(vs.map((v) => ({ ...v, n: norm(v.nombre), c: v.criador ? norm(v.criador) : '' }))));
  };
  const hero = (): HTMLElement | null => document.getElementById('hero');
  const cerrar = (): void => { setAbierta(false); setActivo(-1); };
  const elegir = (slug: string): void => {
    cerrar(); setTexto(''); setConsulta('');
    input.current?.blur();
    hero()?.classList.remove('searching');
    void navigate(`${import.meta.env.BASE_URL}v/${slug}/`);
  };

  useEffect(() => {
    const t = setTimeout(() => { setConsulta(texto); setActivo(0); setAbierta(texto.trim() !== ''); }, 80);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => { if (activo >= 0) document.getElementById(`r${activo}`)?.scrollIntoView({ block: 'nearest' }); }, [activo]);

  // Celular: la lupa del encabezado (fuera de la isla) abre el modo búsqueda; Escape lo cierra
  useEffect(() => {
    const lupa = document.getElementById('mSearch');
    const abrir = (): void => { hero()?.classList.add('searching'); cargar(); input.current?.focus(); };
    const escape = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && hero()?.classList.contains('searching')) hero()?.classList.remove('searching');
    };
    lupa?.addEventListener('click', abrir);
    document.addEventListener('keydown', escape);
    return () => { lupa?.removeEventListener('click', abrir); document.removeEventListener('keydown', escape); };
  }, [variedades]);

  const teclas = (e: KeyboardEvent<HTMLInputElement>): void => {
    const n = visibles.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); setAbierta(true); setActivo((a) => (a + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); setAbierta(true); setActivo((a) => (a - 1 + n) % n); }
    else if (e.key === 'Enter' && abierta && activo >= 0 && visibles[activo]) { e.preventDefault(); elegir(visibles[activo].id); }
    else if (e.key === 'Escape' && abierta) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); cerrar(); }
  };

  const total = hallados.length;
  const meta = !variedades ? 'Cargando el catálogo…'
    : total ? (total > MAX ? `Mostrando ${MAX} de ${nf.format(total)}+ resultados` : `${total} resultado${total > 1 ? 's' : ''}`) : 'Sin resultados';
  const mostrar = abierta && texto.trim() !== '';

  return (
    <>
      <label className="search">
        <svg className="ic"><use href="#i-search" /></svg>
        <input ref={input} id="q" type="search" placeholder="Buscar variedad o criador…" autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={mostrar} aria-controls="results" aria-autocomplete="list" aria-label="Buscar variedad o criador"
          aria-activedescendant={mostrar && activo >= 0 ? `r${activo}` : undefined}
          value={texto} onFocus={cargar} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas}
          onBlur={() => setTimeout(cerrar, 120)} />
      </label>
      <button className="ibtn sclose" type="button" aria-label="Cerrar búsqueda"
        onClick={() => { hero()?.classList.remove('searching'); cerrar(); }}>
        <svg className="ic"><use href="#i-x" /></svg>
      </button>
      <ul className="results" id="results" role="listbox" aria-label="Resultados" hidden={!mostrar}
        onMouseDown={(e) => e.preventDefault() /* que el campo no pierda el foco antes del clic */}>
        {visibles.map((v, i) => (
          <li key={v.id} role="option" id={`r${i}`} aria-selected={i === activo} onClick={() => elegir(v.id)}>
            <span className="swatch" style={{ background: swatchCSS(v) }}></span>
            <span><b>{v.nombre}</b><small>{v.criador ?? 'Criador sin registrar'}</small></span>
            <span className="rtipo">{v.tipo ? <><i className={`marca ${v.tipo}`} aria-hidden="true"></i>{TIPO_TXT[v.tipo]}</> : 'Sin tipo'}</span>
          </li>
        ))}
        <li className="rmeta" role="presentation">{meta}</li>
      </ul>
    </>
  );
}
