import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
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

const { width: screenWidth } = Dimensions.get('window');

const TabNavigator: React.FC<TabNavigatorProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children
}) => {
  const colors = useThemeColors();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnims = useRef(tabs.map(() => new Animated.Value(1))).current;

  const handleTabPress = (tabKey: string, index: number) => {
    // Animación de fade out/in del contenido
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Animación de escala del tab presionado
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    onTabChange(tabKey);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.tabsWrapper, { backgroundColor: colors.background }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab, index) => (
            <Animated.View
              key={tab.key}
              style={{
                transform: [{ scale: scaleAnims[index] }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.tab,
                  { 
                    backgroundColor: activeTab === tab.key ? colors.button : colors.cardSecondary,
                    shadowColor: activeTab === tab.key ? colors.button : colors.shadow,
                  }
                ]}
                onPress={() => handleTabPress(tab.key, index)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabIcon,
                  { opacity: activeTab === tab.key ? 1 : 0.6 }
                ]}>{tab.icon}</Text>
                <Text style={[
                  styles.tabTitle,
                  { 
                    color: activeTab === tab.key ? '#FFF' : colors.textSecondary,
                    fontWeight: activeTab === tab.key ? '700' : '500'
                  }
                ]}>
                  {tab.title}
                </Text>
                {activeTab === tab.key && (
                  <View style={[styles.activeIndicator, { backgroundColor: '#FFF' }]} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      </View>
      
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsWrapper: {
    paddingVertical: 12,
    marginBottom: 4,
  },
  tabsContainer: {
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 90,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  tabTitle: {
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
});

export default TabNavigator;
// commit