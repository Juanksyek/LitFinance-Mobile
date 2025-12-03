import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface Tab {
  key: string;
  title: string;
  icon: string;
}

interface TabNavigatorProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  children: React.ReactNode;
}

const TabNavigator: React.FC<TabNavigatorProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children
}) => {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { backgroundColor: colors.inputBackground, borderColor: '#3B82F6', borderWidth: 1 }
            ]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabTitle,
              { color: colors.textSecondary },
              activeTab === tab.key && { color: '#3B82F6', fontWeight: '600' }
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    minWidth: 80,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  tabTitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
});

export default TabNavigator;
