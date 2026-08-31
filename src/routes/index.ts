import express from 'express';

import * as SystemService from '../services/system';
import authRoutes from './auth';
import systemRoutes from './system';
import notesRoutes from './notes';
import checklistsRoutes from './checklists';
import trackersRoutes from './trackers';
import contentRoutes from './content';

const api = express.Router();

api.get('/', (req, res) => {
    res.send('Hello from the Notes API server!');
});

api.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

api.get('/server-ip', (req, res) => {
    res.json({ ip: SystemService.getIpAddress() });
});

api.use('/system', systemRoutes);
api.use('/notes', notesRoutes);
api.use('/checklists', checklistsRoutes);
api.use('/trackers', trackersRoutes);
api.use('/content', contentRoutes);
api.use(authRoutes);

export default api;
