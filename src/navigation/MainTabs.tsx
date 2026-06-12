import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Image } from 'react-native';
import { ListaObrasScreen } from '@/screens/app/ListaObrasScreen';
import { MarketplaceScreen } from '@/screens/app/MarketplaceScreen';
import { AluguelEquipamentosScreen } from '@/screens/app/AluguelEquipamentosScreen';
import { ConfiguracoesScreen } from '@/screens/app/ConfiguracoesScreen';
import { colors } from '@/lib/theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const navyHeader = {
  headerStyle: { backgroundColor: colors.navy, height: 120 },
  headerTintColor: colors.textOnDark,
  headerShadowVisible: false,
  headerTitleAlign: 'center' as const,
  headerTitle: () => (
    <Image
      source={require('../../assets/logo2.png')}
      style={{ width: 190, height: 90, resizeMode: 'contain' }}
    />
  ),
};

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...navyHeader,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.borderNeutral,
          borderTopWidth: 1,
          height: 110,
          paddingBottom: 20,
          paddingTop: 14,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
      }}
    >
      <Tab.Screen
        name="Obras"
        component={ListaObrasScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Obras',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏗️" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          title: 'Marketplace',
          tabBarLabel: 'Marketplace',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Equipamentos"
        component={AluguelEquipamentosScreen}
        options={{
          title: 'Aluguel de Equipamentos',
          tabBarLabel: 'Equipamentos',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔧" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Conta"
        component={ConfiguracoesScreen}
        options={{
          title: 'Minha Conta',
          tabBarLabel: 'Conta',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
