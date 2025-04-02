import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Agent Marketplace API',
      version: '1.0.0',
      description: 'API documentation for the AI agent marketplace',
      contact: {
        name: 'API Support',
        email: 'support@agenx.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:9000',
        description: 'Development server',
      },
      {
        url: 'https://api.agenx.com',
        description: 'Production server',
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and user management endpoints'
      },
      {
        name: 'Agents',
        description: 'Endpoints for managing AI agents'
      },
      {
        name: 'Reviews',
        description: 'Endpoints for managing agent reviews'
      },
      {
        name: 'Companies',
        description: 'Endpoints for managing companies'
      }
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
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatar: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            isOfficial: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' }
          }
        },
        
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password', minLength: 8 },
            name: { type: 'string' }
          }
        },
        
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' }
          }
        },
        
        // Agent schemas
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            isPro: { type: 'boolean' },
            likes: { type: 'integer' },
            views: { type: 'integer' },
            rating: { type: 'number', format: 'float' },
            usageCount: { type: 'integer' },
            capabilities: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            company: { 
              type: 'object', 
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                logoUrl: { type: 'string', nullable: true },
                isVerified: { type: 'boolean' },
                isEnterprise: { type: 'boolean' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            isOwner: { type: 'boolean' }
          }
        },
        
        CreateAgentRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            isPro: { type: 'boolean' },
            capabilities: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            companyId: { type: 'string', format: 'uuid' },
            isPublic: { type: 'boolean', default: true }
          }
        },
        
        UpdateAgentRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            imageUrl: { type: 'string' },
            isPro: { type: 'boolean' },
            capabilities: { 
              type: 'array', 
              items: { type: 'string' } 
            },
            companyId: { type: 'string', format: 'uuid' },
            isPublic: { type: 'boolean' }
          }
        },
        
        // Review schemas
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
            id: { type: 'string', format: 'uuid' },
            author: { 
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
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
            id: { type: 'string', format: 'uuid' },
            author: { $ref: '#/components/schemas/ReviewAuthor' },
            date: { type: 'string', format: 'date-time' },
            formattedDate: { type: 'string' },
            content: { type: 'string' }
          }
        },
        
        ReviewImageResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string' },
            thumbnailUrl: { type: 'string' },
            alt: { type: 'string', nullable: true }
          }
        },
        
        ReviewAuthor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            avatar: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            isCurrentUser: { type: 'boolean' },
            isOfficial: { type: 'boolean', nullable: true }
          }
        },
        
        ReviewSummary: {
          type: 'object',
          properties: {
            averageRating: { type: 'number', format: 'float' },
            totalReviews: { type: 'integer' },
            credibilityScore: { type: 'number', format: 'float' },
            credibilityBadge: { type: 'string', enum: ['excellent', 'good', 'average', 'poor', 'not-rated'] },
            recentPositivePercentage: { type: 'integer' },
            ratingDistribution: {
              type: 'object',
              properties: {
                '1': { type: 'integer' },
                '2': { type: 'integer' },
                '3': { type: 'integer' },
                '4': { type: 'integer' },
                '5': { type: 'integer' }
              }
            }
          }
        },
        
        // Response wrappers
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/api/features/**/*.ts'],
};

export const setupSwagger = () => {
  return swaggerJsdoc(options);
};

export { swaggerUi };
