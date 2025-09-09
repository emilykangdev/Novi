import React from 'react';
import { View, ScrollView } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  useTheme, 
  Avatar, 
  List,
  Divider,
  Switch 
} from 'react-native-paper';
import { useUser, useClerk } from '@clerk/clerk-expo';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [audioSummariesEnabled, setAudioSummariesEnabled] = React.useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ padding: 16 }}>
        <Text variant="headlineMedium" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
          Profile
        </Text>
        
        {/* User Info */}
        <Card style={{ marginBottom: 20 }}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Avatar.Icon 
              size={80} 
              icon="account" 
              style={{ marginBottom: 16 }}
            />
            <Text variant="headlineSmall" style={{ 
              color: theme.colors.onSurface,
              marginBottom: 4,
              fontWeight: '600'
            }}>
              {user?.firstName || 'User'}
            </Text>
            <Text variant="bodyMedium" style={{ 
              color: theme.colors.onSurfaceVariant,
              marginBottom: 16
            }}>
              {user?.emailAddresses[0]?.emailAddress || 'user@example.com'}
            </Text>
            <Button mode="outlined" icon="pencil">
              Edit Profile
            </Button>
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={{ marginBottom: 20 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ 
              marginBottom: 16,
              color: theme.colors.onSurface,
              fontWeight: '600'
            }}>
              📊 Your Stats
            </Text>
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around',
              paddingVertical: 8
            }}>
              <View style={{ alignItems: 'center' }}>
                <Text variant="headlineSmall" style={{ 
                  color: theme.colors.primary,
                  fontWeight: 'bold'
                }}>
                  42
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Summaries
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text variant="headlineSmall" style={{ 
                  color: theme.colors.secondary,
                  fontWeight: 'bold'
                }}>
                  7
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  RSS Feeds
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text variant="headlineSmall" style={{ 
                  color: theme.colors.tertiary,
                  fontWeight: 'bold'
                }}>
                  12h
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Time Saved
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Settings */}
        <Card style={{ marginBottom: 20 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ 
              marginBottom: 16,
              color: theme.colors.onSurface,
              fontWeight: '600'
            }}>
              ⚙️ Settings
            </Text>
            
            <List.Item
              title="Push Notifications"
              description="Get notified about new summaries"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                />
              )}
            />
            
            <Divider />
            
            <List.Item
              title="Audio Summaries"
              description="Generate audio versions automatically"
              left={(props) => <List.Icon {...props} icon="volume-high" />}
              right={() => (
                <Switch
                  value={audioSummariesEnabled}
                  onValueChange={setAudioSummariesEnabled}
                />
              )}
            />
            
            <Divider />
            
            <List.Item
              title="Export Data"
              description="Download your summaries"
              left={(props) => <List.Icon {...props} icon="download" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
            />
            
            <Divider />
            
            <List.Item
              title="Privacy & Terms"
              description="Review our policies"
              left={(props) => <List.Icon {...props} icon="shield-check" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
            />
          </Card.Content>
        </Card>

        {/* Sign Out */}
        <Card style={{ backgroundColor: theme.colors.errorContainer }}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Button 
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              icon="logout"
              onPress={handleSignOut}
            >
              Sign Out
            </Button>
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={{ 
          textAlign: 'center', 
          color: theme.colors.onSurfaceVariant,
          marginTop: 16,
          fontStyle: 'italic'
        }}>
          🚧 Profile features in development - Basic layout ready!
        </Text>
      </View>
    </ScrollView>
  );
}
