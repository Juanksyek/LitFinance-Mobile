import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const s1 = Keyboard.addListener(showEvt as any, () => setVisible(true));
    const s2 = Keyboard.addListener(hideEvt as any, () => setVisible(false));

    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  return visible;
}
