import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, spacing } from '@/lib/theme';

interface Props {
  label: string;
  value: string | null; // YYYY-MM-DD
  onChange: (date: string | null) => void;
  placeholder?: string;
}

function parseDate(v: string | null): Date {
  if (!v) return new Date();
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function displayDate(v: string | null): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

export function DateField({ label, value, onChange, placeholder = 'Selecionar data' }: Props) {
  const [visible, setVisible] = useState(false);
  const [temp, setTemp] = useState<Date>(parseDate(value));

  const abrir = () => {
    setTemp(parseDate(value));
    setVisible(true);
  };

  // Android: o picker já aparece como dialog nativo
  const onAndroid = (event: DateTimePickerEvent, date?: Date) => {
    setVisible(false);
    if (event.type === 'set' && date) onChange(toIso(date));
  };

  // iOS: spinner dentro de modal customizado
  const onIos = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTemp(date);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={abrir}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? displayDate(value) : placeholder}
        </Text>
        {value ? (
          <Pressable
            hitSlop={12}
            onPress={() => onChange(null)}
            style={styles.clearBtn}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : (
          <Text style={styles.calIcon}>📅</Text>
        )}
      </Pressable>

      {/* Android: renderiza o picker diretamente (abre dialog nativo) */}
      {Platform.OS === 'android' && visible && (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display="default"
          onChange={onAndroid}
        />
      )}

      {/* iOS: modal com spinner */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={visible}
          transparent
          animationType="slide"
          onRequestClose={() => setVisible(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => { onChange(null); setVisible(false); }}>
                <Text style={styles.btnLimpar}>Limpar</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => { onChange(toIso(temp)); setVisible(false); }}>
                <Text style={styles.btnConfirmar}>Confirmar</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={temp}
              mode="date"
              display="spinner"
              onChange={onIos}
              locale="pt-BR"
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  value: { fontSize: 16, color: colors.text },
  placeholder: { fontSize: 16, color: colors.textMuted },
  clearBtn: { padding: 4 },
  clearText: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  calIcon: { fontSize: 18 },

  // iOS modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  btnLimpar: { fontSize: 15, color: colors.danger },
  btnConfirmar: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  iosPicker: { height: 200 },
});
