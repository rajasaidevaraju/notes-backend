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

import { requestGuard } from './middleware/requestGuard';
import { lanGuard } from './middleware/lanGuard';
import { errorHandler } from './middleware/errorHandler';
import api from './routes';

import * as NoteService from './services/note';

const app = express();
const port = process.env.PORT || 3002;


app.set('trust proxy', false);

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.use(requestGuard);
app.use(lanGuard);

import path from 'path';
import { devProxy, devProxyUpgrade } from './middleware/devProxy';

app.use('/api', api);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

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

// Schema first: serving requests against a missing or half-migrated schema
// only produces confusing 500s, so a failure here stops the process.
try {
  initializeDatabase();
  NoteService.initializeClipboardNote();
} catch (err) {
  console.error('Database initialization failed; refusing to start:', err);
  closeDatabase();
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
if (process.env.NODE_ENV !== 'production') {
  // Vite's HMR websocket: upgrades bypass the express middleware stack.
  server.on('upgrade', devProxyUpgrade);
}

server.on('error', (err) => {
  console.error('Server failed to start:', err);

  if (!server.listening) process.exit(1);
});

function closeDatabase(): void {
  try {
    if (db.open) {
      db.pragma('optimize');
      db.close();
    }
    console.log('sqlite database connection closed.');
  } catch (err: any) {
    console.error('Error closing sqlite database:', err.message);
  }
}

let shuttingDown = false;

/**
 * Stops accepting connections, lets in-flight requests finish, then closes
 * the database. A stuck keep-alive socket can't hold the exit hostage: the
 * timer forces it after a few seconds.
 */
function shutdown(reason: string, exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${reason}: shutting down...`);

  setTimeout(() => {
    console.error('Shutdown timed out; forcing exit.');
    closeDatabase();
    process.exit(exitCode);
  }, 5000).unref();

  server.close(() => {
    closeDatabase();
    process.exit(exitCode);
  });
  server.closeIdleConnections();
}

process.on('SIGINT', () => shutdown('SIGINT', 0));
// PM2 and most process managers stop a process with SIGTERM
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

// After an uncaught error the process is in an unknown state; carrying on
// risks serving bad data. Log it and exit so the process manager restarts us.
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection', 1);
});
