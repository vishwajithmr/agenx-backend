import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Agent Marketplace API',
      version: '1.0.0',
      description: 'API documentation for the AI agent marketplace',
    },
    servers: [
      {
        url: 'http://localhost:9000/api',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

const specs = swaggerJsdoc(options);

export const serve = swaggerUi.serve;
export const setup = swaggerUi.setup(specs);
