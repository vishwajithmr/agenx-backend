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
        url: 'http://localhost:9000',
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
      schemas: {
        CreateReviewRequest: {
          type: 'object',
          required: ['rating', 'content'],
          properties: {
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1 to 5 stars'
            },
            content: {
              type: 'string',
              minLength: 10,
              maxLength: 2000,
              description: 'Review content'
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
                description: 'Image URL or Base64 encoded image'
              },
              maxItems: 5,
              description: 'Optional images to include with the review'
            }
          }
        },
        UpdateReviewRequest: {
          type: 'object',
          required: ['rating', 'content'],
          properties: {
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1 to 5 stars'
            },
            content: {
              type: 'string',
              minLength: 10,
              maxLength: 2000,
              description: 'Review content'
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
                description: 'Image URL or Base64 encoded image'
              },
              maxItems: 5,
              description: 'Optional images to include with the review'
            }
          }
        },
        CreateReplyRequest: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: 10,
              maxLength: 1000,
              description: 'Reply content'
            }
          }
        },
        VoteRequest: {
          type: 'object',
          required: ['vote'],
          properties: {
            vote: {
              type: 'integer',
              enum: [-1, 0, 1],
              description: '1 for upvote, -1 for downvote, 0 for removing vote'
            }
          }
        },
        ReviewResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            author: { 
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                avatar: { type: 'string', nullable: true },
                isVerified: { type: 'boolean' },
                isCurrentUser: { type: 'boolean' },
                isOfficial: { type: 'boolean', nullable: true }
              }
            },
            rating: { type: 'integer' },
            date: { type: 'string', format: 'date-time' },
            formattedDate: { type: 'string' },
            content: { type: 'string' },
            replies: { 
              type: 'array',
              items: { $ref: '#/components/schemas/ReviewReplyResponse' }
            },
            replyCount: { type: 'integer' },
            helpful: { 
              type: 'object',
              properties: {
                upvotes: { type: 'integer' },
                downvotes: { type: 'integer' },
                userVote: { type: 'integer' }
              }
            },
            additionalImages: { 
              type: 'array',
              items: { $ref: '#/components/schemas/ReviewImageResponse' }
            }
          }
        },
        ReviewReplyResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            author: { $ref: '#/components/schemas/ReviewAuthor' },
            date: { type: 'string', format: 'date-time' },
            formattedDate: { type: 'string' },
            content: { type: 'string' }
          }
        },
        ReviewImageResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            thumbnailUrl: { type: 'string' },
            alt: { type: 'string', nullable: true }
          }
        },
        ReviewAuthor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            avatar: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            isCurrentUser: { type: 'boolean' },
            isOfficial: { type: 'boolean', nullable: true }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts'],
};

export const setupSwagger = () => {
  return swaggerJsdoc(options);
};

export { swaggerUi };
