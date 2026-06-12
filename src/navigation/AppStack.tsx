import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { CriarObraScreen } from '@/screens/app/CriarObraScreen';
import { ObraDetalheScreen } from '@/screens/app/ObraDetalheScreen';
import { ProgressoEquipeScreen } from '@/screens/app/ProgressoEquipeScreen';
import { FinanceiroScreen } from '@/screens/app/FinanceiroScreen';
import { RegistrarDespesaScreen } from '@/screens/app/RegistrarDespesaScreen';
import { EditarPerfilScreen } from '@/screens/app/EditarPerfilScreen';
import { EtapasScreen } from '@/screens/app/EtapasScreen';
import { EtapaFormScreen } from '@/screens/app/EtapaFormScreen';
import { MateriaisScreen } from '@/screens/app/MateriaisScreen';
import { MaterialFormScreen } from '@/screens/app/MaterialFormScreen';
import { ContratacaoListScreen } from '@/screens/app/ContratacaoListScreen';
import { ContratacaoFormScreen } from '@/screens/app/ContratacaoFormScreen';
import { AdministracaoObraScreen } from '@/screens/app/AdministracaoObraScreen';
import { ConcluidosScreen } from '@/screens/app/ConcluidosScreen';
import { MidiasScreen } from '@/screens/app/MidiasScreen';
import { MeuPerfilMarketplaceScreen } from '@/screens/app/MeuPerfilMarketplaceScreen';
import { RelatorioObraScreen } from '@/screens/app/RelatorioObraScreen';
import { DiarioObraScreen } from '@/screens/app/DiarioObraScreen';
import { colors } from '@/lib/theme';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

const navyHeader = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: colors.textOnDark,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerShadowVisible: false,
};

export function AppStack() {
  return (
    <Stack.Navigator screenOptions={navyHeader}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="CriarObra" component={CriarObraScreen} options={{ title: 'Nova Obra' }} />
      <Stack.Screen name="ObraDetalhe" component={ObraDetalheScreen} options={{ title: 'Obra' }} />
      <Stack.Screen name="ProgressoEquipe" component={ProgressoEquipeScreen} options={{ title: 'Progresso' }} />
      <Stack.Screen name="Financeiro" component={FinanceiroScreen} options={{ title: 'Financeiro' }} />
      <Stack.Screen name="RegistrarDespesa" component={RegistrarDespesaScreen} options={{ title: 'Registrar Despesa' }} />
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar Perfil' }} />
      <Stack.Screen name="Etapas" component={EtapasScreen} options={{ title: 'Etapas' }} />
      <Stack.Screen name="EtapaForm" component={EtapaFormScreen} options={{ title: 'Etapa' }} />
      <Stack.Screen name="Materiais" component={MateriaisScreen} options={{ title: 'Materiais' }} />
      <Stack.Screen name="MaterialForm" component={MaterialFormScreen} options={{ title: 'Material' }} />
      <Stack.Screen name="Contratacoes" component={ContratacaoListScreen} options={{ title: 'Contratar' }} />
      <Stack.Screen name="ContratacaoForm" component={ContratacaoFormScreen} options={{ title: 'Contratação' }} />
      <Stack.Screen name="AdministracaoObra" component={AdministracaoObraScreen} options={{ title: 'Administração' }} />
      <Stack.Screen name="Concluidos" component={ConcluidosScreen} options={{ title: 'Concluídos' }} />
      <Stack.Screen name="Midias" component={MidiasScreen} options={{ title: 'Fotos e Vídeos' }} />
      <Stack.Screen name="RelatorioObra" component={RelatorioObraScreen} options={{ title: 'Relatório Executivo' }} />
      <Stack.Screen name="DiarioObra" component={DiarioObraScreen} options={{ title: 'Diário de Obra' }} />
      <Stack.Screen name="MeuPerfilMarketplace" component={MeuPerfilMarketplaceScreen} options={{ title: 'Meu Perfil' }} />
    </Stack.Navigator>
  );
}
