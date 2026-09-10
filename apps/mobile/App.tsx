import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthProvider';
import { AnalysisScreen } from './src/features/analysis/AnalysisScreen';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { EndgameScreen, EndgamesScreen } from './src/features/endgames/EndgamesScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { LessonScreen, LessonsScreen } from './src/features/lessons/LessonsScreen';
import { OpeningScreen, OpeningsScreen } from './src/features/openings/OpeningsScreen';
import { PuzzlesScreen } from './src/features/puzzles/PuzzlesScreen';
import { NavigationProvider, useNavigation } from './src/navigation/Navigation';
import { Shell } from './src/navigation/Shell';
import { AppearanceProvider } from './src/appearance/AppearanceProvider';
import { SettingsScreen } from './src/features/settings/SettingsScreen';

function CurrentScreen() {
  const { route } = useNavigation();
  switch (route.screen) {
    case 'home': return <HomeScreen />;
    case 'auth': return <AuthScreen />;
    case 'settings': return <SettingsScreen />;
    case 'lessons': return <LessonsScreen />;
    case 'lesson': return <LessonScreen id={route.id} />;
    case 'openings': return <OpeningsScreen />;
    case 'opening': return <OpeningScreen id={route.id} />;
    case 'puzzles': return <PuzzlesScreen />;
    case 'endgames': return <EndgamesScreen />;
    case 'endgame': return <EndgameScreen id={route.id} />;
    case 'analysis': return <AnalysisScreen />;
  }
}

export default function App() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <NavigationProvider>
      <AuthProvider>
        <AppearanceProvider><Shell><CurrentScreen /></Shell></AppearanceProvider>
      </AuthProvider>
    </NavigationProvider>
  </SafeAreaProvider>;
}
