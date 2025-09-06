# Novi - Your Friendly Info Companion 🤖

> Made during the RevenueCat Shipaton hackathon!

Novi is an AI companion that keeps you up to date on YouTube channels, RSS feeds, and newsletters. It summarizes content, stores it in Notion or Google Docs, and allows interaction via text or speech.

## ✨ Features

- **24/7 Content Monitoring**: Automatically monitors your YouTube channels, RSS feeds, and newsletters
- **AI-Powered Summaries**: Generates intelligent summaries with key points, topics, and sentiment analysis
- **Flexible Storage**: Saves summaries to Notion or Google Docs with rich formatting
- **Interactive Q&A**: Ask Novi questions about your content via text or speech
- **Cross-Platform**: React Native app for iOS and Android
- **Cloud-Native**: Powered by Agentuity for scalable agent orchestration

## 🏗️ Architecture

### Backend (Agentuity Cloud Agents)
- **Orchestrator Agent**: Coordinates all content processing workflows
- **YouTube Agent**: Monitors channels, extracts transcripts, generates summaries
- **RSS Agent**: Polls feeds, processes articles, creates insights
- **Newsletter Agent**: Handles email newsletters and extracts key information
- **Interaction Agent**: Processes user queries and generates contextual responses

### Frontend (React Native + TypeScript)
- **Home Dashboard**: Overview of recent summaries and activity
- **Chat Interface**: Interactive Q&A with Novi
- **Source Management**: Add and manage content sources
- **User Profile**: Settings, preferences, and account management

### Database (TiDB)
- Users and authentication
- Content sources and items
- AI-generated summaries with metadata
- Conversation history and context
- Storage location tracking

### Storage Integration
- **Notion**: Rich page creation with structured content
- **Google Docs**: Document generation with formatting
- **Flexible Provider System**: Easy to add new storage options

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

```bash
# 1. Install dependencies
npm install
cd frontend && npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Set up database
npm run db:generate
npm run db:migrate

# 4. Deploy agents to Agentuity
agentuity deploy

# 5. Start development
npm run dev          # Backend agents
cd frontend && npm start  # React Native app
```

## 📱 Demo Features

Perfect for hackathon demonstrations:

1. **Live Content Monitoring**: Show real-time YouTube/RSS processing
2. **AI Summarization**: Demonstrate intelligent content analysis
3. **Storage Integration**: Create Notion pages or Google Docs on-the-fly
4. **Interactive Chat**: Ask questions about summarized content
5. **Voice Responses**: Text-to-speech with ElevenLabs integration

## 🛠️ Tech Stack

- **Agents**: Agentuity + Langchain + OpenAI/Anthropic
- **Database**: TiDB (MySQL-compatible, cloud-native)
- **Frontend**: React Native + Expo + TypeScript
- **Storage**: Notion API + Google Docs API
- **Audio**: ElevenLabs text-to-speech
- **Auth**: JWT + Google/Apple Sign-In ready

## 📊 Project Structure

```
Novi/
├── src/
│   ├── agents/           # Agentuity agents (24/7 cloud runners)
│   │   ├── orchestrator/ # Main coordination agent
│   │   ├── youtube/      # YouTube monitoring & summarization
│   │   ├── rss/          # RSS feed processing
│   │   ├── newsletter/   # Email newsletter handling
│   │   └── interaction/  # User Q&A processing
│   ├── database/         # TiDB schema & connection
│   ├── storage/          # Notion/Google Docs integration
│   ├── services/         # ElevenLabs, auth, utilities
│   ├── auth/             # Authentication & user management
│   └── shared/           # TypeScript types & utilities
├── frontend/             # React Native mobile app
│   ├── src/
│   │   ├── screens/      # App screens (Home, Chat, Sources, Profile)
│   │   ├── components/   # Reusable UI components
│   │   ├── services/     # API clients & integrations
│   │   ├── contexts/     # React contexts (Auth, etc.)
│   │   └── navigation/   # App navigation setup
├── agentuity.yaml        # Agentuity project configuration
├── package.json          # Backend dependencies
└── SETUP.md             # Detailed setup guide
```
