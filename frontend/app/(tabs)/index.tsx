import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, Avatar, Chip } from 'react-native-paper';

export default function SummariesScreen() {
  const theme = useTheme();

  // Example summaries data
  const summaries = [
    {
      id: '1',
      title: 'AI Breakthrough in Language Models',
      summary: 'Researchers at Stanford have developed a new approach to training language models that reduces computational requirements by 40% while maintaining performance. The technique, called "Sparse Attention Mechanisms," could make AI more accessible to smaller organizations.',
      source: 'TechCrunch RSS',
      url: 'https://techcrunch.com/feed',
      timestamp: '2 hours ago',
      readTime: '3 min read',
      hasAudio: true,
    },
    {
      id: '2',
      title: 'Climate Tech Funding Reaches Record High',
      summary: 'Investment in climate technology startups hit $8.1 billion in Q3 2024, with carbon capture and renewable energy storage leading the way. Major VCs are increasingly prioritizing sustainability-focused companies.',
      source: 'Hacker News RSS',
      url: 'https://hnrss.org/frontpage',
      timestamp: '5 hours ago',
      readTime: '2 min read',
      hasAudio: true,
    },
    {
      id: '3',
      title: 'React Native 0.75 Released with New Architecture',
      summary: 'The latest React Native update brings significant performance improvements with the new architecture now stable. Developers can expect 30% faster app startup times and improved memory management.',
      source: 'React Blog RSS',
      url: 'https://reactjs.org/feed.xml',
      timestamp: '1 day ago',
      readTime: '4 min read',
      hasAudio: false,
    },
    {
      id: '4',
      title: 'Startup Raises $50M for AI-Powered Code Review',
      summary: 'CodeAI, a startup developing AI tools for automated code review, has raised $50M in Series B funding. The platform claims to catch 85% more bugs than traditional static analysis tools.',
      source: 'Product Hunt RSS',
      url: 'https://www.producthunt.com/feed',
      timestamp: '2 days ago',
      readTime: '3 min read',
      hasAudio: true,
    }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
          Latest Summaries
        </Text>
        
        {summaries.map((item) => (
          <Card key={item.id} style={{ marginBottom: 16 }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Avatar.Icon size={32} icon="rss" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    {item.source}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.timestamp} • {item.readTime}
                  </Text>
                </View>
              </View>
              
              <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
                {item.title}
              </Text>
              
              <Text variant="bodyMedium" style={{ marginBottom: 12, lineHeight: 20 }}>
                {item.summary}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {item.hasAudio && (
                    <Chip icon="play" mode="outlined" compact>
                      Audio
                    </Chip>
                  )}
                  <Chip icon="bookmark-outline" mode="outlined" compact>
                    Save
                  </Chip>
                </View>
                <Button mode="text" compact>
                  Share
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}
        
        <Text variant="bodyMedium" style={{ 
          textAlign: 'center', 
          color: theme.colors.onSurfaceVariant,
          marginTop: 16,
          fontStyle: 'italic'
        }}>
          🎯 Example summaries - Connect your RSS feeds to see real content!
        </Text>
      </View>
    </ScrollView>
  );
}