import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  useTheme,
  ActivityIndicator,
  Text,
} from 'react-native-paper';
import { useQuery } from 'react-query';
import { router } from 'expo-router';

import { summaryService } from '../../services/summaryService';
import { useAuth } from '../../contexts/AuthContext';
import type { Summary } from '../../types';

import { SignOutButton } from '../components/SignOutButton';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: summaries,
    isLoading,
    refetch,
  } = useQuery(
    'recent-summaries',
    () => summaryService.getRecentSummaries(10),
    {
      enabled: !!user,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'article':
        return '📰';
      case 'newsletter':
        return '📧';
      default:
        return '📄';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return theme.colors.tertiary;
      case 'negative':
        return theme.colors.error;
      case 'neutral':
      default:
        return theme.colors.outline;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
          Loading your latest summaries...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <Card style={[styles.welcomeCard, { backgroundColor: theme.colors.primary }]}>
        <Card.Content>
          <Title style={styles.welcomeTitle}>
            Welcome back, {user?.name || 'there'}! 👋
          </Title>
          <Paragraph style={styles.welcomeText}>
            Here's what Novi has been summarizing for you today.
          </Paragraph>
        </Card.Content>
      </Card>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {summaries?.data?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onSurface }]}>
              Recent Summaries
            </Text>
          </Card.Content>
        </Card>
        
        <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>
              {summaries?.data?.filter(s => s.sentiment === 'positive').length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onSurface }]}>
              Positive Content
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Recent Summaries */}
      <View style={styles.section}>
        <Title style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          📚 Recent Summaries
        </Title>
        
        {summaries?.data && summaries.data.length > 0 ? (
          summaries.data.map((summary: Summary) => (
            <Card key={summary.id} style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <View style={styles.summaryHeader}>
                  <Text style={styles.contentTypeIcon}>
                    {getContentTypeIcon(summary.contentType)}
                  </Text>
                  <View style={styles.summaryMeta}>
                    <Text style={[styles.summaryTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                      {summary.title}
                    </Text>
                    <Text style={[styles.summaryDate, { color: theme.colors.onSurfaceVariant }]}>
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                
                <Paragraph style={[styles.summaryText, { color: theme.colors.onSurface }]} numberOfLines={3}>
                  {summary.summary}
                </Paragraph>
                
                <View style={styles.summaryFooter}>
                  <View style={styles.chips}>
                    {summary.sentiment && (
                      <Chip
                        mode="outlined"
                        style={[styles.chip, { borderColor: getSentimentColor(summary.sentiment) }]}
                        textStyle={{ color: getSentimentColor(summary.sentiment), fontSize: 12 }}
                      >
                        {summary.sentiment}
                      </Chip>
                    )}
                    {summary.confidence && (
                      <Chip
                        mode="outlined"
                        style={[styles.chip, { borderColor: theme.colors.primary }]}
                        textStyle={{ color: theme.colors.primary, fontSize: 12 }}
                      >
                        {summary.confidence}% confident
                      </Chip>
                    )}
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.emptyContent}>
              <Text style={[styles.emptyIcon, { color: theme.colors.onSurfaceVariant }]}>
                📭
              </Text>
              <Title style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                No summaries yet
              </Title>
              <Paragraph style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                Add some content sources to get started with Novi!
              </Paragraph>
              <Button
                mode="contained"
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/sources')}
              >
                Add Sources
              </Button>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  welcomeCard: {
    marginBottom: 16,
  },
  welcomeTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  welcomeText: {
    color: 'white',
    opacity: 0.9,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  statContent: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contentTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  summaryMeta: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 12,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  emptyCard: {
    marginTop: 32,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
});
