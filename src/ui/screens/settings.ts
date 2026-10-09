import { defaultProfile, exportProfileCode, importProfileCode } from '../../meta/profile';
import type { App } from '../app';
import { h } from '../dom';
import { icon } from '../icons';

function toggle(on: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = h('button.switch', { 'aria-pressed': String(on) });
  b.classList.toggle('on', on);
  b.onclick = () => {
    on = !on;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    onChange(on);
  };
  return b;
}

function slider(value: number, onInput: (v: number) => void): HTMLInputElement {
  const s = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)) });
  s.oninput = () => onInput(Number(s.value) / 100);
  return s;
}

const CLOUD_TEXT = {
  connecting: 'Conectando…',
  synced: 'Guardado en tu cuenta',
  saving: 'Guardando…',
  off: 'Solo en este dispositivo',
  error: 'Sin conexión: se guarda aquí y se subirá luego',
} as const;

/** A live label with the cloud-save state (stops listening once removed from the page). */
export function cloudBadge(app: App, extraClass?: string): HTMLElement {
  const el = h('span.cloud-badge', icon('cloud', 16), h('span'));
  if (extraClass) el.classList.add(extraClass);
  let shown = false;
  const stop = app.cloud.onStatus((s) => {
    if (shown && !el.isConnected) return void stop();
    shown = true;
    el.lastElementChild!.textContent = CLOUD_TEXT[s];
    el.dataset.state = s;
  });
  return el;
}

/**
 * Moves progress between devices or between the Claude page and the installed app:
 * a text code to copy here and paste there.
 */
function openTransfer(app: App, host: HTMLElement, mode: 'export' | 'import'): void {
  const area = h('textarea.transfer-code', { rows: 5, spellcheck: false, readOnly: mode === 'export' }) as HTMLTextAreaElement;
  const status = h('div.muted.tiny', { style: 'min-height:16px;margin-top:6px' });
  const close = () => modal.remove();
  let action: HTMLElement;
  if (mode === 'export') {
    area.value = exportProfileCode(app.profile);
    action = h('button.btn.primary', icon('check', 18), 'Copiar');
    action.onclick = async () => {
      area.select();
      try {
        await navigator.clipboard.writeText(area.value);
        status.textContent = 'Copiado. Pégalo en «Pegar código» en el otro dispositivo.';
      } catch {
        // Clipboard blocked (some embedded views): the text is selected for a manual copy.
        document.execCommand?.('copy');
        status.textContent = 'Si no se ha copiado, mantén pulsado el texto y elige «Copiar».';
      }
    };
  } else {
    area.placeholder = 'Pega aquí el código (empieza por BASTION1.)';
    action = h('button.btn.primary', icon('check', 18), 'Cargar progreso');
    action.onclick = () => {
      const p = importProfileCode(area.value);
      if (!p) {
        status.textContent = 'Ese código no es válido.';
        return;
      }
      app.importProfile(p);
      app.sfx('upgrade');
      close();
    };
  }
  const modal = h(
    'div.modal',
    { style: 'z-index:30' },
    h(
      'div.modal-card.panel',
      h('h2', mode === 'export' ? 'Copiar progreso' : 'Pegar progreso'),
      h(
        'p.muted',
        { style: 'font-size:14px' },
        mode === 'export'
          ? 'Este código contiene todo tu progreso. Cópialo y pégalo en el otro dispositivo o en la app.'
          : 'Pega el código de otro dispositivo. Sustituirá el progreso de aquí.',
      ),
      area,
      status,
      h('div.actions', h('button.btn', { onclick: close }, 'Cerrar'), action),
    ),
  );
  host.appendChild(modal);
  if (mode === 'export') area.select();
}

/** Settings modal; `onClose` lets in-game callers resume. */
export function openSettings(app: App, host: HTMLElement, onClose?: () => void, extra?: HTMLElement[]): HTMLElement {
  const st = app.profile.settings;
  const apply = () => {
    app.audio.setVolumes(st.sfxVolume, st.musicVolume);
    app.save();
  };
  const close = () => {
    app.sfx('click');
    modal.remove();
    onClose?.();
  };
  let confirmReset = false;
  const resetBtn = h('button.btn.small.red', icon('trash', 16), 'Borrar progreso');
  resetBtn.onclick = () => {
    if (!confirmReset) {
      confirmReset = true;
      resetBtn.lastChild!.textContent = '¿Seguro? Pulsa otra vez';
      return;
    }
    app.profile = defaultProfile();
    app.save();
    void app.cloud.flush().finally(() => location.reload());
  };
  const modal = h(
    'div.modal',
    {
      onpointerdown: (e: PointerEvent) => {
        if (e.target === modal) close();
      },
    },
    h(
      'div.modal-card.panel',
      h('h2', 'Ajustes'),
      h(
        'div.settings',
        h(
          'div.setting',
          h('span', { style: 'display:flex;gap:8px;align-items:center' }, icon('sound', 18), 'Efectos'),
          slider(st.sfxVolume, (v) => ((st.sfxVolume = v), apply())),
        ),
        h(
          'div.setting',
          h('span', { style: 'display:flex;gap:8px;align-items:center' }, icon('music', 18), 'Música'),
          slider(st.musicVolume, (v) => ((st.musicVolume = v), apply())),
        ),
        h(
          'div.setting',
          h('span', 'Números de daño'),
          toggle(st.showDamageNumbers, (v) => ((st.showDamageNumbers = v), apply())),
        ),
        h(
          'div.setting',
          h('span', 'Temblor de pantalla'),
          toggle(st.screenShake, (v) => ((st.screenShake = v), apply())),
        ),
        h('div.setting', h('span', 'Progreso'), cloudBadge(app)),
        extra
          ? null
          : h(
              'div.setting',
              h('span.muted.tiny', 'Pasar el progreso a otro dispositivo o a la app'),
              h(
                'span',
                { style: 'display:flex;gap:6px' },
                h('button.btn.small', { onclick: () => openTransfer(app, host, 'export') }, 'Copiar código'),
                h('button.btn.small', { onclick: () => openTransfer(app, host, 'import') }, 'Pegar código'),
              ),
            ),
        h(
          'div.setting',
          h('span.muted.tiny', 'Atajos: 1–0 construir · Espacio oleada · Q/W/E hechizos · U mejorar · S vender · F velocidad · P pausa · C centrar'),
        ),
        ...(extra ?? []),
      ),
      h('div.actions', h('button.btn.primary', { onclick: close }, icon('check', 18), 'Listo'), extra ? null : resetBtn),
    ),
  );
  host.appendChild(modal);
  return modal;
}
