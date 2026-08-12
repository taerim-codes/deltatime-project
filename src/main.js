import './styles/base.css';
import './styles/stack.css';
import './styles/detail.css';

import { renderStack } from './stack.js';
import { initDetail, openBook } from './detail.js';

renderStack(openBook);
initDetail();
