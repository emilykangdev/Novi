import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  TextInput, 
  Button, 
  useTheme, 
  Avatar,
  Chip,
  Divider 
} from 'react-native-paper';

export default function AddFeedScreen() {
  const theme = useTheme();
  const [rssUrl, setRssUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Example RSS feeds for quick testing
  const exampleFeeds = [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      description: 'Latest technology news and startup coverage'
    },
    {
      name: 'Hacker News',
      url: 'https://hnrss.org/frontpage',
      description: 'Top stories from Hacker News'
    },
    {
      name: 'React Blog',
      url: 'https://reactjs.org/feed.xml',
      description: 'Official React.js blog updates'
    },
    {
      name: 'Product Hunt',
      url: 'https://www.producthunt.com/feed',
      description: 'New products and launches'
    }
  ];

  const handleAddFeed = async () => {
    if (!rssUrl.trim()) {
      Alert.alert('Error', 'Please enter an RSS feed URL');
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'Success!', 
        `RSS feed added: ${rssUrl}\n\n(This is a demo - backend integration coming soon!)`,
        [{ text: 'OK', onPress: () => setRssUrl('') }]
      );
    }, 1500);
  };

  const handleExampleFeed = (url: string) => {
    setRssUrl(url);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
          Add RSS Feed
        </Text>
        
        {/* Input Section */}
        <Card style={{ marginBottom: 24 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 16, color: theme.colors.onSurface }}>
              Enter RSS Feed URL
            </Text>
            
            <TextInput
              label="RSS Feed URL"
              value={rssUrl}
              onChangeText={setRssUrl}
              mode="outlined"
              placeholder="https://example.com/feed.xml"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ marginBottom: 16 }}
            />
            
            <Button 
              mode="contained" 
              onPress={handleAddFeed}
              loading={isLoading}
              disabled={isLoading || !rssUrl.trim()}
              icon="plus"
            >
              {isLoading ? 'Adding Feed...' : 'Add RSS Feed'}
            </Button>
          </Card.Content>
        </Card>

        <Divider style={{ marginBottom: 24 }} />

        {/* Example Feeds */}
        <Text variant="titleMedium" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
          🚀 Popular RSS Feeds
        </Text>
        
        {exampleFeeds.map((feed, index) => (
          <Card key={index} style={{ marginBottom: 12 }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Avatar.Icon size={32} icon="rss" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                    {feed.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {feed.description}
                  </Text>
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Chip mode="outlined" compact style={{ maxWidth: '70%' }}>
                  {feed.url}
                </Chip>
                <Button 
                  mode="text" 
                  compact
                  onPress={() => handleExampleFeed(feed.url)}
                >
                  Use This
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}

        {/* Info Section */}
        <Card style={{ marginTop: 24, backgroundColor: theme.colors.secondaryContainer }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 8, color: theme.colors.onSecondaryContainer }}>
              💡 How it works
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer, lineHeight: 20 }}>
              1. Enter any RSS feed URL{'\n'}
              2. Our AI will process new articles{'\n'}
              3. Get smart summaries in minutes{'\n'}
              4. Listen to audio versions (optional)
            </Text>
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={{ 
          textAlign: 'center', 
          color: theme.colors.onSurfaceVariant,
          marginTop: 16,
          fontStyle: 'italic'
        }}>
          🔧 Demo mode - Backend integration coming soon!
        </Text>
      </View>
    </ScrollView>
  );
}
