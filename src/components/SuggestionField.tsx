import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '@/lib/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  suggestions: string[];
  customSuggestions?: string[];
  onSelectSuggestion?: (suggestion: string) => void;
  onNewValueEntered?: (value: string) => void; // Callback para registrar nova sugestão
  disabled?: boolean;
  testID?: string;
}

export function SuggestionField({
  label,
  value,
  onChangeText,
  placeholder,
  suggestions,
  customSuggestions = [],
  onSelectSuggestion,
  onNewValueEntered,
  disabled = false,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Combina sugestões customizadas com as pré-definidas (sem duplicatas)
  const allSuggestions = [...customSuggestions, ...suggestions]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort();

  // Filtra conforme o que foi digitado
  const filtered = value.trim()
    ? allSuggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : allSuggestions;

  const handleSelect = (suggestion: string) => {
    onChangeText(suggestion);
    onSelectSuggestion?.(suggestion);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleBlur = () => {
    // Registrar nova sugestão se valor não está na lista
    const trimmed = value.trim();
    if (trimmed && !allSuggestions.includes(trimmed)) {
      onNewValueEntered?.(trimmed);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={text => {
            onChangeText(text);
            if (!open) setOpen(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={!disabled}
          testID={testID}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
        />
        {allSuggestions.length > 0 && (
          <Pressable
            hitSlop={10}
            onPress={() => {
              if (open) {
                setOpen(false);
                inputRef.current?.blur();
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
          >
            <Text style={styles.iconDropdown}>{open ? '▲' : '▼'}</Text>
          </Pressable>
        )}
      </View>

      {open && filtered.length > 0 && (
        <View style={styles.suggestionsBox}>
          {filtered.map((item, idx) => (
            <Pressable
              key={`${item}-${idx}`}
              style={({ pressed }) => [
                styles.suggestionItem,
                idx === filtered.length - 1 && styles.suggestionItemLast,
                pressed && styles.suggestionItemPressed,
              ]}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  iconDropdown: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  suggestionsBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderNeutral,
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionItemPressed: {
    backgroundColor: colors.primary + '15',
  },
  suggestionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
});
