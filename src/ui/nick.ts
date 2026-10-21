// The name a player shows on the online ranking, chosen by them.

import { cleanNick } from '../meta/leaderboard';
import type { App } from './app';
import { h } from './dom';
import { icon } from './icons';

/** Text field to choose the nickname: saved as you type (2 to 16 characters). */
export function nickField(app: App, onSaved?: () => void): HTMLElement {
  const p = app.profile;
  const input = h('input.nick', {
    type: 'text',
    maxlength: '16',
    placeholder: 'Escribe tu apodo',
    autocomplete: 'nickname',
    value: p.climb.nick,
  }) as HTMLInputElement;
  const note = h('span.nick-note');
  const show = () => {
    note.replaceChildren(
      ...(p.climb.nick ? [icon('check', 13), ` Te verán como «${p.climb.nick}»`] : [icon('info', 13), ' Sin apodo apareces como «Defensor anónimo»']),
    );
  };
  let timer = 0;
  input.oninput = () => {
    const nick = cleanNick(input.value);
    clearTimeout(timer);
    if (nick.length === 1) {
      note.replaceChildren(icon('info', 13), ' Al menos 2 letras');
      return;
    }
    timer = window.setTimeout(() => {
      p.climb.nick = nick;
      app.save();
      show();
      onSaved?.();
    }, 700);
  };
  show();
  return h('label.nick-row', h('span.nick-label', icon('crown', 15), 'Tu apodo en la clasificación'), input, note);
}
