import { fixtureApp } from './fixtures/library.js';
fixtureApp().listen(4010, '127.0.0.1', () =>
  console.log('Synthetic preview API listening on 4010; no database writes.'),
);
