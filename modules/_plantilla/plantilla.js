/* modules/_plantilla/plantilla.js
   Lógica del módulo. Aquí va todo el HTML, CSS y JS del módulo.
   El módulo recibe un `container` y lo llena completamente.
   No toca nada fuera de `container` excepto TTS y Telemetry.
*/

import { TTS }      from '../../core/tts.js';
import { Telemetry } from '../../core/telemetry.js';
import { cfg }       from '../../core/config.js';

let _el = null; // referencia al container

export async function init(container) {
  _el = container;
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:16px;overflow:hidden;';

  _el.innerHTML = `
    <style>
      /* Estilos locales del módulo — usa var(--t-*) del tema */
      #plantilla-titulo {
        font-family: 'Outfit', sans-serif;
        font-size: clamp(2rem, 6vw, 4rem);
        font-weight: 900; color: white; text-align: center;
      }
      #plantilla-btn {
        padding: 16px 32px; border-radius: 99px; border: none; cursor: pointer;
        background: var(--t-primary, #0ea5c9); color: white;
        font-family: inherit; font-weight: 900; font-size: 1.1rem;
        transition: transform .12s;
      }
      #plantilla-btn:active { transform: scale(.94); }
    </style>

    <div id="plantilla-titulo">¡Hola desde el módulo!</div>

    <button id="plantilla-btn">
      🔊 Escuchar
    </button>
  `;

  // Eventos
  _el.querySelector('#plantilla-btn').addEventListener('click', () => {
    TTS.speak('Hola mundo', { lang: cfg('tts.lang', 'es-MX') });
    Telemetry.track('boton_presionado', { _modulo: 'plantilla' });
  });

  // Reaccionar al cambio de idioma del pill
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  TTS.stop();
  _el = null;
}

export function onEnter() {
  // Se llama cada vez que el módulo se hace visible
}

export function onLeave() {
  TTS.stop();
}

function _onLangChange(e) {
  // Reaccionar al cambio ES/EN desde el pill del header
  const lang = e.detail.lang;
  console.log('[Plantilla] idioma cambió a', lang);
}