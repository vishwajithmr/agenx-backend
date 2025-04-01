# agenx-backend

Backend API for AI Agent Marketplace built with Express and Supabase.

## Features

- RESTful API for managing AI agents
- Complete CRUD operations (GET, POST, PUT, PATCH, DELETE)
- Authentication with Supabase Auth
- Row-level security for data access control
- Swagger documentation

## API Endpoints

### Authentication
- POST `/api/auth/signup` - Register a new user
- POST `/api/auth/login` - Log in a user
- POST `/api/auth/logout` - Log out a user
- GET `/api/auth/user` - Get current user info

### Agents
- GET `/api/agents` - List all public agents
- GET `/api/agents/:id` - Get a specific agent
- POST `/api/agents` - Create a new agent (authenticated)
- PUT `/api/agents/:id` - Update an agent (authenticated, owner only)
- PATCH `/api/agents/:id` - Partially update an agent (authenticated, owner only)
- DELETE `/api/agents/:id` - Delete an agent (authenticated, owner only)

## Database Schema

### Tables
- `profiles` - User profiles that extend Supabase auth.users
- `agents` - AI agents with details and metrics
- `companies` - Companies that own or create agents

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```
<copilot-edited-file>
```markdown
# agenx-backend

Backend API for AI Agent Marketplace built with Express and Supabase.

## Features

- RESTful API for managing AI agents
- Complete CRUD operations (GET, POST, PUT, PATCH, DELETE)
- Authentication with Supabase Auth
- Row-level security for data access control
- Swagger documentation

## API Endpoints

### Authentication
- POST `/api/auth/signup` - Register a new user
- POST `/api/auth/login` - Log in a user
- POST `/api/auth/logout` - Log out a user
- GET `/api/auth/user` - Get current user info

### Agents
- GET `/api/agents` - List all public agents
- GET `/api/agents/:id` - Get a specific agent
- POST `/api/agents` - Create a new agent (authenticated)
- PUT `/api/agents/:id` - Update an agent (authenticated, owner only)
- PATCH `/api/agents/:id` - Partially update an agent (authenticated, owner only)
- DELETE `/api/agents/:id` - Delete an agent (authenticated, owner only)

## Database Schema

### Tables
- `profiles` - User profiles that extend Supabase auth.users
- `agents` - AI agents with details and metrics
- `companies` - Companies that own or create agents

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Example .env file
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

3. Start the development server:
```bash
npm run dev
```

## Documentation

Swagger documentation is available at `/api/docs` when the server is running.

## License

This project is licensed under the MIT License.