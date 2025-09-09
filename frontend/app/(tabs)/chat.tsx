import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, Avatar, Divider } from 'react-native-paper';

export default function ChatScreen() {
  const theme = useTheme();

  // Example chat messages
  const messages = [
    {
      id: '1',
      type: 'user',
      message: 'Can you summarize the latest AI news?',
      timestamp: '2:30 PM'
    },
    {
      id: '2',
      type: 'bot',
      message: 'I found 3 recent AI articles from your RSS feeds. Here are the key highlights:\n\n• Stanford researchers developed new efficient training methods\n• OpenAI announced GPT-5 development timeline\n• Google released updated Gemini model',
      timestamp: '2:31 PM'
    },
    {
      id: '3',
      type: 'user',
      message: 'Tell me more about the Stanford research',
      timestamp: '2:32 PM'
    },
    {
      id: '4',
      type: 'bot',
      message: 'The Stanford team created "Sparse Attention Mechanisms" that reduce computational requirements by 40% while maintaining performance. This could make AI training more accessible to smaller organizations.',
      timestamp: '2:33 PM'
    }
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
          Chat with Novi
        </Text>
        
        {/* Chat Messages */}
        <View style={{ marginBottom: 20 }}>
          {messages.map((msg, index) => (
            <View key={msg.id} style={{ marginBottom: 16 }}>
              <View style={{ 
                flexDirection: msg.type === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start'
              }}>
                <Avatar.Icon 
                  size={32} 
                  icon={msg.type === 'user' ? 'account' : 'robot'} 
                  style={{ 
                    marginLeft: msg.type === 'user' ? 8 : 0,
                    marginRight: msg.type === 'bot' ? 8 : 0
                  }} 
                />
                <Card style={{ 
                  flex: 1,
                  maxWidth: '80%',
                  backgroundColor: msg.type === 'user' 
                    ? theme.colors.primaryContainer 
                    : theme.colors.surface
                }}>
                  <Card.Content style={{ paddingVertical: 12 }}>
                    <Text variant="bodyMedium" style={{ 
                      color: msg.type === 'user' 
                        ? theme.colors.onPrimaryContainer 
                        : theme.colors.onSurface,
                      lineHeight: 20
                    }}>
                      {msg.message}
                    </Text>
                    <Text variant="bodySmall" style={{ 
                      marginTop: 4,
                      color: msg.type === 'user' 
                        ? theme.colors.onPrimaryContainer 
                        : theme.colors.onSurfaceVariant,
                      opacity: 0.7
                    }}>
                      {msg.timestamp}
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            </View>
          ))}
        </View>

        <Divider style={{ marginBottom: 20 }} />

        {/* Input Area Placeholder */}
        <Card style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text variant="titleMedium" style={{ 
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
              textAlign: 'center'
            }}>
              💬 Chat Coming Soon
            </Text>
            <Text variant="bodyMedium" style={{ 
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
              marginBottom: 16
            }}>
              Ask questions about your summaries, get insights, and explore your content with AI assistance.
            </Text>
            <Button 
              mode="outlined" 
              disabled
              icon="message-text"
            >
              Start Conversation
            </Button>
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={{ 
          textAlign: 'center', 
          color: theme.colors.onSurfaceVariant,
          marginTop: 16,
          fontStyle: 'italic'
        }}>
          🤖 Example conversation - Real chat functionality coming soon!
        </Text>
      </View>
    </ScrollView>
  );
}
