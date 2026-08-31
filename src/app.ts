import dotenv from 'dotenv';
dotenv.config();

const hiddenNotesPin = process.env.HIDDEN_NOTES_PIN;
if (!hiddenNotesPin || hiddenNotesPin.length !== 4) {
  throw new Error(
    'HIDDEN_NOTES_PIN must be set to a 4-character value. Refusing to start.'
  );
}

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase } from './database';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});


import { lanGuard } from './middleware/lanGuard';
import { errorHandler } from './middleware/errorHandler';
import api from './routes';

import * as NoteService from './services/note';

const app = express();
const port = process.env.PORT || 3002;


app.set('trust proxy', false);

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.use(lanGuard);

import path from 'path';
import { devProxy, devProxyUpgrade } from './middleware/devProxy';

app.use('/api', api);

if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.join(__dirname, '../../notes-frontend/out');
  app.use(express.static(frontendDir, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
} else {
  app.use(devProxy);
}

// Last: every next(err) and every throw from a handler above lands here.
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);

  initializeDatabase((err: Error | null) => {
    if (err) {
      return console.error('Database initialization failed:', err.message);
    }

    NoteService.initializeClipboardNote();
  });
});
if (process.env.NODE_ENV !== 'production') {
  // Vite's HMR websocket: upgrades bypass the express middleware stack.
  server.on('upgrade', devProxyUpgrade);
}

server.on('error', (err) => {
  console.error('Server failed to start:', err);
});

process.on('SIGINT', () => {
  try {
    db.close();
    console.log('sqlite database connection closed.');
  } catch (err: any) {
    console.error('Error closing sqlite database:', err.message);
  }
  process.exit(0);
});
