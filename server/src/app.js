const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { globalLimiter } = require('./middleware/rateLimiter');
const mongoSanitize = require('./middleware/mongoSanitize');
const xssSanitizer = require('./middleware/xss');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');
const apiV1Router = require('./routes/api.v1');
const { redirectUrl } = require('./controllers/urlController');
const healthController = require('./controllers/healthController');

const app = express();

// Trust proxy settings (essential for correct IP geo-location logging behind Nginx/load balancers)
app.set('trust proxy', true);

// 1. Helmet Security Headers
app.use(helmet());

// 2. CORS Configuration (supports fallback and multiple origins)
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 3. Request parsing Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// 4. NoSQL Query Injection Protection
app.use(mongoSanitize);

// 5. XSS Sanitization Protection
app.use(xssSanitizer);

// 6. Rate Limiting Middlewares (Global API Limiter)
app.use('/api/v1', globalLimiter);

// HTTP Request Logging Middleware (Morgan integrated with Winston)
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Public Health Check Endpoint
app.get('/health', healthController.getHealth);

// API Routes
app.use('/api/v1', apiV1Router);

// Short URL redirection route (handles both short codes and custom aliases)
app.get('/:shortCode', redirectUrl);

// Fallback 404 handler
app.all('*splat', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;

