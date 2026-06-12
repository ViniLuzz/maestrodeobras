import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/theme';
import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';

// Fundo claro no tema da navegação — evita "flash preto" entre telas/transições.
const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.surface },
};

export function RootNavigator() {
  const { session, isInitializing, isCompletingSignIn } = useAuth();

  if (isInitializing || isCompletingSignIn) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
