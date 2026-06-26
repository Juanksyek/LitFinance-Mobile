import React, { forwardRef, useCallback } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

let cachedClipboardModule: any | null | undefined = undefined;

function getClipboardModule(): any | null {
  if (cachedClipboardModule !== undefined) return cachedClipboardModule;
  try {
    // Use eval('require') so Metro doesn't statically analyze the dependency.
    const _require: any = eval('require');
    cachedClipboardModule = _require('expo-clipboard');
  } catch {
    cachedClipboardModule = null;
  }
  return cachedClipboardModule;
}

function clearClipboardBestEffort() {
  try {
    const Clipboard = getClipboardModule();
    if (!Clipboard?.setStringAsync) return;
    // Fire-and-forget; we only want to hide Gboard clipboard suggestions.
    Clipboard.setStringAsync('');
    setTimeout(() => {
      try {
        Clipboard.setStringAsync('');
      } catch {
        // ignore
      }
    }, 50);
  } catch {
    // ignore
  }
}

const AppTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => {
  const {
    onFocus,
    autoCorrect,
    spellCheck,
    autoComplete,
    textContentType,
    ...rest
  } = props;

  const handleFocus = useCallback(
    (e: any) => {
      clearClipboardBestEffort();
      onFocus?.(e);
    },
    [onFocus]
  );

  return (
    <TextInput
      ref={ref}
      {...rest}
      onFocus={handleFocus}
      // Strong defaults to reduce suggestion/autofill UI (can be overridden per usage)
      autoCorrect={autoCorrect ?? false}
      spellCheck={spellCheck ?? false}
      autoComplete={autoComplete ?? 'off'}
      textContentType={textContentType ?? 'none'}
      // Android-only props (not in RN types in all versions)
      importantForAutofill={(props as any).importantForAutofill ?? 'no'}
      contextMenuHidden={(props as any).contextMenuHidden ?? true}
      disableFullscreenUI={(props as any).disableFullscreenUI ?? true}
    />
  );
});

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
