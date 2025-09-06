# Novi Setup Guide

This guide will help you set up and run Novi, your friendly AI companion for content summarization.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- TiDB database (local or cloud)
- Agentuity CLI
- API keys for various services

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your API keys:

```bash
cp .env.example .env
```

Fill in the following required environment variables:

```env
# Agentuity Configuration
AGENTUITY_SDK_KEY=your_agentuity_sdk_key_here
AGENTUITY_PROJECT_KEY=your_agentuity_project_key_here

# AI Provider Keys
OPENAI_API_KEY=your_openai_api_key_here

# TiDB Database
TIDB_HOST=your_tidb_host_here
TIDB_USER=your_tidb_user_here
TIDB_PASSWORD=your_tidb_password_here
TIDB_DATABASE=novi

# Storage Integration (Optional)
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_notion_database_id_here

# Audio/Speech (Optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. Database Setup

Run database migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Deploy Agents to Agentuity

Install Agentuity CLI and deploy the agents:

```bash
# Install Agentuity CLI
npm install -g @agentuity/cli

# Login to Agentuity
agentuity login

# Deploy agents to the cloud
agentuity deploy
```

### 5. Run the Application

Start the agents in development mode:

```bash
# Run agents locally for development
npm run dev
```

Start the React Native app:

```bash
# In a new terminal
cd frontend
npm start
```

## API Keys Setup

### Agentuity
1. Sign up at [agentuity.com](https://agentuity.com)
2. Create a new project
3. Get your SDK and Project keys from the dashboard

### OpenAI
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key in the API section
3. Add billing information for usage

### TiDB
1. Sign up at [tidbcloud.com](https://tidbcloud.com)
2. Create a new cluster
3. Get connection details from the cluster dashboard

### Notion (Optional)
1. Go to [notion.so/my-integrations](https://notion.so/my-integrations)
2. Create a new integration
3. Get the API key and create a database
4. Share the database with your integration

### ElevenLabs (Optional)
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get your API key from the profile section
3. Choose a voice ID from the voice library

## Development Workflow

### Backend Development

```bash
# Run agents locally
npm run dev

# Type checking
npm run type-check

# Run tests
npm test

# Build for production
npm run build
```

### Frontend Development

```bash
cd frontend

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run tests
npm test
```

### Database Operations

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Reset database (development only)
npm run db:reset
```

## Architecture Overview

### Backend (Agentuity Agents)
- **Orchestrator Agent**: Coordinates all other agents
- **YouTube Agent**: Monitors YouTube channels and creates summaries
- **RSS Agent**: Monitors RSS feeds and summarizes articles
- **Newsletter Agent**: Processes email newsletters
- **Interaction Agent**: Handles user questions and responses

### Frontend (React Native)
- **Home Screen**: Dashboard with recent summaries
- **Chat Screen**: Interactive Q&A with Novi
- **Sources Screen**: Manage content sources
- **Profile Screen**: User settings and preferences

### Database (TiDB)
- Users and authentication
- Content sources and items
- AI-generated summaries
- Conversation history
- Storage locations

### Storage Integration
- **Notion**: Store summaries as pages
- **Google Docs**: Alternative storage option

## Troubleshooting

### Common Issues

1. **Agentuity deployment fails**
   - Check your API keys are correct
   - Ensure you're logged in: `agentuity login`
   - Verify project configuration in `agentuity.yaml`

2. **Database connection errors**
   - Verify TiDB credentials
   - Check network connectivity
   - Ensure database exists

3. **Frontend build errors**
   - Clear node_modules and reinstall
   - Check React Native environment setup
   - Verify Expo CLI is installed

4. **API integration issues**
   - Verify all API keys are valid
   - Check rate limits and quotas
   - Review service-specific documentation

### Getting Help

- Check the [Agentuity documentation](https://docs.agentuity.com)
- Review TiDB setup guides
- React Native troubleshooting guides
- Open an issue in the project repository

## Production Deployment

### Backend
1. Deploy agents to Agentuity cloud: `agentuity deploy`
2. Configure production environment variables
3. Set up monitoring and logging

### Frontend
1. Build for production: `expo build`
2. Submit to app stores
3. Configure push notifications

### Database
1. Use TiDB Cloud for production
2. Set up backups and monitoring
3. Configure SSL connections

## Next Steps

1. Add more content sources
2. Implement advanced AI features
3. Add push notifications
4. Integrate with more storage providers
5. Add analytics and insights
