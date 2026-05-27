import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, TouchableOpacity, Animated } from 'react-native';
import { availableBadges } from '@/data/touristicPoints';

interface BadgesDisplayProps {
  unlockedBadges: Set<string>;
  newBadgeId?: string | null;
}

export const BadgesDisplay: React.FC<BadgesDisplayProps> = ({
  unlockedBadges,
  newBadgeId = null,
}) => {
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (newBadgeId) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: false,
          friction: 5,
          tension: 40,
        }),
        Animated.delay(2000),
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: false,
          friction: 5,
          tension: 40,
        }),
      ]).start();
    }
  }, [newBadgeId, scaleAnim]);

  return (
    <>
      {/* Botão de Medalhas */}
      <TouchableOpacity
        style={styles.badgesButton}
        onPress={() => setShowBadgesModal(true)}
      >
        <Text style={styles.badgesButtonText}>🏆 ({unlockedBadges.size})</Text>
      </TouchableOpacity>

      {/* Notificação de Nova Medalha */}
      {newBadgeId && (
        <Animated.View
          style={[
            styles.badgeNotification,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.badgeNotificationTitle}>🎉 Nova Medalha!</Text>
          <Text style={styles.badgeNotificationText}>
            {availableBadges.find((b) => b.id === newBadgeId)?.name}
          </Text>
        </Animated.View>
      )}

      {/* Modal de Medalhas */}
      <Modal
        visible={showBadgesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBadgesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBadgesModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>🏆 Suas Medalhas</Text>
            <Text style={styles.badgeCount}>
              {unlockedBadges.size} de {availableBadges.length}
            </Text>

            <FlatList
              data={availableBadges}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isUnlocked = unlockedBadges.has(item.id);
                return (
                  <View
                    style={[
                      styles.badgeItem,
                      !isUnlocked && styles.badgeItemLocked,
                    ]}
                  >
                    <Text style={styles.badgeIcon}>
                      {isUnlocked ? item.icon : '🔒'}
                    </Text>
                    <View style={styles.badgeInfo}>
                      <Text
                        style={[
                          styles.badgeName,
                          !isUnlocked && styles.badgeNameLocked,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.badgeDescription,
                          !isUnlocked && styles.badgeDescriptionLocked,
                        ]}
                      >
                        {item.description}
                      </Text>
                    </View>
                    {isUnlocked && (
                      <Text style={styles.unlockedBadge}>✓</Text>
                    )}
                  </View>
                );
              }}
              scrollEnabled
              nestedScrollEnabled
            />

            <TouchableOpacity
              style={styles.closeButton2}
              onPress={() => setShowBadgesModal(false)}
            >
              <Text style={styles.closeButtonText2}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Hook para gerenciar medalhas
export const useBadges = () => {
  const [unlockedBadges, setUnlockedBadges] = useState<Set<string>>(new Set());
  const [newBadgeCallback, setNewBadgeCallback] = useState<((id: string) => void) | null>(null);

  const unlockBadge = (badgeId: string) => {
    setUnlockedBadges((prev) => {
      if (!prev.has(badgeId)) {
        const updated = new Set([...prev, badgeId]);
        if (newBadgeCallback) {
          newBadgeCallback(badgeId);
        }
        return updated;
      }
      return prev;
    });
  };

  return {
    unlockedBadges,
    unlockBadge,
    setNewBadgeCallback,
  };
};

const styles = StyleSheet.create({
  badgesButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFD93D',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 1001,
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
    elevation: 5,
  },
  badgesButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badgeNotification: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    zIndex: 1002,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    elevation: 8,
  },
  badgeNotificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  badgeNotificationText: {
    fontSize: 14,
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton2: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  closeButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
    color: '#333',
  },
  badgeCount: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD93D',
  },
  badgeItemLocked: {
    opacity: 0.6,
    backgroundColor: '#f0f0f0',
    borderLeftColor: '#ccc',
  },
  badgeIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  badgeNameLocked: {
    color: '#999',
  },
  badgeDescription: {
    fontSize: 12,
    color: '#666',
  },
  badgeDescriptionLocked: {
    color: '#aaa',
  },
  unlockedBadge: {
    fontSize: 18,
    color: '#4ECDC4',
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
