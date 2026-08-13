import './styles/base.css';
import './styles/stack.css';
import './styles/detail.css';

import { renderStack } from './stack.js';
import { initDetail, openBook, setPresenter } from './detail.js';
import { initRelay } from './relay.js';
import { initTimeDial } from './timedial.js';

renderStack(openBook);
initDetail();
initRelay();
initTimeDial();

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  import('./gl/glapp.js')
    .then(({ initGL }) => initGL())
    .then(gl => {
      if (gl) {
        setPresenter(gl);
        document.body.classList.add('gl');
      }
    })
    .catch(() => {});
}
