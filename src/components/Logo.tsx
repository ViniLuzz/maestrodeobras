import { StyleSheet, Image, View } from 'react-native';

interface Props {
  size?: 'large' | 'medium' | 'small';
  dark?: boolean;
}

export function Logo({ size = 'large', dark = false }: Props) {
  const scale = size === 'large' ? 1 : size === 'medium' ? 0.75 : 0.55;
  const width = Math.round(300 * scale);
  const height = Math.round(150 * scale);

  // logo2.png = versão branca (para fundos escuros/navy)
  // logo.png  = versão azul (para fundos claros)
  const source = dark
    ? require('../../assets/logo2.png')
    : require('../../assets/logo.png');

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={source}
        style={{ width, height, resizeMode: 'contain' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
