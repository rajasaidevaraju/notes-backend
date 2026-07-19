import dotenv from 'dotenv';
dotenv.config();

// Fail fast if the hidden-notes PIN is missing or malformed. The UI expects a
// 4-character PIN, and an absent value would otherwise let auth checks that
// compare against `undefined` fail open. Runs before controllers read the env.
const hiddenNotesPin = process.env.HIDDEN_NOTES_PIN;
if (!hiddenNotesPin || hiddenNotesPin.length !== 4) {
  throw new Error(
    'HIDDEN_NOTES_PIN must be set to a 4-character value. Refusing to start.'
  );
}

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase, dbGet, dbRun } from './database';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});


import { lanGuard } from './middleware/lanGuard';
import api from './routes';

import { NoteService } from './services/noteService';

const app = express();
const port = process.env.PORT || 3002;


app.set('trust proxy', false);
// Allow room for the largest note (LIMITS.NOTE_CONTENT) plus JSON overhead;
// the default 100kb would 413 a max-size note before per-field validation runs.
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
//app.use(delayMiddleware); 

app.use(lanGuard);

import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

app.use('/api', api);

if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.join(__dirname, '../../notes-frontend/out');
  app.use(express.static(frontendDir, {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
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
  const frontendProxy = createProxyMiddleware({
    target: 'http://localhost:3003',
    changeOrigin: true,
    ws: true,
  });
  app.use(frontendProxy);
}


const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);

  initializeDatabase(async (err: Error | null) => {
    if (err) {
      return console.error('Database initialization failed:', err.message);
    }

    await NoteService.initializeClipboardNote();
  });
});
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
