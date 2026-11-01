import express from 'express';
import cors from 'cors';
import { corsOptions } from './cors.js';
import { securityHeaders } from './securityHeadersService.js';
import { globalLimiter } from './rateLimiter.js';
import { inputSanitize } from './inputSanitize.js';
import { maintenanceMode } from './maintenanceModeService.js';
import healthRouter from './health.js';
import { notFound, errorHandler } from './errorHandler.js';

const app = express();

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use(healthRouter);
app.use(maintenanceMode);
app.use(globalLimiter);
app.use(inputSanitize);
app.use(notFound);
app.use(errorHandler);

export default app;
