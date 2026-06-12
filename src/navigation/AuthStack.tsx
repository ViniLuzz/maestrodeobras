import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignupScreen } from '@/screens/auth/SignupScreen';
import { AtivarLicencaScreen } from '@/screens/auth/AtivarLicencaScreen';
import { AcessoTokenScreen } from '@/screens/auth/AcessoTokenScreen';
import { colors } from '@/lib/theme';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const navyHeader = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: colors.textOnDark,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerShadowVisible: false,
};

export function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ ...navyHeader, title: 'Criar conta' }}
      />
      <Stack.Screen
        name="AtivarLicenca"
        component={AtivarLicencaScreen}
        options={{ ...navyHeader, title: 'Ativar licença' }}
      />
      <Stack.Screen
        name="AcessoToken"
        component={AcessoTokenScreen}
        options={{ ...navyHeader, title: 'Acesso por token' }}
      />
    </Stack.Navigator>
  );
}
