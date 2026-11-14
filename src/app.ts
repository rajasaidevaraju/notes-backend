import { env } from './config/env';

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase } from './database';

import { requestGuard } from './middleware/requestGuard';
import { lanGuard } from './middleware/lanGuard';
import { errorHandler } from './middleware/errorHandler';
import { startServer } from './server';
import api from './routes';

import * as NoteService from './services/note';

const app = express();

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

if (env.isProduction) {
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

app.use(errorHandler);

try {
  initializeDatabase();
  NoteService.initializeClipboardNote();
} catch (err) {
  console.error('Database initialization failed; refusing to start:', err);
  closeDatabase();
  process.exit(1);
}

let server: ReturnType<typeof startServer>;
try {
  server = startServer(app, {
    port: env.port,
    tls: env.tls,
    // WebSocket upgrades (Vite HMR) bypass the express middleware stack.
    onUpgrade: env.isProduction ? undefined : devProxyUpgrade,
    onError: (err) => {
      console.error('Server error:', err);
      shutdown('server error', 1);
    },
  });
} catch (err) {
  console.error('Server failed to start:', err);
  closeDatabase();
  process.exit(1);
}

function closeDatabase(): void {
  try {
    if (db.isOpen) {
      db.exec('PRAGMA optimize');
      db.close();
    }
    console.log('sqlite database connection closed.');
  } catch (err: any) {
    console.error('Error closing sqlite database:', err.message);
  }
}

let shuttingDown = false;

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
}

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection', 1);
});
