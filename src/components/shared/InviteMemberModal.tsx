import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/useThemeColors';
import * as sharedService from '../../services/sharedSpacesService';
import { MEMBER_ROLE_LABELS, type MemberRole } from '../../types/sharedSpaces';

interface QRData {
  shareUrl: string;
  deepLink: string;
  expiresAt: string;
  multiUse: boolean;
  maxUses?: number | null;
  invitationId?: string;
}

const ROLES: MemberRole[] = ['admin', 'member'];
type InviteTab = 'email' | 'qr';

type Props = {
  visible: boolean;
  spaceId: string;
  onClose: () => void;
  onInvited: () => void;
};

export default function InviteMemberModal({ visible, spaceId, onClose, onInvited }: Props) {
  const colors = useThemeColors();

  // ── Tab state ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<InviteTab>('email');
  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchTab = useCallback(
    (next: InviteTab) => {
      Haptics.selectionAsync();
      setTab(next);
      Animated.spring(tabAnim, {
        toValue: next === 'email' ? 0 : 1,
        useNativeDriver: false,
        speed: 20,
        bounciness: 0,
      }).start();
    },
    [tabAnim]
  );

  // ── Shared form fields ────────────────────────────────────────────────────
  const [rol, setRol] = useState<MemberRole>('member');
  const [message, setMessage] = useState('');

  // ── Email tab ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleInviteByEmail = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Toast.show({ type: 'info', text1: 'Escribe un correo electrónico' });
      return;
    }
    setSendingEmail(true);
    try {
      await sharedService.sendInvitation(spaceId, {
        email: trimmed,
        rol,
        message: message.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Invitación enviada', text2: `Se envió un correo a ${trimmed}` });
      setEmail('');
      setMessage('');
      onInvited();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al invitar', text2: err?.message ?? '' });
    } finally {
      setSendingEmail(false);
    }
  }, [email, rol, message, spaceId, onInvited]);

  // ── QR tab ────────────────────────────────────────────────────────────────
  const [multiUse, setMultiUse] = useState(false);
  const [maxUsesStr, setMaxUsesStr] = useState('0');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrData, setQrData] = useState<QRData | null>(null);
  const pollRef = useRef<number | null>(null);
  const [scannedNotice, setScannedNotice] = useState<string | null>(null);

  const handleGenerateQR = useCallback(async () => {
    setGeneratingQR(true);
    try {
      const maxUses = multiUse ? parseInt(maxUsesStr, 10) || 0 : undefined;
      const qr = await sharedService.createQRInvitation(spaceId, {
        rol,
        message: message.trim() || undefined,
        multiUse: multiUse || undefined,
        maxUses,
      });
      console.log('[InviteMemberModal] createQRInvitation result:', qr);
      if (!qr || !qr.shareUrl) {
        Toast.show({ type: 'error', text1: 'Error al generar QR', text2: 'No se obtuvo URL del servidor' });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setQrData({
          invitationId: (qr as any).invitationId ?? undefined,
          shareUrl: qr.shareUrl,
          deepLink: qr.deepLink ?? '',
          expiresAt: qr.expiresAt,
          multiUse: qr.multiUse ?? false,
          maxUses: qr.maxUses ?? null,
        });
      }
      // Do NOT call onInvited here: keep the modal open until the QR is scanned.
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al generar QR', text2: err?.message ?? '' });
    } finally {
      setGeneratingQR(false);
    }
  }, [spaceId, rol, message, multiUse, maxUsesStr, onInvited]);

  const handleShareLink = useCallback(async () => {
    if (!qrData?.shareUrl) return;
    try {
      await Share.share({
        message: `Únete a mi espacio compartido en LitFinance:\n${qrData.shareUrl}`,
        url: qrData.shareUrl,
      });
    } catch {
      // user dismissed
    }
  }, [qrData]);

  // Poll invitation status so we can hide the QR when it's scanned/used
  React.useEffect(() => {
    if (!qrData?.invitationId) return;
    const poll = async () => {
      try {
        const invitations = await sharedService.listSpaceInvitations(spaceId);
        const inv = invitations.find((i) => i.invitationId === qrData.invitationId || i.shareUrl === qrData.shareUrl);
        if (!inv) return;
        // Consider accepted or max uses reached as 'used'
        const used =
          inv.estado === 'accepted' ||
          (inv.multiUse && typeof (inv as any).maxUses === 'number' && typeof (inv as any).acceptedCount === 'number' && (inv as any).maxUses > 0 && (inv as any).acceptedCount >= (inv as any).maxUses);
        if (used) {
          if (pollRef.current) {
            clearInterval(pollRef.current as any);
            pollRef.current = null;
          }
          setQrData(null);
          setScannedNotice('QR escaneado y aceptado');
          setTimeout(() => setScannedNotice(null), 4000);
        }
      } catch (e) {
        // ignore polling errors
      }
    };
    // immediate check and then interval
    poll();
    pollRef.current = setInterval(poll, 3000) as unknown as number;
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current as any);
        pollRef.current = null;
      }
    };
  }, [qrData?.invitationId, qrData?.shareUrl, spaceId]);

  const handleResetQR = useCallback(() => {
    setQrData(null);
    setMessage('');
    if (pollRef.current) {
      clearInterval(pollRef.current as any);
      pollRef.current = null;
    }
  }, []);

  // ── Close / reset ─────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setEmail('');
    setMessage('');
    setQrData(null);
    setRol('member');
    setMultiUse(false);
    setMaxUsesStr('0');
    if (pollRef.current) {
      clearInterval(pollRef.current as any);
      pollRef.current = null;
    }
    onClose();
  }, [onClose]);

  // ── Tab indicator interpolation ───────────────────────────────────────────
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Invitar miembro</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.85} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab switcher */}
          <View style={[styles.tabWrap, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Animated.View
              style={[styles.tabIndicator, { backgroundColor: colors.button, left: indicatorLeft }]}
            />
            {(['email', 'qr'] as InviteTab[]).map((t) => {
              const active = tab === t;
              const icon = t === 'email' ? 'mail-outline' : 'qr-code-outline';
              const label = t === 'email' ? 'Por Email' : 'Por QR';
              return (
                <TouchableOpacity key={t} onPress={() => switchTab(t)} style={styles.tabBtn} activeOpacity={0.85}>
                  <Ionicons name={icon as any} size={16} color={active ? '#FFF' : colors.textSecondary} />
                  <Text style={[styles.tabLabel, { color: active ? '#FFF' : colors.textSecondary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {scannedNotice && (
              <View style={[styles.scannedBanner, { backgroundColor: withAlpha(colors.success, 0.12), borderColor: withAlpha(colors.success, 0.2) }]}>
                <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
                <Text style={[styles.scannedText, { color: colors.success }]}>{scannedNotice}</Text>
              </View>
            )}
            {/* ── EMAIL TAB ─────────────────────────────────────────── */}
            {tab === 'email' && (
              <View style={styles.tabContent}>
                <Text style={[styles.label, { color: colors.text }]}>Correo electrónico</Text>
                <TextInput
                  placeholder="usuario@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]}
                  placeholderTextColor={colors.placeholder}
                />

                <Text style={[styles.label, { color: colors.text }]}>Rol</Text>
                <RoleSelector rol={rol} onSelect={setRol} colors={colors} />

                <Text style={[styles.label, { color: colors.text }]}>Mensaje (opcional)</Text>
                <TextInput
                  placeholder="Ej. ¡Únete a nuestro grupo!"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText },
                  ]}
                  placeholderTextColor={colors.placeholder}
                  maxLength={200}
                />

                <TouchableOpacity
                  onPress={handleInviteByEmail}
                  disabled={sendingEmail}
                  activeOpacity={0.9}
                  style={[styles.primaryBtn, { backgroundColor: colors.button, opacity: sendingEmail ? 0.6 : 1 }]}
                >
                  {sendingEmail ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={18} color="#FFF" />
                      <Text style={styles.primaryBtnText}>Enviar invitación</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── QR TAB ────────────────────────────────────────────── */}
            {tab === 'qr' && (
              <View style={styles.tabContent}>
                {qrData?.shareUrl ? (
                  /* ── QR Generated ─────────────────────────────────── */
                  <View style={styles.qrResultWrap}>
                    {/* QR code */}
                    <View style={[styles.qrBox, { backgroundColor: '#FFF', borderColor: colors.border }]}>
                      <QRCode
                        value={qrData.shareUrl}
                        size={200}
                        color="#18191C"
                        backgroundColor="#FFF"
                      />
                    </View>

                    {/* Meta pills */}
                    <View style={styles.qrMetaRow}>
                      <View style={[
                        styles.qrMetaPill,
                        qrData.multiUse
                          ? { backgroundColor: withAlpha(colors.success, 0.12), borderColor: withAlpha(colors.success, 0.2) }
                          : { backgroundColor: withAlpha(colors.button, 0.08), borderColor: withAlpha(colors.button, 0.14) },
                      ]}>
                        <Ionicons
                          name={qrData.multiUse ? 'infinite-outline' : 'person-outline'}
                          size={13}
                          color={qrData.multiUse ? colors.success : colors.button}
                        />
                        <Text style={[styles.qrMetaPillText, { color: qrData.multiUse ? colors.success : colors.button }]}>
                          {qrData.multiUse
                            ? (qrData.maxUses && qrData.maxUses > 0 ? `Máx. ${qrData.maxUses} usos` : 'Multi-uso')
                            : 'Un solo uso'}
                        </Text>
                      </View>
                      <View style={[styles.qrMetaPill, { backgroundColor: withAlpha(colors.border, 0.1), borderColor: withAlpha(colors.border, 0.2) }]}>
                        <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                        <Text style={[styles.qrMetaPillText, { color: colors.textSecondary }]}>7 días</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.qrActions}>
                      <TouchableOpacity onPress={handleShareLink} activeOpacity={0.88} style={[styles.qrActionBtn, { backgroundColor: colors.button }]}>
                        <Ionicons name="share-outline" size={18} color="#FFF" />
                        <Text style={styles.qrActionBtnText}>Compartir enlace</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleResetQR} activeOpacity={0.88} style={[styles.qrActionBtnSecondary, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                        <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.qrActionBtnText, { color: colors.textSecondary }]}>Nuevo QR</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                ) : (
                  /* ── QR Config ────────────────────────────────────── */
                  <View>
                    <Text style={[styles.qrHint, { color: colors.textSecondary }]}>
                      Genera un QR para que cualquier persona pueda unirse al espacio escaneándolo. No se necesita email.
                    </Text>

                    <Text style={[styles.label, { color: colors.text }]}>Rol</Text>
                    <RoleSelector rol={rol} onSelect={setRol} colors={colors} />

                    {/* Multi-use toggle */}
                    <TouchableOpacity
                      onPress={() => setMultiUse((v) => !v)}
                      activeOpacity={0.88}
                      style={[
                        styles.toggleRow,
                        { backgroundColor: colors.backgroundSecondary, borderColor: multiUse ? withAlpha(colors.button, 0.3) : colors.border },
                      ]}
                    >
                      <View style={styles.toggleLeft}>
                        <View style={[styles.toggleIcon, { backgroundColor: multiUse ? withAlpha(colors.button, 0.12) : withAlpha(colors.border, 0.1) }]}>
                          <Ionicons name="infinite-outline" size={18} color={multiUse ? colors.button : colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.toggleTitle, { color: colors.text }]}>Multi-uso</Text>
                          <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                            Múltiples personas pueden usar el mismo QR
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.toggleSwitch, { backgroundColor: multiUse ? colors.button : colors.border }]}>
                        <View style={[styles.toggleThumb, { transform: [{ translateX: multiUse ? 16 : 2 }] }]} />
                      </View>
                    </TouchableOpacity>

                    {/* Max uses (only when multiUse) */}
                    {multiUse && (
                      <>
                        <Text style={[styles.label, { color: colors.text }]}>
                          Límite de usos{' '}
                          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>(0 = sin límite)</Text>
                        </Text>
                        <TextInput
                          placeholder="0"
                          value={maxUsesStr}
                          onChangeText={(v) => setMaxUsesStr(v.replace(/[^0-9]/g, ''))}
                          keyboardType="number-pad"
                          maxLength={5}
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]}
                          placeholderTextColor={colors.placeholder}
                        />
                      </>
                    )}

                    <Text style={[styles.label, { color: colors.text }]}>Mensaje (opcional)</Text>
                    <TextInput
                      placeholder="Ej. Escanea el QR para unirte"
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      numberOfLines={2}
                      style={[
                        styles.input,
                        styles.inputMultiline,
                        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText, height: 60 },
                      ]}
                      placeholderTextColor={colors.placeholder}
                      maxLength={200}
                    />

                    <TouchableOpacity
                      onPress={handleGenerateQR}
                      disabled={generatingQR}
                      activeOpacity={0.9}
                      style={[styles.primaryBtn, { backgroundColor: colors.button, opacity: generatingQR ? 0.6 : 1 }]}
                    >
                      {generatingQR ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="qr-code-outline" size={18} color="#FFF" />
                          <Text style={styles.primaryBtnText}>Generar QR</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Role selector sub-component ───────────────────────────────────────────

function RoleSelector({ rol, onSelect, colors }: { rol: MemberRole; onSelect: (r: MemberRole) => void; colors: any }) {
  return (
    <View style={styles.chipRow}>
      {ROLES.map((r) => {
        const selected = rol === r;
        return (
          <TouchableOpacity
            key={r}
            onPress={() => onSelect(r)}
            style={[
              styles.chip,
              { backgroundColor: selected ? colors.button : colors.backgroundSecondary, borderColor: selected ? colors.button : colors.border },
            ]}
            activeOpacity={0.9}
          >
            <Ionicons
              name={r === 'admin' ? 'shield-checkmark-outline' : 'person-outline'}
              size={14}
              color={selected ? '#FFF' : colors.textSecondary}
            />
            <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>
              {MEMBER_ROLE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function withAlpha(color: string, alpha: number): string {
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((x) => Number.isFinite(x))) return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return c;
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '900' },

  // Tabs
  tabWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: { position: 'absolute', top: 4, bottom: 4, width: '50%', borderRadius: 10 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
    zIndex: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '900' },
  tabContent: { gap: 0 },

  // Form
  label: { fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 4 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  inputMultiline: { height: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipText: { fontSize: 13, fontWeight: '800' },

  // Toggle
  qrHint: { fontSize: 13, fontWeight: '700', lineHeight: 20, marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: 14, fontWeight: '900' },
  toggleSub: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  toggleSwitch: { width: 38, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },

  // QR Result
  qrResultWrap: { alignItems: 'center', gap: 16 },
  qrBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  qrMetaRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  qrMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qrMetaPillText: { fontSize: 12, fontWeight: '900' },
  qrActions: { width: '100%', gap: 10 },
  qrActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 14,
    borderRadius: 16,
  },
  qrActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  qrActionBtnText: { fontSize: 15, fontWeight: '900', color: '#FFF' },

  scannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  scannedText: { fontSize: 13, fontWeight: '900' },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
});
