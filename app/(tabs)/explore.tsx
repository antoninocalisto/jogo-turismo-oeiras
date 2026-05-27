import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { BadgesDisplay, useBadges } from '@/components/BadgesDisplay';
import { TouristicPoint } from '@/data/touristicPoints';
import { InteractiveMap } from '@/components/InteractiveMap';

export default function ExploreScreen() {
  const { unlockedBadges, unlockBadge, setNewBadgeCallback } = useBadges();
  const [newBadgeId, setNewBadgeId] = useState<string | null>(null);

  // Callback para quando um ponto turístico é visitado
  const handlePointVisited = useCallback((_point: TouristicPoint) => {
    // Aqui você pode adicionar som ou animações quando visita um ponto
  }, []);

  // Callback para quando uma medalha é desbloqueada
  const handleBadgeUnlocked = useCallback((badgeId: string) => {
    unlockBadge(badgeId);
    setNewBadgeId(badgeId);
    
    // Limpar a notificação após 3 segundos
    setTimeout(() => {
      setNewBadgeId(null);
    }, 3000);
  }, [unlockBadge]);

  // Configurar o callback para novas medalhas
  React.useEffect(() => {
    setNewBadgeCallback(() => (id: string) => {
      setNewBadgeId(id);
      setTimeout(() => setNewBadgeId(null), 3000);
    });
  }, [setNewBadgeCallback]);

  return (
    <View style={styles.container}>
      <InteractiveMap
        onPointVisited={handlePointVisited}
        onBadgeUnlocked={handleBadgeUnlocked}
      />
      <BadgesDisplay unlockedBadges={unlockedBadges} newBadgeId={newBadgeId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
});
