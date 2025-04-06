import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import { setupSwagger } from '../docs/swagger';
import apiRoutes from '../api';
import errorHandler from './middleware/errorHandler';

const app = express();

// Middleware
app.use(helmet());
// Configure CORS to allow requests with credentials
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourproductionsite.com'], // Add your frontend origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Swagger documentation
const swaggerSpec = setupSwagger();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Add YAML endpoint for swagger spec
app.get('/swagger.yaml', (req, res) => {
  const yamlString = yaml.dump(swaggerSpec);
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yamlString);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/', apiRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { 
      code: 'not_found',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
});

export default app;
