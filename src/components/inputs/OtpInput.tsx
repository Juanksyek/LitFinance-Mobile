import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, Keyboard, Animated } from 'react-native';
import { useThemeColors } from '../theme/useThemeColors';

type Props = {
  length?: number; // default 6
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
};

export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
}: Props) {
  const colors = useThemeColors();
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  
  // Animaciones para cada input
  const scaleAnims = useRef(Array.from({ length }, () => new Animated.Value(1))).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  const digits = useMemo(() => {
    const arr = new Array(length).fill('');
    for (let i = 0; i < length; i++) arr[i] = value[i] ?? '';
    return arr;
  }, [value, length]);

  const focusIndex = (i: number) => {
    inputsRef.current[i]?.focus();
  };

  const animateFocus = (i: number) => {
    Animated.spring(scaleAnims[i], {
      toValue: 1.1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const animateBlur = (i: number) => {
    Animated.spring(scaleAnims[i], {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const animateSuccess = () => {
    Animated.sequence(
      scaleAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1.15,
          tension: 100,
          friction: 3,
          useNativeDriver: true,
        })
      )
    ).start(() => {
      Animated.parallel(
        scaleAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          })
        )
      ).start();
    });
  };

  const animateError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const setAt = (i: number, char: string) => {
    const cleaned = char.replace(/\D/g, '');
    if (!cleaned) return;

    const next = value.split('');
    next[i] = cleaned[0];
    const joined = next.join('').slice(0, length);
    onChange(joined);

    const nextIndex = Math.min(i + 1, length - 1);
    if (i < length - 1) focusIndex(nextIndex);

    if (joined.length === length && !joined.includes('')) {
      animateSuccess();
      setTimeout(() => {
        Keyboard.dismiss();
        onComplete?.(joined);
      }, 300);
    }
  };

  const handleBackspace = (i: number) => {
    const next = value.split('');
    if (next[i]) {
      next[i] = '';
      onChange(next.join(''));
      return;
    }
    if (i > 0) {
      const prevIndex = i - 1;
      next[prevIndex] = '';
      onChange(next.join(''));
      focusIndex(prevIndex);
    }
  };

  const handlePaste = (text: string) => {
    const cleaned = (text || '').replace(/\D/g, '').slice(0, length);
    if (!cleaned) return;
    onChange(cleaned);
    if (cleaned.length === length) {
      animateSuccess();
      setTimeout(() => {
        Keyboard.dismiss();
        onComplete?.(cleaned);
      }, 300);
    } else {
      focusIndex(Math.min(cleaned.length, length - 1));
    }
  };

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateX: shakeAnim }] }]}>
      <View style={styles.row}>
        {digits.map((d, i) => {
          const isFocused = focusedIndex === i;
          const hasValue = !!d;
          
          return (
            <Animated.View
              key={i}
              style={[
                styles.boxContainer,
                {
                  transform: [{ scale: scaleAnims[i] }],
                },
              ]}
            >
              {/* Glow effect cuando está lleno */}
              {hasValue && (
                <View
                  style={[
                    styles.glowEffect,
                    { backgroundColor: 'rgba(239, 119, 37, 0.15)' },
                  ]}
                />
              )}
              
              {/* Ring effect cuando está enfocado */}
              {isFocused && (
                <View
                  style={[
                    styles.focusRing,
                    { borderColor: '#EF7725' },
                  ]}
                />
              )}
              
              <TextInput
                ref={(r) => {
                  inputsRef.current[i] = r;
                }}
                value={d}
                editable={!disabled}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={1}
                onFocus={() => {
                  setFocusedIndex(i);
                  animateFocus(i);
                }}
                onBlur={() => {
                  setFocusedIndex(null);
                  animateBlur(i);
                }}
                onChangeText={(t) => {
                  if (t.length > 1) return handlePaste(t);
                  setAt(i, t);
                }}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Backspace') handleBackspace(i);
                }}
                style={[
                  styles.box,
                  {
                    borderColor: hasValue ? '#EF7725' : isFocused ? '#EF7725' : colors.border,
                    borderWidth: hasValue || isFocused ? 2.5 : 2,
                    backgroundColor: colors.inputBackground,
                    color: hasValue ? '#EF7725' : colors.inputText,
                  },
                ]}
                textAlign="center"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.placeholder}
              />
            </Animated.View>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => {
          animateError();
          setTimeout(() => {
            onChange('');
            focusIndex(0);
          }, 200);
        }}
        disabled={disabled || !value}
        style={[styles.clearBtn, (disabled || !value) && { opacity: 0.5 }]}
        activeOpacity={0.7}
      >
        <View style={[styles.clearContent, { borderColor: colors.border }]}>
          <Text style={[styles.clearText, { color: '#EF7725' }]}>✕ Limpiar</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  boxContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: '800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  glowEffect: {
    position: 'absolute',
    width: 48,
    height: 56,
    borderRadius: 14,
    zIndex: -1,
  },
  focusRing: {
    position: 'absolute',
    width: 56,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    zIndex: -1,
    opacity: 0.3,
  },
  clearBtn: { 
    marginTop: 16, 
    paddingVertical: 10, 
    paddingHorizontal: 16,
  },
  clearContent: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  clearText: { 
    fontSize: 13, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
